import type { PlayerId, RoomInfo } from '@game/core';
import { CARS } from '@game/games/kalesa';

/** One picture per car, rendered in Blender by render_cars() in assets/blender/kalesa_assets.py. */
const images = import.meta.glob('./cars/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

// Fetched as soon as the app loads (like the models), so an offline solo game still has its pictures.
if (typeof window !== 'undefined') for (const url of Object.values(images)) new Image().src = url;

export interface CarLook {
  /** Its own paint, which is also its driver's colour on screen. */
  color: string;
  /** Where its wheels go, (x forward, z towards the camera), metres from the car's origin: as CAR_WHEELS in the Blender script. */
  wheels: [number, number][];
}

const four = (front: number, rear: number, track: number): [number, number][] => [
  [front, track],
  [front, -track],
  [rear, track],
  [rear, -track],
];

export const CAR_LOOKS: Record<string, CarLook> = {
  taxi4l: { color: '#e9d49b', wheels: four(1.2, -1.2, 0.8) },
  deuche: { color: '#e6584d', wheels: four(1.2, -1.2, 0.78) },
  bachee: { color: '#4f8fdf', wheels: four(1.4, -1.4, 0.86) },
  brousse: { color: '#26b8ad', wheels: four(1.4, -1.5, 0.9) },
  karenjy: { color: '#f28b3a', wheels: four(1.15, -1.15, 0.86) },
  bajaj: {
    color: '#97d24e',
    wheels: [
      [1.0, 0],
      [-0.7, 0.7],
      [-0.7, -0.7],
    ],
  },
};

export const carImage = (id: string) => images[`./cars/${id}.png`] ?? images['./cars/taxi4l.png'];

/** Each seat's car, as picked in the lobby (a seat's default car if the room doesn't say). */
export function carsOf(players: PlayerId[], room: RoomInfo): string[] {
  return players.map((id, seat) => room.players.find((p) => p.id === id)?.piece ?? CARS[seat].id);
}
