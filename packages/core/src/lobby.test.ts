import { afterEach, describe, expect, it, vi } from 'vitest';
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
  bot: (s, me) => (s.players[s.turn] === me ? { add: 1 } : null),
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

  it('refuses new rooms once the server is full', () => {
    const lobby = new Lobby({ race }, 60_000, {}, 1);
    const [a, b] = [client(lobby), client(lobby)];
    a.session.receive({ t: 'create', name: 'A', gameId: 'race' });
    b.session.receive({ t: 'create', name: 'B', gameId: 'race' });
    expect(b.last('error')!.message).toMatch(/plein/);
    expect(lobby.roomCount).toBe(1);
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

describe('bots', () => {
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    vi.useFakeTimers();
    const lobby = new Lobby({ race }, 60_000, { botDelayMs: [10, 10] });
    const host = client(lobby);
    host.session.receive({ t: 'create', name: 'Alice', gameId: 'race' });
    return { lobby, host, me: host.last('welcome')!.playerId };
  };

  it('lets the host add and remove a bot in the lobby', () => {
    const { host } = setup();
    host.session.receive({ t: 'addBot', level: 'hard' });
    const bot = host.last('room')!.room.players[1];
    expect(bot).toMatchObject({ bot: 'hard', connected: true });
    expect(bot.name).toMatch(/🤖/);

    host.session.receive({ t: 'addBot', level: 'easy' });
    expect(host.last('error')!.message).toMatch(/complet/);

    host.session.receive({ t: 'removeBot', playerId: bot.id });
    expect(host.last('room')!.room.players).toHaveLength(1);
  });

  it('refuses bots from guests and malformed levels', () => {
    const { lobby, host } = setup();
    const guest = client(lobby);
    guest.session.receive({ t: 'join', code: host.last('welcome')!.code, name: 'Bob' });
    guest.session.receive({ t: 'addBot', level: 'easy' });
    expect(guest.last('error')!.message).toMatch(/hôte/);
    host.session.receive({ t: 'addBot', level: 'godlike' });
    expect(host.last('error')!.message).toMatch(/invalide/);
  });

  it('plays its turns by itself until the game ends, and again on rematch', () => {
    const { host, me } = setup();
    host.session.receive({ t: 'addBot', level: 'medium' });
    host.session.receive({ t: 'start' });

    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < 10 && !host.last('game')!.result; i++) {
        const view = host.last('game')!.view as { players: string[]; turn: number };
        if (view.players[view.turn] === me) host.session.receive({ t: 'action', action: { add: 1 } });
        else vi.advanceTimersByTime(10);
      }
      expect(host.last('game')!.result?.kind).toBe('win');
      host.session.receive({ t: 'start' });
    }
  });

  it('does not keep a room alive with only bots in it', () => {
    const { lobby, host } = setup();
    host.session.receive({ t: 'addBot', level: 'easy' });
    host.session.receive({ t: 'start' });
    host.session.close();
    vi.advanceTimersByTime(60_000);
    expect(lobby.roomCount).toBe(0);
  });
});

describe('game options', () => {
  afterEach(() => vi.useRealTimers());

  /** First to `goal` wins; with `timed`, the game ends once a second has passed. */
  const options: GameDefinition<{ players: string[]; goal: number; late: boolean }, { win: 1 }> = {
    id: 'opts',
    name: 'Opts',
    minPlayers: 2,
    maxPlayers: 2,
    options: [
      { id: 'goal', label: 'Objectif', default: '3', choices: [{ value: '3', label: '3' }, { value: '5', label: '5' }] },
      { id: 'timed', label: 'Chrono', default: 'no', choices: [{ value: 'no', label: 'Non' }, { value: 'yes', label: 'Oui' }] },
    ],
    setup: (players, _seed, opts = {}) => ({ players, goal: Number(opts.goal), late: false }),
    validate: (_s, a): a is { win: 1 } => (a as { win?: number })?.win === 1,
    apply: (s) => s,
    clock: (s, ms) => (ms >= 1000 && !s.late ? { ...s, late: true } : s),
    result: (s) => (s.late ? { kind: 'draw' } : null),
  };

  function room() {
    const lobby = new Lobby({ opts: options });
    const [a, b] = [client(lobby), client(lobby)];
    a.session.receive({ t: 'create', name: 'A', gameId: 'opts' });
    b.session.receive({ t: 'join', code: a.last('welcome')!.code, name: 'B' });
    return { a, b };
  }

  it('starts with the defaults, which only the host can change, to a declared choice', () => {
    const { a, b } = room();
    expect(a.last('room')!.room.options).toEqual({ goal: '3', timed: 'no' });
    b.session.receive({ t: 'setOption', id: 'goal', value: '5' });
    expect(b.last('error')!.message).toMatch(/hôte/);
    a.session.receive({ t: 'setOption', id: 'goal', value: '7' });
    expect(a.last('error')!.message).toMatch(/inconnue/);
    a.session.receive({ t: 'setOption', id: 'goal', value: '5' });
    expect(b.last('room')!.room.options.goal).toBe('5');
    a.session.receive({ t: 'start' });
    expect((a.last('game')!.view as { goal: number }).goal).toBe(5);
    a.session.receive({ t: 'setOption', id: 'goal', value: '3' });
    expect(a.last('error')!.message).toMatch(/en cours/);
  });

  it('runs the game clock about once a second while playing', () => {
    vi.useFakeTimers();
    const { a } = room();
    a.session.receive({ t: 'start' });
    expect(a.last('game')!.result).toBe(null);
    vi.advanceTimersByTime(1100);
    expect(a.last('game')!.result).toEqual({ kind: 'draw' });
  });
});
