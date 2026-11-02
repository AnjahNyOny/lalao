import { Connect4View } from './connect4/Connect4View';
import type { GameClient } from './types';

/** Rendering side of each game, keyed like the `games` registry in @game/games. */
export const gameClients: Record<string, GameClient> = {
  connect4: { emoji: '🔴', View: Connect4View },
};
