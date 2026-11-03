import type { GameDefinition, GameOption, PlayerId } from '@game/core';
import { cellIndex, cellsWith, charAt, isSwitch, isTarget, LEVELS, type LevelDef } from './level';

export * from './level';

/**
 * Miaraka (« ensemble »): a maki and a zebu cross the Tsingy to a treasure,
 * in real time. The maki jumps high, the zebu charges and breaks things; most
 * obstacles need one or the other, some both at once.
 *
 * Each player's device moves its own avatar with `step` (the same code runs
 * here) and reports where it is; the server checks the report (speed,
 * walls, what that animal can reach) and runs the world: switches, gates,
 * pickups, the crocodile, the end. Co-op has no one to cheat against, and
 * a phone in Madagascar talking to a server far away couldn't platform with
 * every step waiting for the server.
 */

export type Role = 'maki' | 'zebu';

export const ROLE_INFO: Record<Role, { speed: number; radius: number; reach: number }> = {
  /** Fast, and jumps up onto ledges. */
  maki: { speed: 4.4, radius: 0.28, reach: 2.3 },
  /** Slower, can't jump, but charges. */
  zebu: { speed: 3.4, radius: 0.36, reach: 0.4 },
};

/** Physics, in cells (1 cell = 1 unit) and seconds. */
export const PHYS = {
  gravity: 20,
  /** Reaches a 2-unit height: enough for a 1.5 ledge. */
  jump: Math.sqrt(2 * 20 * 2),
  /** Walls lower than this above the feet are stepped over. */
  stepUp: 0.3,
  ledge: 1.5,
  crate: 1,
  water: -0.8,
  /** Feet below this: in the water. */
  drown: -0.35,
  dashSpeed: 7.5,
  dashTime: 0.35,
  dashCool: 0.9,
} as const;

const WALL = 99;
/** How close (horizontally) to pick something up or touch a switch. */
const TOUCH = 0.62;
const CROC_SPEED = 1.6;
const CROC_BITE = 0.75;
const STUN_MS = 3000;
const PADS_MS = 1000;
const FX_KEPT = 12;

export interface Avatar {
  role: Role;
  x: number;
  y: number;
  z: number;
  /** Facing, radians: direction (sin f, cos f) in x/z. */
  f: number;
  /** Bumped whenever the server moves the avatar itself (respawn, refused report): the device then snaps to it. */
  sync: number;
  /** Game time of the last accepted report. */
  at: number;
  /** Where it comes back after a fall or a bite. */
  check: [number, number];
  /** Zebu: time before the next charge, ms. */
  cool: number;
}

export interface Croc {
  x: number;
  z: number;
  /** Swimming towards `to` (1) or back towards `from` (-1). */
  dir: 1 | -1;
  stun: number;
}

/** Something to show or play: a wall breaking, a pickup… */
export interface Fx {
  n: number;
  t: 'break' | 'push' | 'pick' | 'key' | 'door' | 'lever' | 'splash' | 'bite' | 'stun' | 'check' | 'treasure';
  x: number;
  z: number;
}

export interface MiarakaState {
  level: number;
  players: PlayerId[];
  /** One per seat. */
  avatars: Avatar[];
  /** ms since the start. */
  time: number;
  /** Time limit in ms, or null. */
  limit: number | null;
  broken: number[];
  levers: string[];
  /** Groups whose gate or bridge is open right now. */
  open: string[];
  crates: [number, number][];
  /** Keys carried by the pair. */
  keys: number;
  /** Keys and vanilla pods already taken (cell indices). */
  picked: number[];
  doors: number[];
  vanilla: number;
  crocs: Croc[];
  /** How long both have stood on the treasure pads. */
  pads: number;
  fx: Fx[];
  won: boolean;
  lost: boolean;
}

export type MiarakaAction =
  | { type: 'move'; x: number; y: number; z: number; f: number; s: number }
  | { type: 'charge'; f: number };

const levelOf = (s: { level: number }) => LEVELS[s.level];
export const vanillaTotal = (l: LevelDef) => cellsWith(l, '*+').length;

/** Top of whatever fills a cell right now: floor 0, ledge, crate, water, or WALL. */
export function heightAt(s: MiarakaState, cx: number, cz: number): number {
  const l = levelOf(s);
  if (s.crates.some(([x, z]) => x === cx && z === cz)) return PHYS.crate;
  const c = charAt(l, cx, cz);
  const i = cellIndex(l, cx, cz);
  if (c === '#') return WALL;
  if (c === 'x') return s.broken.includes(i) ? 0 : WALL;
  if (c === '|') return s.doors.includes(i) ? 0 : WALL;
  if (c === '~') return PHYS.water;
  if (c === '^' || c === 'K' || c === '+') return PHYS.ledge;
  if (isTarget(c)) {
    const group = l.groups[c.toLowerCase()];
    const open = s.open.includes(c.toLowerCase());
    if (group?.target === 'bridge') return open ? 0 : PHYS.water;
    return open ? 0 : WALL;
  }
  if (isSwitch(c) && l.groups[c]?.ledge) return PHYS.ledge;
  return 0;
}

const cellCentre = (cx: number, cz: number): [number, number] => [cx + 0.5, cz + 0.5];
const near = (a: { x: number; z: number }, cx: number, cz: number, d: number) => Math.hypot(a.x - cx - 0.5, a.z - cz - 0.5) < d;

/** A body being moved on a device: the avatar plus what only the mover needs. */
export interface Body {
  x: number;
  y: number;
  z: number;
  vy: number;
  f: number;
  grounded: boolean;
  /** Seconds of charge left, and before the next one. */
  dash: number;
  cool: number;
}

export interface Input {
  /** Stick, length up to 1: x east, z south. */
  mx: number;
  mz: number;
  /** Pressed this frame. */
  jump: boolean;
  charge: boolean;
}

export const bodyOf = (a: Avatar): Body => ({ x: a.x, y: a.y, z: a.z, vy: 0, f: a.f, grounded: true, dash: 0, cool: 0 });

/** Pushes a circle out of every cell too high to step onto. */
function collide(s: MiarakaState, b: Body, r: number): void {
  const cx0 = Math.floor(b.x);
  const cz0 = Math.floor(b.z);
  for (let cz = cz0 - 1; cz <= cz0 + 1; cz++) {
    for (let cx = cx0 - 1; cx <= cx0 + 1; cx++) {
      if (heightAt(s, cx, cz) <= b.y + PHYS.stepUp) continue;
      const px = Math.max(cx, Math.min(b.x, cx + 1));
      const pz = Math.max(cz, Math.min(b.z, cz + 1));
      const dx = b.x - px;
      const dz = b.z - pz;
      const d = Math.hypot(dx, dz);
      if (d >= r) continue;
      if (d > 1e-6) {
        b.x = px + (dx / d) * r;
        b.z = pz + (dz / d) * r;
      } else {
        // Centre inside the cell: out by the nearest side.
        const out = [b.x - cx, cx + 1 - b.x, b.z - cz, cz + 1 - b.z];
        const k = out.indexOf(Math.min(...out));
        if (k === 0) b.x = cx - r;
        else if (k === 1) b.x = cx + 1 + r;
        else if (k === 2) b.z = cz - r;
        else b.z = cz + 1 + r;
      }
    }
  }
}

/**
 * One frame of an avatar's movement, `dt` in seconds. Runs on the device that
 * owns the avatar; the server checks the result. `charged` says a charge just
 * started, which the device then reports.
 */
export function step(s: MiarakaState, role: Role, body: Body, input: Input, dt: number): { body: Body; charged: boolean } {
  const b = { ...body };
  const info = ROLE_INFO[role];
  let charged = false;
  b.cool = Math.max(0, b.cool - dt);
  b.dash = Math.max(0, b.dash - dt);
  if (role === 'zebu' && input.charge && b.cool <= 0) {
    b.dash = PHYS.dashTime;
    b.cool = PHYS.dashCool;
    charged = true;
  }
  const len = Math.hypot(input.mx, input.mz);
  let vx = 0;
  let vz = 0;
  if (b.dash > 0) {
    vx = Math.sin(b.f) * PHYS.dashSpeed;
    vz = Math.cos(b.f) * PHYS.dashSpeed;
  } else if (len > 0.1) {
    const k = Math.min(1, len) / len;
    vx = input.mx * k * info.speed;
    vz = input.mz * k * info.speed;
    b.f = Math.atan2(input.mx, input.mz);
  }
  // Small sub-steps, so a fast charge doesn't go through a wall.
  const n = Math.max(1, Math.ceil((Math.hypot(vx, vz) * dt) / 0.15));
  for (let i = 0; i < n; i++) {
    b.x += (vx * dt) / n;
    b.z += (vz * dt) / n;
    collide(s, b, info.radius);
  }
  const ground = heightAt(s, Math.floor(b.x), Math.floor(b.z));
  if (b.grounded && input.jump && role === 'maki') {
    b.vy = PHYS.jump;
    b.grounded = false;
  }
  b.vy -= PHYS.gravity * dt;
  b.y += b.vy * dt;
  if (b.y <= ground) {
    b.y = ground;
    b.vy = 0;
    b.grounded = true;
  } else if (b.y > ground + 0.02) {
    b.grounded = false;
  }
  // Fallen in the water: wait there for the server to bring it back.
  b.y = Math.max(b.y, PHYS.water);
  return { body: b, charged };
}

/** Mutable copy for one tick or action. */
function copy(state: MiarakaState): MiarakaState {
  return {
    ...state,
    avatars: state.avatars.map((a) => ({ ...a, check: [...a.check] as [number, number] })),
    broken: state.broken.slice(),
    levers: state.levers.slice(),
    open: state.open.slice(),
    crates: state.crates.map((c) => [...c] as [number, number]),
    picked: state.picked.slice(),
    doors: state.doors.slice(),
    crocs: state.crocs.map((c) => ({ ...c })),
    fx: state.fx.slice(),
  };
}

function fx(s: MiarakaState, t: Fx['t'], x: number, z: number): void {
  const n = (s.fx[s.fx.length - 1]?.n ?? 0) + 1;
  s.fx.push({ n, t, x, z });
  if (s.fx.length > FX_KEPT) s.fx.shift();
}

function respawn(s: MiarakaState, a: Avatar, why: Fx['t']): void {
  fx(s, why, a.x, a.z);
  [a.x, a.z] = a.check;
  a.y = 0;
  a.sync++;
  a.at = s.time;
}

/** Is a cell free to push a crate onto: bare floor, nobody standing there. */
function freeFloor(s: MiarakaState, cx: number, cz: number): boolean {
  if (heightAt(s, cx, cz) !== 0) return false;
  return !s.avatars.some((a) => Math.floor(a.x) === cx && Math.floor(a.z) === cz);
}

function tick(state: MiarakaState, dtMs: number): MiarakaState {
  if (state.won || state.lost) return state;
  const s = copy(state);
  const l = levelOf(s);
  s.time += dtMs;
  if (s.limit !== null && s.time >= s.limit) {
    s.lost = true;
    return s;
  }
  for (const a of s.avatars) a.cool = Math.max(0, a.cool - dtMs);

  // Switches: plates while weighed down, levers for good.
  const pressed = new Set<string>();
  for (const [g, group] of Object.entries(l.groups)) {
    for (const [cx, cz] of cellsWith(l, g)) {
      if (group.switch === 'lever') {
        const base = group.ledge ? PHYS.ledge : 0;
        if (!s.levers.includes(g) && s.avatars.some((a) => near(a, cx, cz, TOUCH + 0.15) && Math.abs(a.y - base) < 0.7)) {
          s.levers.push(g);
          fx(s, 'lever', cx + 0.5, cz + 0.5);
        }
        continue;
      }
      const crate = s.crates.some(([x, z]) => x === cx && z === cz);
      const someone = s.avatars.some(
        (a) => (group.switch === 'plate' || a.role === 'zebu') && Math.floor(a.x) === cx && Math.floor(a.z) === cz && a.y < 0.3,
      );
      if (crate || someone) pressed.add(g);
    }
  }
  const was = new Set(s.open);
  s.open = Object.keys(l.groups).filter((g) => {
    if (pressed.has(g) || s.levers.includes(g)) return true;
    // Never shut a gate on someone standing in it.
    return was.has(g) && cellsWith(l, g.toUpperCase()).some(([cx, cz]) => s.avatars.some((a) => Math.floor(a.x) === cx && Math.floor(a.z) === cz));
  });

  for (const a of s.avatars) {
    // Keys and vanilla.
    for (const [cx, cz] of cellsWith(l, 'kK*+')) {
      const i = cellIndex(l, cx, cz);
      const c = charAt(l, cx, cz);
      const base = c === 'K' || c === '+' ? PHYS.ledge : 0;
      if (s.picked.includes(i) || !near(a, cx, cz, TOUCH) || Math.abs(a.y - base) > 0.8) continue;
      s.picked.push(i);
      if (c === 'k' || c === 'K') {
        s.keys++;
        fx(s, 'key', cx + 0.5, cz + 0.5);
      } else {
        s.vanilla++;
        fx(s, 'pick', cx + 0.5, cz + 0.5);
      }
    }
    // A key opens the door it touches.
    for (const [cx, cz] of cellsWith(l, '|')) {
      const i = cellIndex(l, cx, cz);
      if (s.keys > 0 && !s.doors.includes(i) && near(a, cx, cz, 1.05)) {
        s.doors.push(i);
        s.keys--;
        fx(s, 'door', cx + 0.5, cz + 0.5);
      }
    }
    for (const [cx, cz] of cellsWith(l, '!')) {
      if (near(a, cx, cz, 0.8) && (a.check[0] !== cx + 0.5 || a.check[1] !== cz + 0.5)) {
        a.check = cellCentre(cx, cz);
        fx(s, 'check', cx + 0.5, cz + 0.5);
      }
    }
    if (a.y < PHYS.drown) respawn(s, a, 'splash');
  }

  // The crocodile swims its beat, and bites whoever is down at its level.
  l.crocs.forEach((beat, k) => {
    const c = s.crocs[k];
    if (c.stun > 0) c.stun = Math.max(0, c.stun - dtMs);
    else {
      const [tx, tz] = c.dir > 0 ? beat.to : beat.from;
      const d = Math.hypot(tx - c.x, tz - c.z);
      const move = (CROC_SPEED * dtMs) / 1000;
      if (d <= move) {
        c.x = tx;
        c.z = tz;
        c.dir = c.dir > 0 ? -1 : 1;
      } else {
        c.x += ((tx - c.x) / d) * move;
        c.z += ((tz - c.z) / d) * move;
      }
    }
    if (c.stun > 0) return;
    for (const a of s.avatars) if (Math.hypot(a.x - c.x, a.z - c.z) < CROC_BITE && a.y < 0.4) respawn(s, a, 'bite');
  });

  // Both on the treasure pads, each on their own, for a moment.
  const pads = cellsWith(l, 'T');
  const onPad = s.avatars.map((a) => pads.findIndex(([cx, cz]) => near(a, cx, cz, 0.5) && a.y < 0.3));
  if (onPad.every((p) => p >= 0) && new Set(onPad).size === s.avatars.length) {
    s.pads += dtMs;
    if (s.pads >= PADS_MS) {
      s.won = true;
      fx(s, 'treasure', ...l.chest);
    }
  } else s.pads = 0;
  return s;
}

/** The zebu's charge: breaks the cracked wall ahead, pushes a crate a cell, stuns the crocodile. */
function charge(s: MiarakaState, a: Avatar, f: number): void {
  a.cool = PHYS.dashCool * 1000 - 100;
  a.f = f;
  const dx = Math.sin(f);
  const dz = Math.cos(f);
  const l = levelOf(s);
  for (const reach of [0.75, 1.3]) {
    const cx = Math.floor(a.x + dx * reach);
    const cz = Math.floor(a.z + dz * reach);
    const i = cellIndex(l, cx, cz);
    if (charAt(l, cx, cz) === 'x' && !s.broken.includes(i)) {
      s.broken.push(i);
      fx(s, 'break', cx + 0.5, cz + 0.5);
      break;
    }
    const crate = s.crates.find(([x, z]) => x === cx && z === cz);
    if (crate) {
      // Straight along the main direction of the charge.
      const [sx, sz] = Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)];
      if (freeFloor(s, cx + sx, cz + sz)) {
        crate[0] += sx;
        crate[1] += sz;
        fx(s, 'push', crate[0] + 0.5, crate[1] + 0.5);
      }
      break;
    }
  }
  for (const c of s.crocs) {
    const ox = c.x - a.x;
    const oz = c.z - a.z;
    if (Math.hypot(ox, oz) < 1.8 && ox * dx + oz * dz > 0) {
      c.stun = STUN_MS;
      fx(s, 'stun', c.x, c.z);
    }
  }
}

/** Is a device's report believable: not too far, not in a wall, not higher than that animal can get. */
function believable(s: MiarakaState, a: Avatar, m: Extract<MiarakaAction, { type: 'move' }>): boolean {
  const info = ROLE_INFO[a.role];
  const speed = a.role === 'zebu' ? PHYS.dashSpeed : info.speed;
  const seconds = (s.time - a.at) / 1000;
  if (Math.hypot(m.x - a.x, m.z - a.z) > speed * (seconds + 0.25) * 1.3 + 0.3) return false;
  const top = heightAt(s, Math.floor(m.x), Math.floor(m.z));
  if (top >= WALL || m.y < top - PHYS.stepUp - 0.05) return false;
  // Up only as far as that animal jumps from where it was: the zebu never gets onto a ledge.
  return m.y <= a.y + info.reach;
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function isAction(a: unknown): a is MiarakaAction {
  if (typeof a !== 'object' || a === null) return false;
  const m = a as Record<string, unknown>;
  if (m.type === 'charge') return finite(m.f);
  return m.type === 'move' && finite(m.x) && finite(m.y) && finite(m.z) && finite(m.f) && Number.isInteger(m.s);
}

export const MIARAKA_OPTIONS: GameOption[] = [
  {
    id: 'chrono',
    label: 'Chrono',
    default: 'off',
    choices: [
      { value: 'off', label: 'Sans chrono', hint: 'Prenez votre temps : le trésor attend.' },
      { value: '10', label: '10 min', hint: 'Le trésor avant 10 minutes, sinon c’est perdu.' },
      { value: '6', label: '6 min', hint: 'Pour les pros : 6 minutes, pas une de plus.' },
    ],
  },
];

export const miaraka: GameDefinition<MiarakaState, MiarakaAction> = {
  id: 'miaraka',
  name: 'Miaraka',
  minPlayers: 2,
  maxPlayers: 2,
  options: MIARAKA_OPTIONS,
  pieces: [
    { id: 'maki', label: 'Maki · saute très haut' },
    { id: 'zebu', label: 'Zébu · fonce et casse' },
  ],

  setup(players, _seed, options = {}, pieces = []) {
    const l = LEVELS[0];
    // Each picks an animal in the lobby; without a clear choice, the first seat is the maki.
    const roles: Role[] = pieces[0] === 'zebu' || pieces[1] === 'maki' ? ['zebu', 'maki'] : ['maki', 'zebu'];
    const start = (role: Role) => cellCentre(...cellsWith(l, role === 'maki' ? 'm' : 'z')[0]);
    const minutes = Number(options.chrono);
    return {
      level: 0,
      players,
      avatars: roles.map((role) => {
        const [x, z] = start(role);
        return { role, x, y: 0, z, f: Math.PI / 2, sync: 0, at: 0, check: [x, z] as [number, number], cool: 0 };
      }),
      time: 0,
      limit: minutes > 0 ? minutes * 60_000 : null,
      broken: [],
      levers: [],
      open: [],
      crates: cellsWith(l, '&'),
      keys: 0,
      picked: [],
      doors: [],
      vanilla: 0,
      crocs: l.crocs.map((c) => ({ x: c.from[0], z: c.from[1], dir: 1, stun: 0 })),
      pads: 0,
      fx: [],
      won: false,
      lost: false,
    };
  },

  validate(s, action, by): action is MiarakaAction {
    if (s.won || s.lost || !isAction(action)) return false;
    const seat = s.players.indexOf(by);
    if (seat < 0) return false;
    // Only the zebu charges; a charge too soon is the device being early: ignored, not an error.
    return action.type === 'move' || s.avatars[seat].role === 'zebu';
  },

  apply(state, action, by) {
    const s = copy(state);
    const a = s.avatars[s.players.indexOf(by)];
    if (action.type === 'charge') {
      if (a.cool <= 0) charge(s, a, action.f);
      return s;
    }
    // A report from before the last snap: the device hasn't caught up yet.
    if (action.s !== a.sync) return state;
    if (!believable(s, a, action)) {
      a.sync++;
      return s;
    }
    a.x = action.x;
    a.y = action.y;
    a.z = action.z;
    a.f = action.f;
    a.at = s.time;
    return s;
  },

  tick,

  result(s) {
    if (s.won) return { kind: 'win', winners: s.players };
    if (s.lost) return { kind: 'lose' };
    return null;
  },
};

