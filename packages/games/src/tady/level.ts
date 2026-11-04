/**
 * The mountain, drawn as text: one character per tile, row 0 at the top
 * (the summit), x to the right, y going down.
 *
 *   .  air               #  granite (solid; you can grip it)
 *   ~  ice (solid, slippery, no grip)
 *   %  crumbling rock (gives way a moment after someone stands on it, comes back later)
 *   -  wooden ledge (stand on it from above, jump up through it)
 *   _  camp floor: a ledge that also catches a fall, except a long one in the rough mode
 *   C  a camp (checkpoint marker)      *  an orchid to pick
 *   S  the summit                      a b  where each climber starts
 */

export interface Wind {
  /** Rows the gusts blow across (inclusive). */
  y0: number;
  y1: number;
  /** 1 blows east, -1 west. */
  dir: 1 | -1;
  /** A gust every `period` ms, lasting `on` ms, starting `phase` ms in. */
  period: number;
  on: number;
  phase: number;
}

export interface Stage {
  /** Shown as the climbers reach it, from the camp below it. */
  name: string;
  /** The row of its camp floor (the bottom of the stage). */
  floor: number;
}

export interface Mountain {
  rows: string[];
  winds: Wind[];
  /** From the bottom up. */
  stages: Stage[];
  /** Metres above the sea at the bottom row and at the summit. */
  altitude: [number, number];
}

/** Metres above the sea at row y. */
export function altitudeAt(m: Mountain, y: number): number {
  const top = cellsWith(m, 'S')[0]?.[1] ?? 0;
  const bottom = m.rows.length - 1;
  const [low, high] = m.altitude;
  return Math.round(low + ((bottom - y) / (bottom - top)) * (high - low));
}

export const charAt = (m: Mountain, cx: number, cy: number): string => m.rows[cy]?.[cx] ?? '#';
export const size = (m: Mountain) => ({ w: m.rows[0].length, h: m.rows.length });
export const cellIndex = (m: Mountain, cx: number, cy: number) => cy * m.rows[0].length + cx;

/** Every tile holding one of these characters. */
export function cellsWith(m: Mountain, chars: string): [number, number][] {
  const out: [number, number][] = [];
  m.rows.forEach((row, cy) => [...row].forEach((c, cx) => chars.includes(c) && out.push([cx, cy])));
  return out;
}
