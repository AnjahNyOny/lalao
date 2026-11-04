import type { GameRegistry } from '@game/core';
import { connect4 } from './connect4';
import { kalesa } from './kalesa';
import { miaraka } from './miaraka';
import { snakes } from './snakes';
import { tady } from './tady';
import { tsena } from './tsena';

/** Every playable mini-game. Add new games here. */
export const games: GameRegistry = {
  [connect4.id]: connect4,
  [snakes.id]: snakes,
  [tsena.id]: tsena,
  [miaraka.id]: miaraka,
  [tady.id]: tady,
  [kalesa.id]: kalesa,
};
