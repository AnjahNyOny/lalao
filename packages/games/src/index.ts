import type { GameRegistry } from '@game/core';
import { connect4 } from './connect4';
import { snakes } from './snakes';
import { tsena } from './tsena';

/** Every playable mini-game. Add new games here. */
export const games: GameRegistry = {
  [connect4.id]: connect4,
  [snakes.id]: snakes,
  [tsena.id]: tsena,
};
