import { BOT_LEVELS, type BotLevel, type GameResult, type PlayerId } from './types';

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export interface PlayerInfo {
  id: PlayerId;
  name: string;
  seat: number;
  connected: boolean;
  bot?: BotLevel;
}

export interface RoomInfo {
  code: string;
  gameId: string;
  hostId: PlayerId | null;
  status: RoomStatus;
  players: PlayerInfo[];
}

export type ClientMessage =
  | { t: 'create'; name: string; gameId: string }
  | { t: 'join'; code: string; name: string; token?: string }
  /** Host only: starts the game, or a rematch once finished. */
  | { t: 'start' }
  | { t: 'action'; action: unknown }
  /** Host only, in the lobby. */
  | { t: 'addBot'; level: BotLevel }
  | { t: 'removeBot'; playerId: PlayerId }
  | { t: 'leave' };

export type ServerMessage =
  | { t: 'welcome'; code: string; playerId: PlayerId; token: string }
  | { t: 'room'; room: RoomInfo }
  | { t: 'game'; view: unknown; result: GameResult | null }
  | { t: 'left' }
  | { t: 'error'; message: string };

const isString = (v: unknown): v is string => typeof v === 'string';

export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const m = raw as Record<string, unknown>;
  switch (m.t) {
    case 'create':
      return isString(m.name) && isString(m.gameId)
        ? { t: 'create', name: m.name, gameId: m.gameId }
        : null;
    case 'join':
      if (!isString(m.code) || !isString(m.name)) return null;
      if (m.token !== undefined && !isString(m.token)) return null;
      return { t: 'join', code: m.code, name: m.name, token: m.token };
    case 'start':
    case 'leave':
      return { t: m.t };
    case 'action':
      return { t: 'action', action: m.action };
    case 'addBot':
      return BOT_LEVELS.includes(m.level as BotLevel) ? { t: 'addBot', level: m.level as BotLevel } : null;
    case 'removeBot':
      return isString(m.playerId) ? { t: 'removeBot', playerId: m.playerId } : null;
    default:
      return null;
  }
}
