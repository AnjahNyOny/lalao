import type { RoomInfo, RoomStatus, ServerMessage } from './protocol';
import { randomId, randomSeed } from './random';
import type { AnyGame, GameResult, PlayerId } from './types';

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
}

const TICK_MS = 50;
const MAX_NAME = 16;

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

  constructor(
    readonly code: string,
    readonly game: AnyGame,
  ) {}

  get isEmpty(): boolean {
    return this.members.every((m) => !m.transport);
  }

  join(name: string, transport: Transport): Member {
    if (this.status !== 'lobby') throw new RoomError('La partie a déjà commencé');
    if (this.members.length >= this.game.maxPlayers) throw new RoomError('Le salon est complet');
    const taken = new Set(this.members.map((m) => m.seat));
    let seat = 0;
    while (taken.has(seat)) seat++;
    const member: Member = { id: randomId(8), name: cleanName(name), token: randomId(24), seat, transport };
    this.members.push(member);
    this.members.sort((a, b) => a.seat - b.seat);
    this.hostId ??= member.id;
    return member;
  }

  /** Reattaches a returning player (page reload, network drop). */
  rejoin(token: string, transport: Transport): Member | null {
    const member = this.members.find((m) => m.token === token);
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

  start(by: PlayerId): void {
    if (by !== this.hostId) throw new RoomError("Seul l'hôte peut lancer la partie");
    if (this.status === 'playing') throw new RoomError('La partie est déjà en cours');
    // Players who left during the previous game don't get a seat in the rematch.
    for (let i = this.members.length - 1; i >= 0; i--) {
      if (!this.members[i].transport) this.members.splice(i, 1);
    }
    const n = this.members.length;
    if (n < this.game.minPlayers) throw new RoomError(`Il faut au moins ${this.game.minPlayers} joueurs`);
    if (n > this.game.maxPlayers) throw new RoomError(`${this.game.maxPlayers} joueurs maximum`);

    this.state = this.game.setup(this.members.map((m) => m.id), randomSeed());
    this.result = null;
    this.status = 'playing';
    if (this.game.tick) {
      this.loop = setInterval(() => {
        this.state = this.game.tick!(this.state, TICK_MS);
        this.checkResult();
        this.broadcastGame();
      }, TICK_MS);
    }
    this.broadcastRoom();
    this.broadcastGame();
  }

  action(by: PlayerId, action: unknown): void {
    if (this.status !== 'playing') throw new RoomError('Aucune partie en cours');
    if (!this.game.validate(this.state, action, by)) throw new RoomError('Coup invalide');
    this.state = this.game.apply(this.state, action, by);
    this.checkResult();
    this.broadcastGame();
  }

  dispose(): void {
    this.stopLoop();
  }

  info(): RoomInfo {
    return {
      code: this.code,
      gameId: this.game.id,
      hostId: this.hostId,
      status: this.status,
      players: this.members.map((m) => ({ id: m.id, name: m.name, seat: m.seat, connected: !!m.transport })),
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
    const view = this.game.viewFor ? this.game.viewFor(this.state, member.id) : this.state;
    member.transport.send({ t: 'game', view, result: this.result });
  }

  private checkResult(): void {
    this.result = this.game.result(this.state);
    if (!this.result) return;
    this.status = 'finished';
    this.stopLoop();
    this.broadcastRoom();
  }

  private stopLoop(): void {
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
  }
}
