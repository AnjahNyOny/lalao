import { BOT_LEVELS, mulberry32, type BotLevel } from '@game/core';
import { describe, expect, it } from 'vitest';
import { connect4, type Connect4State } from '.';

const A = 'alice';
const B = 'bob';

/** Alice starts (even seed); plays the given columns alternately. */
function play(cols: number[]): Connect4State {
  let s = connect4.setup([A, B], 0);
  for (const col of cols) s = connect4.apply(s, { col }, s.players[s.turn]);
  return s;
}

const bot = (s: Connect4State, level: BotLevel, seed = 1) =>
  connect4.bot!(s, s.players[s.turn], level, mulberry32(seed));

/** Plays a whole game between two levels; returns the winner's level, or 'draw'. */
function match(first: BotLevel, second: BotLevel, seed: number): BotLevel | 'draw' {
  const rand = mulberry32(seed);
  const levels: Record<string, BotLevel> = { [A]: first, [B]: second };
  let s = connect4.setup([A, B], 0);
  while (!connect4.result(s)) {
    const by = s.players[s.turn];
    const action = connect4.bot!(s, by, levels[by], rand)!;
    expect(connect4.validate(s, action, by)).toBe(true);
    s = connect4.apply(s, action, by);
  }
  const r = connect4.result(s)!;
  return r.kind === 'win' ? levels[r.winners[0]] : 'draw';
}

describe('connect4 bot', () => {
  it('only plays on its own turn', () => {
    const s = play([]);
    expect(connect4.bot!(s, B, 'hard', mulberry32(1))).toBeNull();
  });

  it.each(['medium', 'hard'] as const)('%s takes an immediate win', (level) => {
    // Alice has 0,1,2 on the bottom row; Bob stacked above.
    const s = play([0, 0, 1, 1, 2, 2]);
    expect(bot(s, level)).toEqual({ col: 3 });
  });

  it.each(['medium', 'hard'] as const)('%s blocks an immediate threat', (level) => {
    // Bob (to play) must stop Alice's three in column 6.
    const s = play([6, 0, 6, 1, 6]);
    expect(bot(s, level)).toEqual({ col: 6 });
  });

  it('medium avoids giving the opponent a win on top of its move', () => {
    // Row 0: B A B _ ; row 1: A A A _. Alice threatens (3,1), so Bob must not fill (3,0).
    const s = play([1, 0, 0, 2, 1, 6, 2]);
    for (let seed = 0; seed < 30; seed++) expect(bot(s, 'medium', seed)).not.toEqual({ col: 3 });
  });

  it('every level always proposes a legal move until the end', () => {
    for (const level of BOT_LEVELS) for (let seed = 0; seed < 3; seed++) match(level, level, seed);
  });

  it('hard clearly beats easy, and medium beats easy', () => {
    const games = 10;
    let hard = 0;
    let medium = 0;
    for (let i = 0; i < games; i++) {
      // Alternate who starts.
      hard += Number((i % 2 ? match('easy', 'hard', i) : match('hard', 'easy', i)) === 'hard');
      medium += Number((i % 2 ? match('easy', 'medium', i) : match('medium', 'easy', i)) === 'medium');
    }
    expect(hard).toBeGreaterThanOrEqual(9);
    expect(medium).toBeGreaterThanOrEqual(7);
  });
});
