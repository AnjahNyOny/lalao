import type { PlayerId } from '@game/core';
import { COLS, dropRow, type Connect4State } from '@game/games/connect4';

/**
 * How verify plays each game: given a player's view, return a legal action,
 * or null when it isn't that player's turn. Random legal moves are enough to
 * reach the end of a game.
 */
export type Chooser = (view: unknown, me: PlayerId) => unknown | null;

const pick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

export const scenarios: Record<string, Chooser> = {
  connect4: (view, me) => {
    const s = view as Connect4State;
    if (s.winner !== null || s.players[s.turn] !== me) return null;
    const cols = Array.from({ length: COLS }, (_, c) => c).filter((c) => dropRow(s.board, c) >= 0);
    return { col: pick(cols) };
  },
};
