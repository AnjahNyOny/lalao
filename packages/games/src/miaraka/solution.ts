import { cellIndex, heightAt, LEVELS, type MiarakaAction, type MiarakaState, type Role } from '.';

/**
 * A way through the first level, for each animal: walk to a point, charge
 * (facing, radians), or wait for something. The tests play it to prove the
 * level can be finished; scripts/verify plays it in two browsers.
 */
export type Step = { go: [number, number] } | { charge: number } | { wait: (s: MiarakaState) => boolean; why: string };

const EAST = Math.PI / 2;
const l = LEVELS[0];
const cell = (cx: number, cz: number) => cellIndex(l, cx, cz);
/** The crocodile is far enough from the bridge (row 7) to cross. */
const crocFar = (s: MiarakaState) => s.crocs.every((c) => Math.abs(c.z - 7.5) > 3 || c.stun > 1500);

export const SOLUTION: Record<Role, Step[]> = {
  maki: [
    { wait: (s) => s.broken.includes(cell(7, 7)), why: 'le zébu casse le mur' },
    { go: [6.5, 7.5] },
    { go: [9.5, 7.5] },
    { wait: (s) => s.open.includes('a'), why: 'le zébu sur la dalle lourde' },
    { go: [14.5, 5.5] },
    { go: [16.5, 5.5] },
    { go: [17.5, 3.5] },
    { go: [18.5, 3.5] },
    { go: [19.5, 2.5] },
    { go: [19.5, 4.5] },
    { wait: (s) => s.open.includes('c'), why: 'la caisse sur la dalle du pont' },
    { go: [20.5, 7.5] },
    { wait: crocFar, why: 'le crocodile s’éloigne' },
    { go: [24.5, 7.5] },
    { go: [25.5, 3.5] },
    { go: [26.5, 2.5] },
    { go: [26.5, 1.5] },
    { go: [26.5, 3.5] },
    { go: [28.5, 7.5] },
    { wait: (s) => s.doors.length > 0, why: 'la porte s’ouvre' },
    { go: [30.5, 7.5] },
    { go: [31.5, 3.5] },
    { wait: (s) => s.won, why: 'le trésor' },
  ],
  zebu: [
    { go: [5.5, 7.5] },
    { go: [6.4, 7.5] },
    { charge: EAST },
    { wait: (s) => s.broken.includes(cell(7, 7)), why: 'le mur cède' },
    { go: [9.5, 7.5] },
    { go: [11.5, 3.5] },
    { wait: (s) => s.levers.includes('b'), why: 'le maki tire le levier' },
    { go: [14.5, 9.5] },
    { go: [16.5, 9.5] },
    { go: [16.5, 10.5] },
    { charge: EAST },
    { go: [17.5, 10.5] },
    { charge: EAST },
    { wait: (s) => s.open.includes('c'), why: 'le pont descend' },
    { go: [20.5, 7.5] },
    { wait: crocFar, why: 'le crocodile s’éloigne' },
    { go: [24.5, 7.5] },
    { wait: (s) => s.doors.length > 0, why: 'le maki ouvre la porte' },
    { go: [30.5, 7.5] },
    { go: [31.5, 11.5] },
    { wait: (s) => s.won, why: 'le trésor' },
  ],
};

/** Where a seat is in its plan. */
export interface Progress {
  step: number;
}

/**
 * The next action for a seat following SOLUTION, or null while it waits.
 * Moves `maxStep` cells at most per call, at the height of the ground it reaches.
 */
export function nextAction(s: MiarakaState, seat: number, at: Progress, maxStep = 0.2): MiarakaAction | null {
  const a = s.avatars[seat];
  const plan = SOLUTION[a.role];
  for (let guard = 0; guard < plan.length && at.step < plan.length; guard++) {
    const step = plan[at.step];
    if ('wait' in step) {
      if (!step.wait(s)) return null;
      at.step++;
      continue;
    }
    if ('charge' in step) {
      if (a.cool > 0) return null;
      at.step++;
      return { type: 'charge', f: step.charge };
    }
    const [tx, tz] = step.go;
    const d = Math.hypot(tx - a.x, tz - a.z);
    if (d < 0.05) {
      at.step++;
      continue;
    }
    const k = Math.min(maxStep, d) / d;
    const x = a.x + (tx - a.x) * k;
    const z = a.z + (tz - a.z) * k;
    const y = Math.max(0, heightAt(s, Math.floor(x), Math.floor(z)));
    return { type: 'move', x, y, z, f: Math.atan2(tx - a.x, tz - a.z), s: a.sync };
  }
  return null;
}
