import { describe, expect, it } from 'vitest';
import { Lobby } from './lobby';
import type { ServerMessage } from './protocol';
import type { GameDefinition } from './types';

/** First to reach 3 by adding 1 each turn wins. */
const race: GameDefinition<{ players: string[]; scores: number[]; turn: number }, { add: 1 }> = {
  id: 'race',
  name: 'Race',
  minPlayers: 2,
  maxPlayers: 2,
  setup: (players) => ({ players, scores: players.map(() => 0), turn: 0 }),
  validate: (s, a, by): a is { add: 1 } => s.players[s.turn] === by && (a as { add?: number })?.add === 1,
  apply: (s) => {
    const scores = s.scores.slice();
    scores[s.turn]++;
    return { ...s, scores, turn: (s.turn + 1) % s.players.length };
  },
  result: (s) => {
    const i = s.scores.findIndex((v) => v >= 3);
    return i >= 0 ? { kind: 'win', winners: [s.players[i]] } : null;
  },
};

function client(lobby: Lobby) {
  const inbox: ServerMessage[] = [];
  const transport = { send: (m: ServerMessage) => inbox.push(m) };
  const session = lobby.connect(transport);
  const last = <T extends ServerMessage['t']>(t: T) =>
    inbox.filter((m): m is Extract<ServerMessage, { t: T }> => m.t === t).at(-1);
  return { inbox, session, last };
}

describe('Lobby', () => {
  it('runs a full game between two clients', () => {
    const lobby = new Lobby({ race });
    const a = client(lobby);
    const b = client(lobby);

    a.session.receive({ t: 'create', name: 'Alice', gameId: 'race' });
    const code = a.last('welcome')!.code;
    expect(code).toMatch(/^[A-Z]{4}$/);

    b.session.receive({ t: 'join', code: code.toLowerCase(), name: 'Bob' });
    expect(a.last('room')!.room.players.map((p) => p.name)).toEqual(['Alice', 'Bob']);

    b.session.receive({ t: 'start' });
    expect(b.last('error')!.message).toMatch(/hôte/);

    a.session.receive({ t: 'start' });
    const first = (a.last('game')!.view as { players: string[] }).players[0];
    const [p1, p2] = first === a.last('welcome')!.playerId ? [a, b] : [b, a];

    for (let i = 0; i < 3; i++) {
      p1.session.receive({ t: 'action', action: { add: 1 } });
      if (i < 2) p2.session.receive({ t: 'action', action: { add: 1 } });
    }
    expect(a.last('game')!.result).toEqual({ kind: 'win', winners: [p1.last('welcome')!.playerId] });
    expect(a.last('room')!.room.status).toBe('finished');
  });

  it('lets a player reconnect mid-game with their token', () => {
    const lobby = new Lobby({ race });
    const a = client(lobby);
    const b = client(lobby);
    a.session.receive({ t: 'create', name: 'Alice', gameId: 'race' });
    const { code, token, playerId } = a.last('welcome')!;
    b.session.receive({ t: 'join', code, name: 'Bob' });
    a.session.receive({ t: 'start' });

    a.session.close();
    expect(b.last('room')!.room.players.find((p) => p.id === playerId)!.connected).toBe(false);

    const a2 = client(lobby);
    a2.session.receive({ t: 'join', code, name: 'Alice', token });
    expect(a2.last('welcome')!.playerId).toBe(playerId);
    expect(a2.last('game')).toBeDefined();
    expect(b.last('room')!.room.players.every((p) => p.connected)).toBe(true);
  });

  it('refuses unknown rooms, full rooms and joins after start', () => {
    const lobby = new Lobby({ race });
    const [a, b, c] = [client(lobby), client(lobby), client(lobby)];
    c.session.receive({ t: 'join', code: 'ZZZZ', name: 'C' });
    expect(c.last('error')!.message).toMatch(/introuvable/);

    a.session.receive({ t: 'create', name: 'A', gameId: 'race' });
    const code = a.last('welcome')!.code;
    b.session.receive({ t: 'join', code, name: 'B' });
    c.session.receive({ t: 'join', code, name: 'C' });
    expect(c.last('error')!.message).toMatch(/complet/);
  });

  it('hands host to the next player when the host leaves the lobby', () => {
    const lobby = new Lobby({ race });
    const [a, b] = [client(lobby), client(lobby)];
    a.session.receive({ t: 'create', name: 'A', gameId: 'race' });
    b.session.receive({ t: 'join', code: a.last('welcome')!.code, name: 'B' });
    a.session.receive({ t: 'leave' });
    const room = b.last('room')!.room;
    expect(room.players).toHaveLength(1);
    expect(room.hostId).toBe(b.last('welcome')!.playerId);
  });
});
