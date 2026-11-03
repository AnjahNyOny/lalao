import { Connect4View } from './connect4/Connect4View';
import { connect4Theme } from './connect4/theme';
import { SnakesView } from './snakes/SnakesView';
import { snakesTheme } from './snakes/theme';
import { pawnImage } from './tsena/pawns';
import { tsenaTheme } from './tsena/theme';
import { TsenaView } from './tsena/TsenaView';
import type { GameClient } from './types';

/** Rendering side of each game, keyed like the `games` registry in @game/games. */
export const gameClients: Record<string, GameClient> = {
  connect4: { emoji: '🔴', theme: connect4Theme, View: Connect4View },
  snakes: { emoji: '🐍', theme: snakesTheme, View: SnakesView },
  tsena: { emoji: '🐂', theme: tsenaTheme, View: TsenaView, pieceImage: pawnImage },
};
