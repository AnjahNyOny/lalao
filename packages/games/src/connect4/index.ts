import type { GameDefinition, PlayerId } from '@game/core';

export const COLS = 7;
export const ROWS = 6;
const ALIGN = 4;

/** Index into `players`. */
export type Disc = 0 | 1;

export interface Connect4State {
  players: [PlayerId, PlayerId];
  /** `row * COLS + col`, row 0 at the bottom. */
  board: (Disc | null)[];
  turn: Disc;
  moves: number;
  last: { col: number; row: number } | null;
  winner: Disc | null;
  /** Board indices of the winning alignment. */
  winLine: number[] | null;
}

export interface Connect4Action {
  col: number;
}

export const cellIndex = (col: number, row: number) => row * COLS + col;

export function dropRow(board: Connect4State['board'], col: number): number {
  for (let row = 0; row < ROWS; row++) if (board[cellIndex(col, row)] === null) return row;
  return -1;
}

function findLine(board: Connect4State['board'], col: number, row: number): number[] | null {
  const disc = board[cellIndex(col, row)];
  const at = (c: number, r: number) => c >= 0 && c < COLS && r >= 0 && r < ROWS && board[cellIndex(c, r)] === disc;
  for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    const line = [cellIndex(col, row)];
    for (const sign of [1, -1]) {
      let c = col + dc * sign;
      let r = row + dr * sign;
      while (at(c, r)) {
        line.push(cellIndex(c, r));
        c += dc * sign;
        r += dr * sign;
      }
    }
    if (line.length >= ALIGN) return line;
  }
  return null;
}

export const connect4: GameDefinition<Connect4State, Connect4Action> = {
  id: 'connect4',
  name: '4 en ligne',
  minPlayers: 2,
  maxPlayers: 2,

  setup(players, seed) {
    return {
      players: [players[0], players[1]],
      board: Array(COLS * ROWS).fill(null),
      turn: (seed % 2) as Disc,
      moves: 0,
      last: null,
      winner: null,
      winLine: null,
    };
  },

  validate(state, action, by): action is Connect4Action {
    if (state.winner !== null || state.moves === COLS * ROWS) return false;
    if (state.players[state.turn] !== by) return false;
    if (typeof action !== 'object' || action === null) return false;
    const { col } = action as Record<string, unknown>;
    return Number.isInteger(col) && (col as number) >= 0 && (col as number) < COLS && dropRow(state.board, col as number) >= 0;
  },

  apply(state, { col }) {
    const row = dropRow(state.board, col);
    const board = state.board.slice();
    board[cellIndex(col, row)] = state.turn;
    const winLine = findLine(board, col, row);
    return {
      ...state,
      board,
      moves: state.moves + 1,
      last: { col, row },
      winLine,
      winner: winLine ? state.turn : null,
      turn: winLine ? state.turn : ((1 - state.turn) as Disc),
    };
  },

  result(state) {
    if (state.winner !== null) return { kind: 'win', winners: [state.players[state.winner]] };
    if (state.moves === COLS * ROWS) return { kind: 'draw' };
    return null;
  },
};
