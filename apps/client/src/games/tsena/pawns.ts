import type { PlayerId, RoomInfo } from '@game/core';
import { PAWNS } from '@game/games/tsena';

/** One picture per pawn, rendered in Blender by render_icons() in assets/blender/tsena_assets.py. */
const images = import.meta.glob('./pawns/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

// Fetched as soon as the app loads (like the models), so an offline solo game still has its pictures.
if (typeof window !== 'undefined') for (const url of Object.values(images)) new Image().src = url;

export const pawnImage = (id: string) => images[`./pawns/${id}.png`] ?? images['./pawns/zebu.png'];
export const pawnModel = (id: string) => `pawn_${id}`;
export const pawnLabel = (id: string) => PAWNS.find((p) => p.id === id)?.label ?? id;

/** Each seat's pawn, as picked in the lobby (a seat's default pawn if the room doesn't say). */
export function pawnsOf(players: PlayerId[], room: RoomInfo): string[] {
  return players.map((id, seat) => room.players.find((p) => p.id === id)?.piece ?? PAWNS[seat].id);
}
