import type { RoomInfo, RoomStatus, ServerMessage } from './protocol';
import { mulberry32, randomId, randomSeed } from './random';
import { defaultOptions, type AnyGame, type BotLevel, type GameOptions, type GameResult, type PlayerId } from './types';

export interface Transport {
  send(msg: ServerMessage): void;
}

/** A rule violation to report to the client, as opposed to a bug. */
export class RoomError extends Error {}

export interface Member {
  id: PlayerId;
  name: string;
  token: string;
  seat: number;
  transport: Transport | null;
  /** Set for computer players, which never have a transport. */
  bot?: BotLevel;
  /** For games with pieces: unique in the room. */
  piece?: string;
}

export interface RoomOptions {
  /** Bots wait a random time in this range before playing (overrides the game's own pace; for tests). */
  botDelayMs?: [number, number];
}

const TICK_MS = 50;
const CLOCK_MS = 1000;
const MAX_NAME = 16;
const DEFAULT_BOT_DELAY: [number, number] = [700, 1200];
const BOT_NAMES = ['Pixel', 'Bip', 'Turbo', 'Néon', 'Joystick', 'Arcadia', 'Volt', 'Glitch'];

export function cleanName(name: string): string {
  return name.trim().slice(0, MAX_NAME) || 'Joueur';
}

export class Room {
  readonly members: Member[] = [];
  hostId: PlayerId | null = null;
  status: RoomStatus = 'lobby';
  private state: unknown = null;
  private result: GameResult | null = null;
  private loop: ReturnType<typeof setInterval> | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  /** The host's choices, kept from one game to the next. */
  readonly options: GameOptions;
  /** Bumped on every state change, so a bot never plays on a stale view. */
  private version = 0;
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  private botRand = mulberry32(randomSeed());

  constructor(
    readonly code: string,
    readonly game: AnyGame,
    private readonly roomOptions: RoomOptions = {},
  ) {
    this.options = defaultOptions(game);
  }

  /** No human connected. Bots alone don't keep a room alive. */
  get isEmpty(): boolean {
    return this.members.every((m) => !m.transport);
  }

  join(name: string, transport: Transport): Member {
    if (this.status !== 'lobby') throw new RoomError('La partie a déjà commencé');
    const member = this.seat({ id: randomId(8), name: cleanName(name), token: randomId(24), transport });
    this.hostId ??= member.id;
    return member;
  }

  /** Reattaches a returning player (page reload, network drop). */
  rejoin(token: string, transport: Transport): Member | null {
    const member = this.members.find((m) => m.token === token && !m.bot);
    if (!member) return null;
    member.transport = transport;
    if (!this.hostId) this.hostId = member.id;
    return member;
  }

  /** `transport` guards against a stale connection closing after a rejoin. */
  leave(id: PlayerId, transport: Transport): void {
    const member = this.members.find((m) => m.id === id);
    if (!member || member.transport !== transport) return;
    member.transport = null;
    // In the lobby nobody is waiting on this seat, so free it.
    if (this.status === 'lobby') this.members.splice(this.members.indexOf(member), 1);
    if (this.hostId === id) this.hostId = this.members.find((m) => m.transport)?.id ?? null;
  }

  addBot(by: PlayerId, level: BotLevel): Member {
    this.requireHost(by);
    if (this.status === 'playing') throw new RoomError('La partie est déjà en cours');
    if (!this.game.bot) throw new RoomError("Ce jeu n'a pas encore de bot");
    const taken = new Set(this.members.map((m) => m.name));
    const name = BOT_NAMES.find((n) => !taken.has(`🤖 ${n}`)) ?? 'Bot';
    // A bot takes a free piece at random, so solo games don't always look the same.
    const free = this.freePieces();
    const piece = free.length ? free[Math.floor(this.botRand() * free.length)] : undefined;
    return this.seat({ id: randomId(8), name: `🤖 ${name}`, token: randomId(24), transport: null, bot: level, piece });
  }

  removeBot(by: PlayerId, botId: PlayerId): void {
    this.requireHost(by);
    if (this.status === 'playing') throw new RoomError('La partie est déjà en cours');
    const i = this.members.findIndex((m) => m.id === botId && m.bot);
    if (i < 0) throw new RoomError('Bot introuvable');
    this.members.splice(i, 1);
  }

  /** A player's own piece, between games: one the game declares, that nobody else has. */
  setPiece(by: PlayerId, piece: string): void {
    const member = this.members.find((m) => m.id === by);
    if (!member) throw new RoomError('Joueur inconnu');
    if (this.status === 'playing') throw new RoomError('La partie est déjà en cours');
    if (!this.game.pieces?.some((p) => p.id === piece)) throw new RoomError('Pion inconnu');
    if (this.members.some((m) => m !== member && m.piece === piece)) throw new RoomError('Ce pion est déjà pris');
    member.piece = piece;
  }

  /** Host only, between games: one of the choices the game declares. */
  setOption(by: PlayerId, id: string, value: string): void {
    this.requireHost(by);
    if (this.status === 'playing') throw new RoomError('La partie est déjà en cours');
    const option = this.game.options?.find((o) => o.id === id);
    if (!option || !option.choices.some((c) => c.value === value)) throw new RoomError('Option inconnue');
    this.options[id] = value;
  }

  start(by: PlayerId): void {
    this.requireHost(by);
    // Mid-game, the host may start over: the game in progress is dropped.
    if (this.status === 'playing') {
      this.stopLoop();
      this.cancelBot();
    }
    // Humans who left during the previous game don't get a seat in the rematch.
    for (let i = this.members.length - 1; i >= 0; i--) {
      const m = this.members[i];
      if (!m.transport && !m.bot) this.members.splice(i, 1);
    }
    const n = this.members.length;
    if (n < this.game.minPlayers) throw new RoomError(`Il faut au moins ${this.game.minPlayers} joueurs`);
    if (n > this.game.maxPlayers) throw new RoomError(`${this.game.maxPlayers} joueurs maximum`);

    this.state = this.game.setup(
      this.members.map((m) => m.id),
      randomSeed(),
      { ...this.options },
      this.members.map((m) => m.piece),
    );
    this.result = null;
    this.status = 'playing';
    if (this.game.tick) {
      this.loop = setInterval(() => {
        this.state = this.game.tick!(this.state, TICK_MS);
        this.changed();
      }, TICK_MS);
    }
    if (this.game.clock) {
      const started = Date.now();
      this.clockTimer = setInterval(() => {
        const next = this.game.clock!(this.state, Date.now() - started);
        if (next === this.state) return;
        this.state = next;
        this.changed();
      }, CLOCK_MS);
    }
    this.broadcastRoom();
    this.changed();
  }

  action(by: PlayerId, action: unknown): void {
    if (this.status !== 'playing') throw new RoomError('Aucune partie en cours');
    if (!this.game.validate(this.state, action, by)) throw new RoomError('Coup invalide');
    this.state = this.game.apply(this.state, action, by);
    // Real-time games send the state on every tick anyway: no extra broadcast per input.
    if (this.game.tick) this.version++;
    else this.changed();
  }

  dispose(): void {
    this.stopLoop();
    this.cancelBot();
  }

  info(): RoomInfo {
    return {
      code: this.code,
      gameId: this.game.id,
      hostId: this.hostId,
      status: this.status,
      players: this.members.map((m) => ({
        id: m.id,
        name: m.name,
        seat: m.seat,
        connected: !!m.transport || !!m.bot,
        ...(m.bot && { bot: m.bot }),
        ...(m.piece && { piece: m.piece }),
      })),
      options: { ...this.options },
    };
  }

  broadcastRoom(): void {
    const msg: ServerMessage = { t: 'room', room: this.info() };
    for (const m of this.members) m.transport?.send(msg);
  }

  broadcastGame(): void {
    for (const m of this.members) this.sendGameTo(m);
  }

  sendGameTo(member: Member): void {
    if (this.state === null || !member.transport) return;
    member.transport.send({ t: 'game', view: this.viewFor(member), result: this.result });
  }

  private viewFor(member: Member): unknown {
    return this.game.viewFor ? this.game.viewFor(this.state, member.id) : this.state;
  }

  /** Pieces nobody in the room has yet, in the game's order. */
  private freePieces(): string[] {
    const taken = new Set(this.members.map((m) => m.piece));
    return (this.game.pieces ?? []).map((p) => p.id).filter((id) => !taken.has(id));
  }

  private seat(member: Omit<Member, 'seat'>): Member {
    if (this.members.length >= this.game.maxPlayers) throw new RoomError('Le salon est complet');
    const taken = new Set(this.members.map((m) => m.seat));
    let seat = 0;
    while (taken.has(seat)) seat++;
    // Newcomers get the first free piece; they can change it in the lobby.
    const seated = { ...member, seat, piece: member.piece ?? this.freePieces()[0] };
    this.members.push(seated);
    this.members.sort((a, b) => a.seat - b.seat);
    return seated;
  }

  private requireHost(by: PlayerId): void {
    if (by !== this.hostId) throw new RoomError("Seul l'hôte peut faire ça");
  }

  /** After every state change: detect the end, tell everyone, let bots react. */
  private changed(): void {
    this.version++;
    this.result = this.game.result(this.state);
    if (this.result) {
      this.status = 'finished';
      this.stopLoop();
      this.cancelBot();
      this.broadcastRoom();
    }
    this.broadcastGame();
    if (!this.result) this.scheduleBot();
  }

  private scheduleBot(): void {
    if (this.botTimer || !this.game.bot) return;
    const bot = this.members.find((m) => m.bot && this.botAction(m) !== null);
    if (!bot) return;
    const [min, max] = this.botDelay();
    const version = this.version;
    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      if (this.status !== 'playing') return;
      // Recompute: the state may have moved on while we waited. A real-time
      // game moves on every tick, so there the bot just acts on the state as it is now.
      const action = version === this.version || this.game.tick ? this.botAction(bot) : null;
      if (action === null) return this.scheduleBot();
      try {
        this.action(bot.id, action);
      } catch (e) {
        // A bot proposing an illegal move is a bug in the game's bot; don't stall the room on it.
        if (!(e instanceof RoomError)) throw e;
        console.error(`[${this.game.id}] bot ${bot.bot} a proposé un coup invalide`, action);
      }
    }, min + this.botRand() * (max - min));
  }

  private botDelay(): [number, number] {
    const pace = this.roomOptions.botDelayMs ?? this.game.botDelayMs ?? DEFAULT_BOT_DELAY;
    return typeof pace === 'function' ? pace(this.state) : pace;
  }

  private botAction(bot: Member): unknown | null {
    return this.game.bot!(this.viewFor(bot), bot.id, bot.bot!, this.botRand);
  }

  private cancelBot(): void {
    if (this.botTimer) clearTimeout(this.botTimer);
    this.botTimer = null;
  }

  private stopLoop(): void {
    if (this.loop) clearInterval(this.loop);
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.loop = null;
    this.clockTimer = null;
  }
}
