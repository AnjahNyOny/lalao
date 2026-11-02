import type { PlayerId, RoomInfo } from '@game/core';
import type { ComponentType } from 'react';

export interface GameViewProps {
  /** Whatever the game's `viewFor` (or full state) sends this player. */
  view: unknown;
  me: PlayerId;
  room: RoomInfo;
  act: (action: unknown) => void;
}

export interface GameClient {
  emoji: string;
  View: ComponentType<GameViewProps>;
}
