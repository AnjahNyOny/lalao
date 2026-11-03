import { cellIndex, groundAt, LEVELS, type MiarakaAction, type MiarakaState, type Role } from '.';

/**
 * A way through each level, for each animal: walk to a point, charge
 * (facing, radians), wait for something, or (zebu) go and stun the fosa.
 * The tests play them to prove every level can be finished; scripts/verify
 * plays them in two browsers.
 */
export type Step =
  /** Walk there; if `ok` stops holding on the way (a timed gate shut), go back to step `retry`. */
  | { go: [number, number]; ok?: (s: MiarakaState) => boolean; retry?: number }
  | { charge: number }
  | { wait: (s: MiarakaState) => boolean; why: string }
  /** Zebu: chase the fosa and charge it, again and again, until `until` holds. */
  | { guard: (s: MiarakaState) => boolean; why: string };

const EAST = Math.PI / 2;
const SOUTH = 0;
const NORTH = Math.PI;
const cell = (level: number, cx: number, cz: number) => cellIndex(LEVELS[level], cx, cz);
const avatar = (s: MiarakaState, role: Role) => s.avatars.find((a) => a.role === role)!;
const at = (role: Role, x: number, z: number) => (s: MiarakaState) => Math.hypot(avatar(s, role).x - x, avatar(s, role).z - z) < 0.1;
/** That foe is far from a row (or stunned): time to cross it. */
const awayFromRow = (k: number, z: number) => (s: MiarakaState) => Math.abs(s.foes[k].z - z) > 3 || s.foes[k].stun > 1500;
/** The bat has just flown past a row, going away from it. */
const batPast = (k: number, z: number) => (s: MiarakaState) => {
  const dz = s.foes[k].z - z;
  return Math.abs(dz) > 0.8 && Math.sign(dz) === s.foes[k].dir;
};
const stunned = (k: number) => (s: MiarakaState) => s.foes[k].stun > 1200;
/** The timed gate is open, or the zebu is through it. */
const gateB = (s: MiarakaState) => s.open.includes('b') || avatar(s, 'zebu').x > 12.9;
const end: Step = { wait: (s) => s.cleared !== null || s.won, why: 'le trésor' };

export const SOLUTIONS: Record<Role, Step[]>[] = [
  // 1. Le trésor des Tsingy
  {
    maki: [
      { wait: (s) => s.broken.includes(cell(0, 7, 7)), why: 'le zébu casse le mur' },
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
      { wait: awayFromRow(0, 7.5), why: 'le crocodile s’éloigne' },
      { go: [24.5, 7.5] },
      { go: [25.5, 3.5] },
      { go: [26.5, 2.5] },
      { go: [26.5, 1.5] },
      { go: [26.5, 3.5] },
      { go: [28.5, 7.5] },
      { wait: (s) => s.doors.length > 0, why: 'la porte s’ouvre' },
      { go: [30.5, 7.5] },
      { go: [31.5, 3.5] },
      end,
    ],
    zebu: [
      { go: [5.5, 7.5] },
      { go: [6.4, 7.5] },
      { charge: EAST },
      { wait: (s) => s.broken.includes(cell(0, 7, 7)), why: 'le mur cède' },
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
      { wait: awayFromRow(0, 7.5), why: 'le crocodile s’éloigne' },
      { go: [24.5, 7.5] },
      { wait: (s) => s.doors.length > 0, why: 'le maki ouvre la porte' },
      { go: [30.5, 7.5] },
      { go: [31.5, 11.5] },
      end,
    ],
  },
  // 2. La grotte de l'Ankarana
  {
    maki: [
      { go: [6.5, 2.5] },
      { wait: (s) => s.levers.includes('a'), why: 'les trois dalles en même temps' },
      { go: [8.5, 7.5] },
      { go: [10.5, 7.5] },
      { go: [11.5, 3.5] },
      { go: [13.5, 3.5] },
      { wait: (s) => s.open.includes('e'), why: 'le zébu sur la dalle lourde' },
      { wait: batPast(0, 3.5), why: 'la chauve-souris passe' },
      { go: [18.5, 3.5] },
      { go: [18.5, 5.5] },
      { wait: (s) => s.broken.includes(cell(1, 19, 10)), why: 'le zébu passe le pont et casse le mur' },
      { go: [18.5, 1.5] },
      { go: [21.5, 1.5] },
      { go: [18.5, 1.5] },
      { go: [18.5, 3.5] },
      { go: [21.5, 4.5] },
      { go: [21.5, 10.5] },
      { wait: (s) => s.doors.length > 0, why: 'la porte s’ouvre' },
      { go: [23.5, 10.5] },
      { go: [27.5, 3.5] },
      end,
    ],
    zebu: [
      { go: [2.5, 5.5] },
      { charge: EAST },
      { go: [3.5, 5.5] },
      { charge: EAST },
      { go: [6.5, 12.5] },
      { wait: (s) => s.levers.includes('a'), why: 'les trois dalles en même temps' },
      { go: [8.5, 7.5] },
      { go: [10.5, 7.5] },
      { go: [10.5, 2.2] },
      { wait: (s) => s.open.includes('b'), why: 'le levier minuté' },
      { go: [11.5, 12.5], ok: gateB, retry: 8 },
      { go: [13.5, 12.5], ok: gateB, retry: 8 },
      { go: [14.5, 8.5] },
      { wait: (s) => avatar(s, 'maki').x > 18.2, why: 'le maki passe la grille' },
      { wait: (s) => s.open.includes('c'), why: 'le maki sur la dalle du pont' },
      { go: [15.5, 10.5] },
      { go: [18.5, 10.5] },
      { charge: EAST },
      { wait: (s) => s.broken.includes(cell(1, 19, 10)), why: 'le mur cède' },
      { go: [20.5, 10.5] },
      { wait: (s) => s.doors.length > 0, why: 'le maki ouvre la porte' },
      { go: [23.5, 10.5] },
      { go: [27.5, 11.5] },
      end,
    ],
  },
  // 3. Les gorges du Manambolo
  {
    maki: [
      { wait: at('zebu', 5.5, 2.5), why: 'le zébu sous le levier' },
      { go: [5.5, 2.5] },
      { go: [5.5, 1.5] },
      { wait: (s) => s.levers.includes('a'), why: 'le levier' },
      { go: [6.5, 2.5] },
      { go: [8.5, 7.5] },
      { go: [10.5, 7.5] },
      { go: [11.5, 5.5] },
      { go: [14.5, 5.5] },
      { go: [17.5, 3.5] },
      { go: [19.5, 3.5] },
      { go: [21.5, 3.5] },
      { go: [22.5, 10.5] },
      { wait: (s) => avatar(s, 'zebu').x > 21.2, why: 'le zébu passe le pont' },
      { go: [24.5, 7.5] },
      { wait: (s) => s.doors.length > 0, why: 'la porte s’ouvre' },
      { go: [26.5, 7.5] },
      { go: [31.5, 3.5] },
      end,
    ],
    zebu: [
      { go: [5.5, 2.5] },
      { wait: (s) => s.levers.includes('a'), why: 'le maki sur ton dos' },
      { go: [8.5, 7.5] },
      { go: [10.5, 7.5] },
      { charge: EAST },
      { wait: (s) => s.crates[0].sunk, why: 'la caisse coule' },
      { go: [10.5, 10.5] },
      { go: [11.5, 10.5] },
      { charge: NORTH },
      { go: [11.5, 9.5] },
      { charge: NORTH },
      { go: [10.5, 9.5] },
      { go: [10.5, 7.5] },
      { charge: EAST },
      { go: [11.5, 7.5] },
      { charge: EAST },
      { wait: (s) => s.crates[1].sunk, why: 'le gué est fait' },
      { wait: awayFromRow(0, 7.5), why: 'le crocodile s’éloigne' },
      { go: [15.5, 7.5] },
      { go: [17.5, 11.5] },
      { wait: (s) => s.open.includes('d'), why: 'le maki sur la dalle du pont' },
      { wait: awayFromRow(1, 11.5), why: 'le crocodile s’éloigne' },
      { go: [21.5, 11.5] },
      { go: [24.5, 7.5] },
      { wait: (s) => s.doors.length > 0, why: 'le maki ouvre la porte' },
      { go: [26.5, 7.5] },
      { go: [31.5, 11.5] },
      end,
    ],
  },
  // 4. La forêt de Kirindy
  {
    maki: [
      { wait: (s) => s.open.includes('a'), why: 'la caisse sur la dalle lourde' },
      { go: [9.5, 7.5] },
      { go: [11.5, 7.5] },
      { wait: stunned(0), why: 'le zébu étourdit le fosa' },
      { go: [12.5, 8.5] },
      { go: [12.5, 12.5] },
      { go: [13.5, 12.5] },
      { wait: (s) => s.levers.includes('b'), why: 'les deux dalles en même temps' },
      { wait: stunned(0), why: 'le zébu étourdit le fosa' },
      { go: [12.5, 12.5] },
      { go: [12.5, 8.5] },
      { go: [13.5, 5.5] },
      { go: [15.5, 4.5] },
      { go: [16.5, 3.5] },
      { go: [16.5, 2.5] },
      { go: [17.5, 1.5] },
      { go: [18.5, 1.5] },
      { wait: stunned(0), why: 'le zébu étourdit le fosa' },
      { go: [21.5, 1.5] },
      { go: [21.5, 7.5] },
      { go: [23.5, 7.5] },
      { go: [23.5, 4.5] },
      { wait: awayFromRow(1, 4.5), why: 'le crocodile s’éloigne' },
      { go: [26.5, 4.5] },
      { go: [27.5, 3.2] },
      { go: [28.5, 3.5] },
      { wait: (s) => s.doors.length > 0, why: 'la porte s’ouvre' },
      { go: [30.5, 3.5] },
      { go: [31.5, 3.5] },
      end,
    ],
    zebu: [
      { go: [3.5, 4.5] },
      { charge: EAST },
      { go: [4.5, 4.5] },
      { charge: EAST },
      { wait: (s) => s.open.includes('a'), why: 'la caisse sur la dalle lourde' },
      { go: [9.5, 7.5] },
      { go: [11.5, 7.5] },
      { guard: stunned(0), why: 'étourdir le fosa' },
      { go: [19.5, 12.5] },
      { wait: (s) => s.levers.includes('b'), why: 'les deux dalles en même temps' },
      { guard: (s) => avatar(s, 'maki').x > 22.5, why: 'garder le fosa loin du maki' },
      { go: [21.5, 7.5] },
      { go: [23.5, 7.5] },
      { go: [23.5, 10.5] },
      { wait: (s) => s.open.includes('d'), why: 'le maki tire le levier du pont' },
      { wait: awayFromRow(1, 11.5), why: 'le crocodile s’éloigne' },
      { go: [23.5, 11.5] },
      { go: [26.5, 11.5] },
      { go: [27.5, 12.5] },
      { charge: SOUTH },
      { wait: (s) => s.broken.includes(cell(3, 27, 13)), why: 'le mur cède' },
      { go: [27.5, 14.2] },
      { go: [28.5, 12.5] },
      { wait: (s) => s.doors.length > 1, why: 'la deuxième porte' },
      { go: [30.5, 12.5] },
      { go: [31.5, 12.5] },
      end,
    ],
  },
];

/** Where a seat is in its plan. */
export interface Progress {
  level?: number;
  step: number;
}

/** Zebu: towards the nearest awake fosa, charging it once close. */
function hunt(s: MiarakaState, seat: number, maxStep: number): MiarakaAction | null {
  const a = s.avatars[seat];
  const l = LEVELS[s.level];
  let target: { x: number; z: number } | undefined;
  let best = Infinity;
  l.foes.forEach((def, k) => {
    const f = s.foes[k];
    const d = Math.hypot(f.x - a.x, f.z - a.z);
    if (def.kind === 'fosa' && f.stun <= 0 && d < best) [target, best] = [f, d];
  });
  if (!target) return null;
  const f = Math.atan2(target.x - a.x, target.z - a.z);
  if (best < 1.3) return a.cool > 0 ? null : { type: 'charge', f };
  return toward(s, seat, target.x, target.z, Math.min(maxStep, best - 1.1));
}

function toward(s: MiarakaState, seat: number, tx: number, tz: number, maxStep: number): MiarakaAction {
  const a = s.avatars[seat];
  const d = Math.hypot(tx - a.x, tz - a.z);
  const k = Math.min(maxStep, d) / d;
  const x = a.x + (tx - a.x) * k;
  const z = a.z + (tz - a.z) * k;
  const ground = groundAt(s, a.role, x, z);
  // Over water, or across a gap towards higher ground, the maki is in mid-jump; the zebu would fall in (and the tests would see it).
  const leap = a.role === 'maki' && (ground < 0 || (ground < a.y && groundAt(s, a.role, tx, tz) > a.y));
  const y = leap ? Math.max(a.y, 1) : ground;
  return { type: 'move', x, y, z, f: Math.atan2(tx - a.x, tz - a.z), s: a.sync };
}

/**
 * The next action for a seat following its level's plan, or null while it
 * waits. Moves `maxStep` cells at most per call, at the height it reaches.
 */
export function nextAction(s: MiarakaState, seat: number, at: Progress, maxStep = 0.2): MiarakaAction | null {
  if (at.level !== s.level) Object.assign(at, { level: s.level, step: 0 });
  const a = s.avatars[seat];
  const plan = SOLUTIONS[s.level][a.role];
  for (let guard = 0; guard < plan.length && at.step < plan.length; guard++) {
    const step = plan[at.step];
    if ('wait' in step) {
      if (!step.wait(s)) return null;
      at.step++;
      continue;
    }
    if ('guard' in step) {
      if (step.guard(s)) {
        at.step++;
        continue;
      }
      return hunt(s, seat, maxStep);
    }
    if ('charge' in step) {
      if (a.cool > 0) return null;
      at.step++;
      return { type: 'charge', f: step.charge };
    }
    if (step.ok && !step.ok(s)) {
      at.step = step.retry ?? at.step;
      continue;
    }
    const [tx, tz] = step.go;
    if (Math.hypot(tx - a.x, tz - a.z) < 0.05) {
      at.step++;
      continue;
    }
    return toward(s, seat, tx, tz, maxStep);
  }
  return null;
}
