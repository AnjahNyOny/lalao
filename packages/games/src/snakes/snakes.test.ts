import { BOT_LEVELS, mulberry32, mulberryStep, type BotLevel } from '@game/core';
import { describe, expect, it } from 'vitest';
import { CARDS, LAST, snakes, START_ERASERS, type CardId, type SnakesAction, type SnakesState } from '.';

const P = ['a', 'b', 'c'];

/** An rng state whose next draws give this roll (and this card, if any). */
function rngFor(roll: number, card?: CardId): number {
  const total = CARDS.reduce((s, c) => s + c.weight, 0);
  for (let seed = 0; seed < 100_000; seed++) {
    const [r1, n1] = mulberryStep(seed);
    if (1 + Math.floor(r1 * 6) !== roll) continue;
    if (!card) return seed;
    let x = mulberryStep(n1)[0] * total;
    if (CARDS.find((c) => (x -= c.weight) < 0)?.id === card) return seed;
  }
  throw new Error('no seed');
}

/** Player 0 to play from `pos`, with a given roll (and card). */
function at(pos: number, roll: number, card?: CardId, extra: Partial<SnakesState> = {}): SnakesState {
  const s = snakes.setup(P, 0);
  s.pawns[0].pos = pos;
  return { ...s, turn: 0, rng: rngFor(roll, card), ...extra };
}

const act = (s: SnakesState, action: SnakesAction) => {
  const by = s.players[s.turn];
  expect(snakes.validate(s, action, by)).toBe(true);
  return snakes.apply(s, action, by);
};
const roll = (s: SnakesState) => act(s, { type: 'roll' });

describe('snakes & ladders', () => {
  it('starts everyone off the board with erasers', () => {
    const s = snakes.setup(P, 4);
    expect(s.pawns).toEqual(P.map(() => ({ pos: 0, erasers: START_ERASERS, skip: false })));
    expect(s.turn).toBe(1);
  });

  it('walks cell by cell and passes the dice', () => {
    const s = roll(at(0, 2));
    expect(s.pawns[0].pos).toBe(2);
    expect(s.last!.hops).toEqual([{ cell: 1, via: 'walk' }, { cell: 2, via: 'walk' }]);
    expect(s.turn).toBe(1);
  });

  it('climbs ladders', () => {
    const s = roll(at(1, 3));
    expect(s.pawns[0].pos).toBe(25);
    expect(s.last!.hops.at(-1)).toEqual({ cell: 25, via: 'ladder' });
  });

  it('slides down snakes when out of erasers', () => {
    const start = at(24, 3);
    start.pawns[0].erasers = 0;
    expect(roll(start).pawns[0].pos).toBe(5);
  });

  it('lets the player choose between erasing and sliding', () => {
    const pending = roll(at(24, 3));
    expect(pending.pending).toEqual({ head: 27, again: false });
    expect(pending.turn).toBe(0);
    expect(snakes.validate(pending, { type: 'roll' }, 'a')).toBe(false);

    const slid = act(pending, { type: 'slide' });
    expect(slid.pawns[0]).toMatchObject({ pos: 5, erasers: 2 });
    expect(slid.turn).toBe(1);

    const erased = act(pending, { type: 'erase' });
    expect(erased.pawns[0]).toMatchObject({ pos: 27, erasers: 1 });
    expect(erased.last!.erased).toBe(true);
  });

  it('plays again on a six, even after an eraser choice', () => {
    expect(roll(at(10, 6)).turn).toBe(0);
    const pending = roll(at(21, 6));
    expect(pending.pending).toEqual({ head: 27, again: true });
    expect(act(pending, { type: 'erase' }).turn).toBe(0);
  });

  it('bounces back off the last cell, and wins on it exactly', () => {
    const bounced = roll(at(98, 5));
    expect(bounced.pawns[0].pos).toBe(97);
    expect(bounced.last!.hops.map((h) => h.via)).toEqual(['walk', 'walk', 'bounce', 'bounce', 'bounce']);

    const won = roll(at(97, 3));
    expect(won.pawns[0].pos).toBe(LAST);
    expect(snakes.result(won)).toEqual({ kind: 'win', winners: ['a'] });
    expect(snakes.validate(won, { type: 'roll' }, won.players[won.turn])).toBe(false);
  });

  describe('mystery cards (from cell 5, rolling 4 onto cell 9)', () => {
    const card = (id: CardId, extra?: Partial<SnakesState>) => {
      const s = roll(at(5, 4, id, extra));
      expect(s.last!.card).toBe(id);
      return s;
    };

    it('forward, back and start move the pawn', () => {
      expect(card('forward').pawns[0].pos).toBe(12);
      expect(card('back').pawns[0].pos).toBe(6);
      expect(card('start').pawns[0].pos).toBe(0);
    });

    it('ladder jumps to the next ladder and climbs it', () => {
      expect(card('ladder').pawns[0].pos).toBe(46);
    });

    it('again keeps the turn; skip makes you miss the next one', () => {
      expect(card('again').turn).toBe(0);
      const skipped = card('skip');
      expect(skipped.pawns[0].skip).toBe(true);
      // b and c play, then a's turn is skipped and goes back to b.
      let s = skipped;
      s = roll({ ...s, rng: rngFor(1) });
      s = roll({ ...s, rng: rngFor(1) });
      expect(s.turn).toBe(1);
      expect(s.pawns[0].skip).toBe(false);
    });

    it('swap trades places with the leader; storm pushes everyone else back', () => {
      const base = snakes.setup(P, 0);
      const pawns = base.pawns.map((p, i) => ({ ...p, pos: [5, 60, 30][i] }));
      const swapped = card('swap', { pawns });
      expect(swapped.pawns.map((p) => p.pos)).toEqual([60, 9, 30]);
      expect(swapped.last!.moved).toEqual([{ player: 1, to: 9 }]);

      const stormed = card('storm', { pawns });
      expect(stormed.pawns.map((p) => p.pos)).toEqual([9, 58, 28]);
    });

    it('eraser gives one more eraser', () => {
      expect(card('eraser').pawns[0].erasers).toBe(START_ERASERS + 1);
    });
  });

  it('rejects moves out of turn and malformed actions', () => {
    const s = at(0, 1);
    expect(snakes.validate(s, { type: 'roll' }, 'b')).toBe(false);
    expect(snakes.validate(s, { type: 'jump' }, 'a')).toBe(false);
    expect(snakes.validate(s, null, 'a')).toBe(false);
    expect(snakes.validate(s, { type: 'erase' }, 'a')).toBe(false);
  });

  it('does not mutate the state it is given', () => {
    const s = at(1, 3);
    const copy = JSON.parse(JSON.stringify(s));
    roll(s);
    expect(s).toEqual(copy);
  });
});

/** Full game between bots; returns the winning seat. */
function match(levels: BotLevel[], seed: number): number {
  const rand = mulberry32(seed);
  let s = snakes.setup(levels.map((_, i) => `p${i}`), seed);
  for (let i = 0; i < 5000 && s.winner === null; i++) {
    const by = s.players[s.turn];
    const action = snakes.bot!(s, by, levels[s.turn], rand)!;
    expect(snakes.validate(s, action, by)).toBe(true);
    s = snakes.apply(s, action, by);
  }
  expect(s.winner).not.toBeNull();
  return s.winner!;
}

describe('snakes bot', () => {
  it('only acts on its own turn', () => {
    const s = at(0, 1);
    expect(snakes.bot!(s, 'b', 'hard', Math.random)).toBeNull();
  });

  it('every level plays full 4-player games to the end', () => {
    for (let seed = 0; seed < 20; seed++) match(['easy', 'medium', 'hard', 'easy'], seed);
  });

  it('hard always erases the big snake near the top', () => {
    const s = roll(at(96, 3));
    expect(s.pending?.head).toBe(99);
    for (const level of ['medium', 'hard'] as const) expect(snakes.bot!(s, 'a', level, Math.random)).toEqual({ type: 'erase' });
  });

  it('hard saves its last eraser on a small snake when big ones lie ahead', () => {
    const s = roll(at(24, 3));
    s.pawns[0].erasers = 1;
    expect(snakes.bot!(s, 'a', 'hard', Math.random)).toEqual({ type: 'slide' });
  });

  it('hard wins more often than easy over many games', () => {
    let hard = 0;
    const games = 600;
    for (let seed = 0; seed < games; seed++) hard += Number(match(seed % 2 ? ['easy', 'hard'] : ['hard', 'easy'], seed) === (seed % 2 ? 1 : 0));
    expect(hard / games).toBeGreaterThan(0.52);
  });

  it('keeps every level valid', () => {
    for (const level of BOT_LEVELS) match([level, level], 1);
  });
});
