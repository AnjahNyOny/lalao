import type { PlayerId } from '@game/core';
import { trackOf, segmentAt, type Course, type TrackDef } from './track';
import type { Terrain } from './terrain';
import type { Wheel } from './wheel';

export interface Car {
  /** Metres along the road. */
  d: number;
  /** Metres per second. */
  v: number;
  wheel: Wheel;
  /** Wheels drawn so far: the view pops the new one in when it changes. */
  n: number;
  /** Game time of the last change, ms. */
  at: number;
  /** Game time it crossed the line, ms. */
  finish: number | null;
}

export interface KalesaState {
  players: PlayerId[];
  course: Course;
  /** The road's length, metres. */
  length: number;
  /** ms since the start; negative during the countdown. */
  time: number;
  /** One per seat. */
  cars: Car[];
  over: boolean;
}

export type KalesaAction = { type: 'wheel'; pts: number[] };

export const COUNTDOWN_MS = 3000;
/** After the winner crosses the line, how long the others have to finish. */
export const GRACE_MS = 15_000;
/** Two wheels can't be drawn closer together than this. */
export const CHANGE_MS = 400;
/** A new wheel makes the car hop: it loses this share of its speed. */
export const HOP = 0.2;
/** m/s² speeding up, and slowing down when the road or the wheel gets worse. */
export const ACCEL = 5;
export const BRAKE = 10;

export const roadOf = (s: KalesaState): TrackDef => trackOf(s.course);
export const terrainAtOf = (s: KalesaState, d: number): Terrain => segmentAt(roadOf(s), Math.min(d, s.length - 0.001)).t;

/** Seats from first to last: those who finished by time, then the others by distance. */
export function standings(s: KalesaState): number[] {
  return s.cars
    .map((c, seat) => ({ c, seat }))
    .sort((a, b) => {
      if (a.c.finish !== null || b.c.finish !== null) return (a.c.finish ?? Infinity) - (b.c.finish ?? Infinity) || a.seat - b.seat;
      return b.c.d - a.c.d || a.seat - b.seat;
    })
    .map((x) => x.seat);
}
