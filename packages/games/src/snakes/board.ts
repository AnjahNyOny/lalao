/** Fixed layout: learnable, and balanced by hand. Cells are numbered 1–100. */
export const SIZE = 10;
export const LAST = SIZE * SIZE;

/** bottom → top */
export const LADDERS: Record<number, number> = { 4: 25, 13: 46, 33: 49, 42: 63, 50: 69, 62: 81, 74: 92 };
/** head → tail */
export const SNAKES: Record<number, number> = { 27: 5, 40: 3, 43: 18, 54: 31, 66: 45, 76: 58, 89: 53, 99: 41 };
export const MYSTERY = [9, 20, 35, 44, 57, 71, 83, 94];

export type CardId = 'forward' | 'back' | 'again' | 'skip' | 'start' | 'swap' | 'ladder' | 'storm' | 'eraser';

/** Draw weights: mild cards common, harsh ones rare. */
export const CARDS: { id: CardId; weight: number }[] = [
  { id: 'forward', weight: 3 },
  { id: 'back', weight: 3 },
  { id: 'again', weight: 2 },
  { id: 'skip', weight: 2 },
  { id: 'ladder', weight: 2 },
  { id: 'start', weight: 1 },
  { id: 'swap', weight: 1 },
  { id: 'storm', weight: 1 },
  { id: 'eraser', weight: 1 },
];

export const CARD_STEPS = 3;
export const STORM_STEPS = 2;

/** Grid position of a cell, row 0 at the bottom, rows alternating direction. */
export function cellXY(cell: number): { col: number; row: number } {
  const i = cell - 1;
  const row = Math.floor(i / SIZE);
  const offset = i % SIZE;
  return { row, col: row % 2 === 0 ? offset : SIZE - 1 - offset };
}

/** Going past 100 bounces back by the excess. */
export const bounce = (cell: number) => (cell > LAST ? LAST - (cell - LAST) : Math.max(cell, 0));
