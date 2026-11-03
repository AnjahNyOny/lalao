import type { PlayerId, RoomInfo } from '@game/core';
import type { ComponentType } from 'react';
import type { Theme } from '../theme/theme';

export interface GameViewProps {
  /** Whatever the game's `viewFor` (or full state) sends this player. */
  view: unknown;
  me: PlayerId;
  room: RoomInfo;
  act: (action: unknown) => void;
}

export interface GameClient {
  emoji: string;
  /** Applied to the whole UI from the room lobby onwards. */
  theme: Theme;
  View: ComponentType<GameViewProps>;
  /** For games with pieces: the picture the lobby shows for each one. */
  pieceImage?: (id: string) => string;
}
