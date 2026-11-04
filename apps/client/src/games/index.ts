import { Connect4View } from './connect4/Connect4View';
import { MiarakaView } from './miaraka/MiarakaView';
import { miarakaTheme } from './miaraka/theme';
import { connect4Theme } from './connect4/theme';
import { SnakesView } from './snakes/SnakesView';
import type { TadyState } from '@game/games/tady';
import { pieceImage as lemurImage } from './tady/art';
import { TadyView } from './tady/TadyView';
import { tadyTheme } from './tady/theme';
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
  // The maki and the zebu, pictured as in Tsena.
  miaraka: { emoji: '🐒', theme: miarakaTheme, View: MiarakaView, pieceImage: (id) => pawnImage(id === 'maki' ? 'lemur' : 'zebu') },
  // Pixel art: the climbers are drawn from their sprites.
  tady: {
    emoji: '🧗',
    theme: tadyTheme,
    View: TadyView,
    pieceImage: lemurImage,
    // Stuck somewhere? Not in the rough mode, where a fall costs what it costs.
    menu: (view) => {
      const s = view as TadyState;
      if (s.rough || s.won) return [];
      return [{ label: 'Retour au dernier camp', hint: s.camp ? 'Vous repartez tous les deux du camp.' : 'Vous repartez tous les deux du pied de la montagne.', action: { type: 'camp' } }];
    },
  },
};
