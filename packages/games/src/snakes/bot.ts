import type { BotLevel, PlayerId } from '@game/core';
import type { SnakesAction, SnakesState } from '.';
import { SNAKES } from './board';

/** A snake that costs at least this many cells is worth an eraser no matter what. */
const BIG_DROP = 30;
const MEDIUM_DROP = 20;

const drop = (head: number) => head - SNAKES[head];

/**
 * The dice decide most things; the one real choice is when to spend an eraser.
 * Hard keeps one eraser in reserve for each big snake still ahead of it.
 */
export function snakesBot(state: SnakesState, me: PlayerId, level: BotLevel, rand: () => number): SnakesAction | null {
  if (state.winner !== null || state.players[state.turn] !== me) return null;
  if (!state.pending) return { type: 'roll' };

  const { head } = state.pending;
  const { erasers } = state.pawns[state.turn];
  let erase: boolean;
  if (level === 'easy') erase = rand() < 0.5;
  else if (level === 'medium') erase = drop(head) >= MEDIUM_DROP;
  else {
    const bigAhead = Object.keys(SNAKES)
      .map(Number)
      .filter((h) => h > head && drop(h) >= BIG_DROP).length;
    erase = drop(head) >= BIG_DROP || erasers > bigAhead;
  }
  return { type: erase ? 'erase' : 'slide' };
}
