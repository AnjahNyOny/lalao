import type { BotLevel, PlayerId } from '@game/core';
import type { Connect4Action, Connect4State } from '.';
import { COLS, ROWS, cellIndex, dropRow, findLine, type Board, type Disc } from './board';

/** Centre first: better moves early make alpha-beta prune far more. */
const ORDER = [3, 2, 4, 1, 5, 0, 6];
const CENTRE_WEIGHT = [1, 2, 3, 4, 3, 2, 1];
const HARD_DEPTH = 6;
const WIN = 1_000_000;

const other = (d: Disc) => (1 - d) as Disc;
const legalCols = (board: Board) => ORDER.filter((c) => dropRow(board, c) >= 0);

function drop(board: Board, col: number, disc: Disc): { board: Board; row: number } {
  const row = dropRow(board, col);
  const next = board.slice();
  next[cellIndex(col, row)] = disc;
  return { board: next, row };
}

const wins = (board: Board, col: number, disc: Disc) => {
  const { board: next, row } = drop(board, col, disc);
  return findLine(next, col, row) !== null;
};

/** Would playing `col` let the opponent win right on top of it? */
function givesWin(board: Board, col: number, disc: Disc): boolean {
  const { board: next, row } = drop(board, col, disc);
  return row + 1 < ROWS && wins(next, col, other(disc));
}

const WINDOWS: number[][] = (() => {
  const out: number[][] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
        const cells = [0, 1, 2, 3].map((k) => [c + dc * k, r + dr * k]);
        if (cells.every(([x, y]) => x >= 0 && x < COLS && y >= 0 && y < ROWS)) out.push(cells.map(([x, y]) => cellIndex(x, y)));
      }
  return out;
})();

/** Static evaluation from `disc`'s point of view: open threes and twos, plus the centre. */
function evaluate(board: Board, disc: Disc): number {
  let score = 0;
  for (let r = 0; r < ROWS; r++) {
    const v = board[cellIndex(3, r)];
    if (v === disc) score += 3;
    else if (v !== null) score -= 3;
  }
  for (const w of WINDOWS) {
    let mine = 0;
    let theirs = 0;
    for (const i of w) {
      if (board[i] === disc) mine++;
      else if (board[i] !== null) theirs++;
    }
    if (theirs === 0) score += mine === 3 ? 5 : mine === 2 ? 2 : 0;
    else if (mine === 0) score -= theirs === 3 ? 4 : theirs === 2 ? 2 : 0;
  }
  return score;
}

function negamax(board: Board, disc: Disc, depth: number, alpha: number, beta: number, moves: number): number {
  const cols = legalCols(board);
  if (cols.length === 0) return 0;
  // Sooner wins score higher, so the bot goes for the quickest one.
  for (const c of cols) if (wins(board, c, disc)) return WIN - moves;
  if (depth === 0) return evaluate(board, disc);
  let best = -Infinity;
  for (const c of cols) {
    const value = -negamax(drop(board, c, disc).board, other(disc), depth - 1, -beta, -alpha, moves + 1);
    if (value > best) best = value;
    if (value > alpha) alpha = value;
    if (alpha >= beta) break;
  }
  return best;
}

function weightedPick(cols: number[], rand: () => number): number {
  const total = cols.reduce((s, c) => s + CENTRE_WEIGHT[c], 0);
  let x = rand() * total;
  for (const c of cols) if ((x -= CENTRE_WEIGHT[c]) < 0) return c;
  return cols[cols.length - 1];
}

export function connect4Bot(state: Connect4State, me: PlayerId, level: BotLevel, rand: () => number): Connect4Action | null {
  if (state.winner !== null || state.players[state.turn] !== me) return null;
  const { board, turn: disc } = state;
  const cols = legalCols(board);
  if (cols.length === 0) return null;

  const winning = cols.find((c) => wins(board, c, disc));
  const blocking = cols.find((c) => wins(board, c, other(disc)));

  if (level === 'easy') {
    // Notices the obvious only some of the time.
    if (winning !== undefined && rand() < 0.5) return { col: winning };
    if (blocking !== undefined && rand() < 0.3) return { col: blocking };
    return { col: cols[Math.floor(rand() * cols.length)] };
  }

  if (winning !== undefined) return { col: winning };
  if (blocking !== undefined) return { col: blocking };

  if (level === 'medium') {
    const safe = cols.filter((c) => !givesWin(board, c, disc));
    return { col: weightedPick(safe.length ? safe : cols, rand) };
  }

  let best = -Infinity;
  let choices: number[] = [];
  for (const c of cols) {
    const value = -negamax(drop(board, c, disc).board, other(disc), HARD_DEPTH - 1, -Infinity, Infinity, state.moves + 1);
    if (value > best) {
      best = value;
      choices = [c];
    } else if (value === best) choices.push(c);
  }
  return { col: choices[Math.floor(rand() * choices.length)] };
}
