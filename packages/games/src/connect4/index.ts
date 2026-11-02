import type { GameDefinition, PlayerId } from '@game/core';
import { COLS, ROWS, cellIndex, dropRow, findLine, type Board, type Disc } from './board';
import { connect4Bot } from './bot';

export * from './board';

export interface Connect4State {
  players: [PlayerId, PlayerId];
  board: Board;
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

  bot: connect4Bot,

  result(state) {
    if (state.winner !== null) return { kind: 'win', winners: [state.players[state.winner]] };
    if (state.moves === COLS * ROWS) return { kind: 'draw' };
    return null;
  },
};
