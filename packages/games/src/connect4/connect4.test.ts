import { describe, expect, it } from 'vitest';
import { COLS, ROWS, connect4, type Connect4State } from '.';

const A = 'alice';
const B = 'bob';

/** Alice always starts (even seed). Plays columns alternately A, B, A, B… */
function play(cols: number[]): Connect4State {
  let state = connect4.setup([A, B], 0);
  for (const col of cols) {
    const by = state.players[state.turn];
    expect(connect4.validate(state, { col }, by)).toBe(true);
    state = connect4.apply(state, { col }, by);
  }
  return state;
}

describe('connect4', () => {
  it('stacks discs from the bottom', () => {
    const s = play([3, 3]);
    expect(s.board[3]).toBe(0);
    expect(s.board[COLS + 3]).toBe(1);
    expect(s.last).toEqual({ col: 3, row: 1 });
  });

  it('detects a vertical win', () => {
    const s = play([0, 1, 0, 1, 0, 1, 0]);
    expect(connect4.result(s)).toEqual({ kind: 'win', winners: [A] });
    expect(s.winLine).toHaveLength(4);
  });

  it('detects a horizontal win', () => {
    const s = play([0, 0, 1, 1, 2, 2, 3]);
    expect(connect4.result(s)).toEqual({ kind: 'win', winners: [A] });
  });

  it('detects a diagonal win', () => {
    //  A plays 0,1,2,3 rising; B fills under.
    const s = play([0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]);
    expect(connect4.result(s)).toEqual({ kind: 'win', winners: [A] });
  });

  it('rejects moves out of turn, malformed or in a full column', () => {
    let s = connect4.setup([A, B], 0);
    expect(connect4.validate(s, { col: 0 }, B)).toBe(false);
    expect(connect4.validate(s, { col: 7 }, A)).toBe(false);
    expect(connect4.validate(s, { col: 1.5 }, A)).toBe(false);
    expect(connect4.validate(s, 'oops', A)).toBe(false);
    s = play([0, 0, 0, 0, 0, 0]);
    expect(connect4.validate(s, { col: 0 }, A)).toBe(false);
  });

  it('declares a draw on a full board with no line', () => {
    // Columns filled in pairs with a pattern that never aligns four.
    const order = [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 2, 3, 2, 3, 2, 3, 3, 2, 3, 2, 3, 2, 4, 5, 4, 5, 4, 5, 5, 4, 5, 4, 5, 4, 6, 6, 6, 6, 6, 6];
    const s = play(order);
    expect(s.moves).toBe(COLS * ROWS);
    expect(connect4.result(s)).toEqual({ kind: 'draw' });
  });
});
