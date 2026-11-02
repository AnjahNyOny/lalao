/** Board geometry shared by the rules and the bot. */
export const COLS = 7;
export const ROWS = 6;
export const ALIGN = 4;

/** Index into `players`. */
export type Disc = 0 | 1;

/** `row * COLS + col`, row 0 at the bottom. */
export type Board = (Disc | null)[];

export const cellIndex = (col: number, row: number) => row * COLS + col;

export function dropRow(board: Board, col: number): number {
  for (let row = 0; row < ROWS; row++) if (board[cellIndex(col, row)] === null) return row;
  return -1;
}

export function findLine(board: Board, col: number, row: number): number[] | null {
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
