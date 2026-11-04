import { cellsWith, MOUNTAIN, PHYS, type TadyMove, type TadyState } from '.';

/**
 * A way up the mountain, as body centres in the air above each foothold.
 * The server doesn't check gravity, so following it proves the route has no
 * dead end and that the flow (camps, orchids, summit) works; the tests check
 * the moves it stands for (jumps, a partner's head, climbing together) with
 * the real physics. scripts/verify follows it in two browsers.
 */
export const ROUTE: [number, number][] = [
  // 1. La forêt de Morarano
  [5.5, 101.4],
  [7.5, 101.4],
  [8.5, 99.4],
  [10.5, 99.4],
  [11.5, 96.4],
  [13.5, 96.4],
  [15.5, 95.4],
  [17.5, 95.4],
  [17.5, 97.5],
  [17.5, 95.4],
  [20, 96.4],
  [20, 89.6],
  [22.2, 89.6],
  [22.2, 90.5],
  [21.5, 88],
  [17, 88],
  [17, 88.5],
  [17, 86],
  [20.5, 86],
  [20.5, 86.5],
  [20.5, 84],
  [15.5, 84],
  [15.5, 82.5],
  // 2. Les dalles de granite
  [16.5, 82.5],
  [16.5, 79.4],
  [17.5, 79.4],
  [17.5, 73.4],
  [19.5, 73.4],
  [19.5, 67.4],
  [21.5, 67.4],
  [21.5, 65],
  [16.5, 65],
  [16.5, 65.5],
  [16.5, 63],
  [10.5, 63],
  [10.5, 63.5],
  [10.5, 61.5],
  [2.5, 61.5],
  // 3. Le col du vent
  [2.5, 59],
  [8, 59],
  [8, 59.5],
  [8, 57],
  [12, 57],
  [12, 57.5],
  [12, 55],
  [16, 55],
  [16, 55.5],
  [18.5, 55.5],
  [18.5, 53.5],
  [21.5, 53.5],
  [21.5, 51],
  [14.5, 51],
  [14.5, 51.5],
  [14.5, 49],
  [8.5, 49],
  [8.5, 49.5],
  [8.5, 47.5],
  [2.5, 47.5],
  [2.5, 45],
  [10, 45],
  [10, 45.5],
  [10, 43],
  [17.5, 43],
  [17.5, 43.5],
  [17.5, 37.4],
  [21.5, 37.4],
  // 4. Le Pic Boby
  [21.5, 35],
  [15.5, 35],
  [15.5, 35.5],
  [15.5, 33],
  [10.5, 33],
  [10.5, 33.5],
  [7.5, 33.5],
  [7.5, 26.4],
  [5.5, 26.4],
  [5.5, 26.5],
  [8, 26],
  [11.5, 26],
  [11.5, 26.5],
  [11.5, 24],
  [16.5, 24],
  [16.5, 24.5],
  [17.5, 24.5],
  [17.5, 18.4],
  [21.5, 18.4],
  [21.5, 16],
  [14, 16],
  [14, 16.5],
  [14, 14],
  [8.5, 14],
  [8.5, 14.5],
  [8.5, 12],
  [3.5, 12],
  [3.5, 12.6],
];

/** Where each climber is along the route. */
export interface Progress {
  step: number;
}

/**
 * The next report for a seat following the route, or null while it waits
 * for its partner (the rope). Moves `maxStep` tiles at most per call; at the
 * end it grips the summit rock.
 */
export function nextAction(s: TadyState, seat: number, plans: Progress[], maxStep = 0.25): TadyMove | null {
  const c = s.climbers[seat];
  const other = s.climbers[1 - seat];
  const at = plans[seat];
  if (at.step >= ROUTE.length) return c.grab ? null : { type: 'move', x: c.x, y: c.y, vx: 0, vy: 0, g: false, h: true, r: 0, f: c.face, s: c.sync };
  // The one ahead waits once the rope is nearly taut.
  if (at.step > plans[1 - seat].step && Math.hypot(c.x - other.x, c.y - other.y) > PHYS.rope - 1.5) return null;
  // The last foothold: side by side on the summit.
  const [tx, ty] = at.step === ROUTE.length - 1 ? [ROUTE[at.step][0] + seat, ROUTE[at.step][1]] : ROUTE[at.step];
  const d = Math.hypot(tx - c.x, ty - c.y);
  if (d < 0.02) {
    at.step++;
    return nextAction(s, seat, plans, maxStep);
  }
  const k = Math.min(maxStep, d) / d;
  return { type: 'move', x: c.x + (tx - c.x) * k, y: c.y + (ty - c.y) * k, vx: 0, vy: 0, g: false, h: false, r: 0, f: tx >= c.x ? 1 : -1, s: c.sync };
}

/** The summit's tiles, for tests. */
export const SUMMIT = cellsWith(MOUNTAIN, 'S');
