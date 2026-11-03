import { parseClientMessage, type ClientMessage } from './protocol';
import { randomId } from './random';
import { Room, RoomError, type Member, type RoomOptions, type Transport } from './room';
import type { GameRegistry, PlayerId } from './types';

// No I/O/0/1: codes get read aloud and typed on phones.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Owns every room on one host, whether that host is a cloud server or a
 * phone sharing its connection. Plug any transport in via `connect`.
 */
export class Lobby {
  private rooms = new Map<string, Room>();
  private expiry = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    readonly games: GameRegistry,
    private emptyRoomTtlMs = 60_000,
    private roomOptions: RoomOptions = {},
    /** A public server caps how many rooms can be open at once. */
    private maxRooms = Infinity,
  ) {}

  connect(transport: Transport): Session {
    return new Session(this, transport);
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  createRoom(gameId: string): Room {
    const game = this.games[gameId];
    if (!game) throw new RoomError('Jeu inconnu');
    if (this.rooms.size >= this.maxRooms) throw new RoomError('Le serveur est plein, réessaie dans un moment');
    let code: string;
    do code = randomId(4, CODE_ALPHABET);
    while (this.rooms.has(code));
    const room = new Room(code, game, this.roomOptions);
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.trim().toUpperCase());
  }

  /** Called whenever someone enters or leaves; empty rooms expire after a grace period. */
  touch(room: Room): void {
    clearTimeout(this.expiry.get(room.code));
    this.expiry.delete(room.code);
    if (!room.isEmpty) return;
    this.expiry.set(
      room.code,
      setTimeout(() => {
        room.dispose();
        this.rooms.delete(room.code);
        this.expiry.delete(room.code);
      }, this.emptyRoomTtlMs),
    );
  }
}

/** One connected client. */
export class Session {
  private room: Room | null = null;
  private playerId: PlayerId | null = null;

  constructor(
    private lobby: Lobby,
    private transport: Transport,
  ) {}

  receive(raw: unknown): void {
    const msg = parseClientMessage(raw);
    if (!msg) return this.transport.send({ t: 'error', message: 'Message invalide' });
    try {
      this.handle(msg);
    } catch (e) {
      if (!(e instanceof RoomError)) throw e;
      this.transport.send({ t: 'error', message: e.message });
    }
  }

  close(): void {
    const room = this.room;
    if (!room || !this.playerId) return;
    room.leave(this.playerId, this.transport);
    this.room = null;
    this.playerId = null;
    room.broadcastRoom();
    this.lobby.touch(room);
  }

  private handle(msg: ClientMessage): void {
    switch (msg.t) {
      case 'create': {
        this.close();
        const room = this.lobby.createRoom(msg.gameId);
        this.enter(room, room.join(msg.name, this.transport));
        return;
      }
      case 'join': {
        const room = this.lobby.getRoom(msg.code);
        if (!room) throw new RoomError('Salon introuvable');
        if (room !== this.room) this.close();
        const member = (msg.token && room.rejoin(msg.token, this.transport)) || room.join(msg.name, this.transport);
        this.enter(room, member);
        return;
      }
      case 'start':
        return this.requireRoom().start(this.playerId!);
      case 'action':
        return this.requireRoom().action(this.playerId!, msg.action);
      case 'addBot': {
        const room = this.requireRoom();
        room.addBot(this.playerId!, msg.level);
        return room.broadcastRoom();
      }
      case 'removeBot': {
        const room = this.requireRoom();
        room.removeBot(this.playerId!, msg.playerId);
        return room.broadcastRoom();
      }
      case 'setOption': {
        const room = this.requireRoom();
        room.setOption(this.playerId!, msg.id, msg.value);
        return room.broadcastRoom();
      }
      case 'leave':
        this.close();
        this.transport.send({ t: 'left' });
        return;
    }
  }

  private enter(room: Room, member: Member): void {
    this.room = room;
    this.playerId = member.id;
    this.transport.send({ t: 'welcome', code: room.code, playerId: member.id, token: member.token });
    room.broadcastRoom();
    room.sendGameTo(member);
    this.lobby.touch(room);
  }

  private requireRoom(): Room {
    if (!this.room || !this.playerId) throw new RoomError("Tu n'es dans aucun salon");
    return this.room;
  }
}
