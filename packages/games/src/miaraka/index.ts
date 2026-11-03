import type { GameDefinition, GameOption, PlayerId } from '@game/core';
import { cellIndex, cellsWith, charAt, isSwitch, isTarget, LEVELS, type FoeDef, type FoeKind, type Group, type LevelDef } from './level';

export * from './level';

/**
 * Miaraka (« ensemble »): a maki and a zebu cross Madagascar's wild places to
 * a treasure, level after level, in real time. The maki jumps high, the zebu
 * charges and breaks things; most obstacles need one or the other, some both
 * at once.
 *
 * Each player's device moves its own avatar with `step` (the same code runs
 * here) and reports where it is; the server checks the report (speed,
 * walls, what that animal can reach) and runs the world: switches, gates,
 * pickups, the animals that bite, the end. Co-op has no one to cheat against,
 * and a phone in Madagascar talking to a server far away couldn't platform
 * with every step waiting for the server.
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
  /** Reaches a 2-unit height: enough for a 1.5 ledge, not for a 2.6 rock. */
  jump: Math.sqrt(2 * 20 * 2),
  /** Walls lower than this above the feet are stepped over. */
  stepUp: 0.3,
  ledge: 1.5,
  high: 2.6,
  crate: 1,
  /** The zebu's back, where the maki can stand: a leg up to the high rocks. */
  back: 0.9,
  backRadius: 0.42,
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
const STUN_MS = 3000;
const PADS_MS = 1000;
/** After a treasure, before the next level. */
export const NEXT_MS = 4000;
const FX_KEPT = 12;

/** How the animals that bite move, in cells per second, and how close they bite. */
export const FOES: Record<FoeKind, { speed: number; bite: number }> = {
  croc: { speed: 1.6, bite: 0.75 },
  bat: { speed: 2, bite: 0.7 },
  fosa: { speed: 1.8, bite: 0.65 },
};
const FOSA = { run: 3, see: 3.2, lose: 5, radius: 0.35, rest: 2000 };

export interface Avatar {
  role: Role;
  x: number;
  y: number;
  z: number;
  /** Facing, radians: direction (sin f, cos f) in x/z. */
  f: number;
  /** Bumped whenever the server moves the avatar itself (respawn, refused report, new level): the device then snaps to it. */
  sync: number;
  /** Game time of the last accepted report. */
  at: number;
  /** Where it comes back after a fall or a bite. */
  check: [number, number];
  /** Zebu: time before the next charge, ms. */
  cool: number;
}

export interface Foe {
  x: number;
  z: number;
  /** Heading for `to` (1) or back for `from` (-1). */
  dir: 1 | -1;
  /** Stunned (or, for the fosa, resting after a bite): ms left. */
  stun: number;
  /** Fosa: the seat it's running after, or -1. */
  hunt: number;
}

export interface Crate {
  x: number;
  z: number;
  /** Pushed into the shallows: its top is a stepping stone at ground level. */
  sunk: boolean;
  /** Where it started, and goes back to when stuck. */
  home: [number, number];
}

/** Something to show or play: a wall breaking, a pickup… */
export interface Fx {
  n: number;
  t: 'break' | 'push' | 'sink' | 'home' | 'pick' | 'key' | 'door' | 'lever' | 'splash' | 'fall' | 'bite' | 'stun' | 'check' | 'treasure';
  x: number;
  z: number;
}

export interface MiarakaState {
  level: number;
  /** The level the run ends with. */
  last: number;
  players: PlayerId[];
  /** One per seat. */
  avatars: Avatar[];
  /** ms since this level started. */
  time: number;
  /** Time limit for each level in ms, or null. */
  limit: number | null;
  broken: number[];
  /** Levers pulled, and groups of plates all pressed at once: open for good. */
  levers: string[];
  /** Timed levers: ms before each springs back; 0 once sprung, until its puller steps away. */
  timers: Record<string, number>;
  /** Plates weighed down right now (cell indices). */
  pressed: number[];
  /** Groups whose gate or bridge is open right now. */
  open: string[];
  crates: Crate[];
  /** Keys carried by the pair. */
  keys: number;
  /** Keys and vanilla pods already taken (cell indices). */
  picked: number[];
  doors: number[];
  vanilla: number;
  /** Vanilla gathered in the levels before this one. */
  bag: number;
  /** One per foe of the level, in the same order. */
  foes: Foe[];
  /** How long both have stood on the treasure pads. */
  pads: number;
  /** ms since this level's treasure opened, while the next one waits; null while playing. */
  cleared: number | null;
  fx: Fx[];
  won: boolean;
  lost: boolean;
}

export type MiarakaAction =
  | { type: 'move'; x: number; y: number; z: number; f: number; s: number }
  | { type: 'charge'; f: number };

export const levelOf = (s: { level: number }): LevelDef => LEVELS[s.level];
export const vanillaTotal = (l: LevelDef) => cellsWith(l, '*+').length;
const switchBase = (g: Group | undefined) => (g?.high ? PHYS.high : g?.ledge ? PHYS.ledge : 0);

/**
 * Top of whatever fills a cell right now: floor 0, ledge, rock, crate, water,
 * or WALL. Rotten planks hold everyone but the zebu.
 */
export function heightAt(s: MiarakaState, cx: number, cz: number, role?: Role): number {
  const l = levelOf(s);
  let sunk = false;
  for (const c of s.crates) {
    if (c.x !== cx || c.z !== cz) continue;
    if (!c.sunk) return PHYS.crate;
    sunk = true;
  }
  const c = charAt(l, cx, cz);
  const i = cellIndex(l, cx, cz);
  if (c === '#') return WALL;
  if (c === 'x') return s.broken.includes(i) ? 0 : WALL;
  if (c === '|') return s.doors.includes(i) ? 0 : WALL;
  if (c === '~' || c === '-') return sunk ? 0 : PHYS.water;
  if (c === '%') return role === 'zebu' ? PHYS.water : 0;
  if (c === '^' || c === 'K' || c === '+') return PHYS.ledge;
  if (c === 'I') return PHYS.high;
  if (isTarget(c)) {
    const group = l.groups[c.toLowerCase()];
    const open = s.open.includes(c.toLowerCase());
    if (group?.target === 'bridge') return open ? 0 : PHYS.water;
    return open ? 0 : WALL;
  }
  if (isSwitch(c)) return switchBase(l.groups[c]);
  return 0;
}

/** What a body at (x, z) stands on: the cell, or for the maki, the zebu's back. */
export function groundAt(s: MiarakaState, role: Role, x: number, z: number): number {
  const h = heightAt(s, Math.floor(x), Math.floor(z), role);
  const zebu = role === 'maki' && s.avatars.find((a) => a.role === 'zebu');
  return zebu && Math.hypot(x - zebu.x, z - zebu.z) < PHYS.backRadius ? Math.max(h, zebu.y + PHYS.back) : h;
}

const cellCentre = (cx: number, cz: number): [number, number] => [cx + 0.5, cz + 0.5];
const near = (a: { x: number; z: number }, cx: number, cz: number, d: number) => Math.hypot(a.x - cx - 0.5, a.z - cz - 0.5) < d;
const standsOn = (a: Avatar, cx: number, cz: number) => Math.floor(a.x) === cx && Math.floor(a.z) === cz;

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

/** Pushes a circle out of every blocked cell around it. */
function collide(b: { x: number; z: number }, r: number, blocked: (cx: number, cz: number) => boolean): void {
  const cx0 = Math.floor(b.x);
  const cz0 = Math.floor(b.z);
  for (let cz = cz0 - 1; cz <= cz0 + 1; cz++) {
    for (let cx = cx0 - 1; cx <= cx0 + 1; cx++) {
      if (!blocked(cx, cz)) continue;
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

/** The maki walks round the zebu, unless it's up level with its back. */
function aroundZebu(s: MiarakaState, b: Body): void {
  const zebu = s.avatars.find((a) => a.role === 'zebu');
  if (!zebu || b.y >= zebu.y + PHYS.back - PHYS.stepUp) return;
  const r = ROLE_INFO.zebu.radius + ROLE_INFO.maki.radius;
  const dx = b.x - zebu.x;
  const dz = b.z - zebu.z;
  const d = Math.hypot(dx, dz);
  if (d >= r) return;
  if (d < 1e-6) b.x = zebu.x + r;
  else {
    b.x = zebu.x + (dx / d) * r;
    b.z = zebu.z + (dz / d) * r;
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
  // A charging zebu stops at the water's edge rather than charging into it.
  const brake = b.dash > 0;
  const blocked = (cx: number, cz: number) => {
    const h = heightAt(s, cx, cz, role);
    return h > b.y + PHYS.stepUp || (brake && h < -0.1);
  };
  // Small sub-steps, so a fast charge doesn't go through a wall.
  const n = Math.max(1, Math.ceil((Math.hypot(vx, vz) * dt) / 0.15));
  for (let i = 0; i < n; i++) {
    b.x += (vx * dt) / n;
    b.z += (vz * dt) / n;
    if (role === 'maki') aroundZebu(s, b);
    collide(b, info.radius, blocked);
  }
  const ground = groundAt(s, role, b.x, b.z);
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
    timers: { ...state.timers },
    pressed: state.pressed.slice(),
    open: state.open.slice(),
    crates: state.crates.map((c) => ({ ...c, home: [...c.home] as [number, number] })),
    picked: state.picked.slice(),
    doors: state.doors.slice(),
    foes: state.foes.map((f) => ({ ...f })),
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

/** A level as it starts: everyone at their start, nothing opened yet. */
function begin(players: PlayerId[], roles: Role[], level: number, last: number, limit: number | null): MiarakaState {
  const l = LEVELS[level];
  const start = (role: Role) => cellCentre(...cellsWith(l, role === 'maki' ? 'm' : 'z')[0]);
  return {
    level,
    last,
    players,
    avatars: roles.map((role) => {
      const [x, z] = start(role);
      return { role, x, y: 0, z, f: Math.PI / 2, sync: 0, at: 0, check: [x, z] as [number, number], cool: 0 };
    }),
    time: 0,
    limit,
    broken: [],
    levers: [],
    timers: {},
    pressed: [],
    open: [],
    crates: cellsWith(l, '&').map(([x, z]) => ({ x, z, sunk: false, home: [x, z] as [number, number] })),
    keys: 0,
    picked: [],
    doors: [],
    vanilla: 0,
    bag: 0,
    foes: l.foes.map((f) => ({ x: f.from[0], z: f.from[1], dir: 1, stun: 0, hunt: -1 })),
    pads: 0,
    cleared: null,
    fx: [],
    won: false,
    lost: false,
  };
}

/** On to the next level: same pair, fresh world; devices snap to the new starts. */
function next(s: MiarakaState): MiarakaState {
  const n = begin(
    s.players,
    s.avatars.map((a) => a.role),
    s.level + 1,
    s.last,
    s.limit,
  );
  n.avatars.forEach((a, i) => (a.sync = s.avatars[i].sync + 1));
  n.bag = s.bag + s.vanilla;
  n.fx = s.fx;
  return n;
}

/** Back and forth along the beat. */
function patrol(f: Foe, def: FoeDef, move: number): void {
  const [tx, tz] = f.dir > 0 ? def.to : def.from;
  const d = Math.hypot(tx - f.x, tz - f.z);
  if (d <= move) {
    f.x = tx;
    f.z = tz;
    f.dir = f.dir > 0 ? -1 : 1;
  } else {
    f.x += ((tx - f.x) / d) * move;
    f.z += ((tz - f.z) / d) * move;
  }
}

/** Where the fosa can go: bare ground, never through a gate, a door or onto planks. */
function fosaGround(s: MiarakaState, cx: number, cz: number): boolean {
  const c = charAt(levelOf(s), cx, cz);
  return heightAt(s, cx, cz, 'zebu') === 0 && !isTarget(c) && c !== '|';
}

/** The fosa walks its beat, and runs at whoever comes near on the ground, until they get away. */
function prowl(s: MiarakaState, f: Foe, def: FoeDef, dtMs: number): void {
  const onGround = (a: Avatar | undefined): a is Avatar => !!a && a.y < 0.4;
  const dist = (a: Avatar) => Math.hypot(a.x - f.x, a.z - f.z);
  let prey = s.avatars[f.hunt];
  if (!onGround(prey) || dist(prey) > FOSA.lose) {
    f.hunt = -1;
    let best: number = FOSA.see;
    s.avatars.forEach((a, i) => {
      if (onGround(a) && dist(a) < best) {
        best = dist(a);
        f.hunt = i;
      }
    });
    prey = s.avatars[f.hunt];
  }
  // After its prey, or back along its beat.
  const [tx, tz] = f.hunt >= 0 ? [prey.x, prey.z] : f.dir > 0 ? def.to : def.from;
  const speed = ((f.hunt >= 0 ? FOSA.run : FOES.fosa.speed) * dtMs) / 1000;
  const d = Math.hypot(tx - f.x, tz - f.z);
  if (f.hunt < 0 && d <= speed) {
    patrol(f, def, speed);
    return;
  }
  if (d < 1e-6) return;
  const move = Math.min(d, speed);
  const b = { x: f.x + ((tx - f.x) / d) * move, z: f.z + ((tz - f.z) / d) * move };
  collide(b, FOSA.radius, (cx, cz) => !fosaGround(s, cx, cz));
  f.x = b.x;
  f.z = b.z;
}

function tick(state: MiarakaState, dtMs: number): MiarakaState {
  if (state.won || state.lost) return state;
  const s = copy(state);
  if (s.cleared !== null) {
    s.cleared += dtMs;
    return s.cleared >= NEXT_MS ? next(s) : s;
  }
  const l = levelOf(s);
  s.time += dtMs;
  if (s.limit !== null && s.time >= s.limit) {
    s.lost = true;
    return s;
  }
  for (const a of s.avatars) a.cool = Math.max(0, a.cool - dtMs);
  for (const g of Object.keys(s.timers)) s.timers[g] = Math.max(0, s.timers[g] - dtMs);

  // Switches: plates while weighed down, levers for good (or for a while), all-at-once plates for good.
  const pressed = new Set<string>();
  s.pressed = [];
  for (const [g, group] of Object.entries(l.groups)) {
    const cells = cellsWith(l, g);
    if (group.switch === 'lever') {
      const base = switchBase(group);
      const touching = cells.some(([cx, cz]) => s.avatars.some((a) => near(a, cx, cz, TOUCH + 0.15) && Math.abs(a.y - base) < 0.7));
      const [cx, cz] = cells[0];
      if (group.timer) {
        if (s.timers[g] === undefined && touching) {
          s.timers[g] = group.timer;
          fx(s, 'lever', cx + 0.5, cz + 0.5);
        } else if (s.timers[g] === 0 && !touching) delete s.timers[g];
      } else if (!s.levers.includes(g) && touching) {
        s.levers.push(g);
        fx(s, 'lever', cx + 0.5, cz + 0.5);
      }
      continue;
    }
    let down = 0;
    for (const [cx, cz] of cells) {
      const crate = s.crates.some((c) => c.x === cx && c.z === cz);
      const someone = s.avatars.some((a) => (group.switch === 'plate' || a.role === 'zebu') && standsOn(a, cx, cz) && a.y < 0.3);
      if (crate || someone) {
        down++;
        s.pressed.push(cellIndex(l, cx, cz));
      }
    }
    if (!group.all) {
      if (down > 0) pressed.add(g);
    } else if (down === cells.length && !s.levers.includes(g)) {
      s.levers.push(g);
      const [tx, tz] = cellsWith(l, g.toUpperCase())[0] ?? cells[0];
      fx(s, 'lever', tx + 0.5, tz + 0.5);
    }
  }
  const was = new Set(s.open);
  s.open = Object.keys(l.groups).filter((g) => {
    if (pressed.has(g) || s.levers.includes(g) || (s.timers[g] ?? 0) > 0) return true;
    // Never shut a gate on someone standing in it.
    return was.has(g) && cellsWith(l, g.toUpperCase()).some(([cx, cz]) => s.avatars.some((a) => standsOn(a, cx, cz)));
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
    if (a.y < PHYS.drown) respawn(s, a, charAt(l, Math.floor(a.x), Math.floor(a.z)) === '%' ? 'fall' : 'splash');
  }

  // The animals that bite: crocodiles at water level, bats up high, the fosa on the ground.
  l.foes.forEach((def, k) => {
    const f = s.foes[k];
    if (f.stun > 0) {
      f.stun = Math.max(0, f.stun - dtMs);
      return;
    }
    if (def.kind === 'fosa') prowl(s, f, def, dtMs);
    else patrol(f, def, (FOES[def.kind].speed * dtMs) / 1000);
    for (const a of s.avatars) {
      const reach = def.kind === 'bat' ? a.y > 0.6 : a.y < 0.4;
      if (!reach || Math.hypot(a.x - f.x, a.z - f.z) >= FOES[def.kind].bite) continue;
      respawn(s, a, 'bite');
      if (def.kind === 'fosa') {
        // Satisfied for a moment: time to get away.
        f.stun = FOSA.rest;
        f.hunt = -1;
      }
    }
  });

  // Both on the treasure pads, each on their own, for a moment.
  const pads = cellsWith(l, 'T');
  const onPad = s.avatars.map((a) => pads.findIndex(([cx, cz]) => near(a, cx, cz, 0.5) && a.y < 0.3));
  if (onPad.every((p) => p >= 0) && new Set(onPad).size === s.avatars.length) {
    s.pads += dtMs;
    if (s.pads >= PADS_MS) {
      fx(s, 'treasure', ...l.chest);
      if (s.level >= s.last) s.won = true;
      else s.cleared = 0;
    }
  } else s.pads = 0;
  return s;
}

/**
 * Pushes a crate one cell: onto bare ground, or into the shallows, where it
 * sinks and makes a ford. Against anything else (a wall, deep water that
 * would carry it off…) it goes back where it started, so it never ends up stuck.
 */
function push(s: MiarakaState, crate: Crate, sx: number, sz: number): void {
  const l = levelOf(s);
  const nx = crate.x + sx;
  const nz = crate.z + sz;
  const c = charAt(l, nx, nz);
  const taken = (cx: number, cz: number) => s.avatars.some((a) => standsOn(a, cx, cz)) || s.crates.some((o) => !o.sunk && o.x === cx && o.z === cz);
  // Someone in the way: it just doesn't move.
  if (taken(nx, nz)) return;
  if (c === '-' && !s.crates.some((o) => o.x === nx && o.z === nz)) {
    Object.assign(crate, { x: nx, z: nz, sunk: true });
    fx(s, 'sink', nx + 0.5, nz + 0.5);
    return;
  }
  // Onto bare ground (a ford counts), but not planks, a gate's or a bridge's cell, a lever or something to pick up.
  const ground = heightAt(s, nx, nz) === 0 && !'%|k*'.includes(c) && !isTarget(c) && !(isSwitch(c) && l.groups[c]?.switch === 'lever');
  if (ground) {
    crate.x = nx;
    crate.z = nz;
    fx(s, 'push', nx + 0.5, nz + 0.5);
    return;
  }
  const [hx, hz] = crate.home;
  if ((crate.x !== hx || crate.z !== hz) && !taken(hx, hz)) {
    fx(s, c === '~' ? 'splash' : 'home', crate.x + 0.5, crate.z + 0.5);
    crate.x = hx;
    crate.z = hz;
    fx(s, 'home', hx + 0.5, hz + 0.5);
  }
}

/** The zebu's charge: breaks the cracked wall ahead, pushes a crate a cell, stuns what's in front. */
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
    const crate = s.crates.find((c) => !c.sunk && c.x === cx && c.z === cz);
    if (crate) {
      // Straight along the main direction of the charge.
      push(s, crate, ...((Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)]) as [number, number]));
      break;
    }
  }
  l.foes.forEach((def, k) => {
    const foe = s.foes[k];
    const ox = foe.x - a.x;
    const oz = foe.z - a.z;
    // Bats fly out of reach.
    if (def.kind !== 'bat' && Math.hypot(ox, oz) < 1.8 && ox * dx + oz * dz > 0) {
      foe.stun = STUN_MS;
      foe.hunt = -1;
      fx(s, 'stun', foe.x, foe.z);
    }
  });
}

/** Is a device's report believable: not too far, not in a wall, not higher than that animal can get. */
function believable(s: MiarakaState, a: Avatar, m: Extract<MiarakaAction, { type: 'move' }>): boolean {
  const info = ROLE_INFO[a.role];
  const speed = a.role === 'zebu' ? PHYS.dashSpeed : info.speed;
  const seconds = (s.time - a.at) / 1000;
  if (Math.hypot(m.x - a.x, m.z - a.z) > speed * (seconds + 0.25) * 1.3 + 0.3) return false;
  const top = heightAt(s, Math.floor(m.x), Math.floor(m.z), a.role);
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
    id: 'niveau',
    label: 'Départ',
    default: '1',
    choices: LEVELS.map((l, i) => ({
      value: String(i + 1),
      label: `${i + 1}. ${l.place}`,
      hint: `${l.name}. ${l.blurb} ${i < LEVELS.length - 1 ? `Puis les suivants, jusqu’au niveau ${LEVELS.length}.` : 'Le dernier niveau.'}`,
    })),
  },
  {
    id: 'chrono',
    label: 'Chrono',
    default: 'off',
    choices: [
      { value: 'off', label: 'Sans chrono', hint: 'Prenez votre temps : le trésor attend.' },
      { value: '8', label: '8 min', hint: 'Chaque trésor avant 8 minutes, sinon c’est perdu.' },
      { value: '5', label: '5 min', hint: 'Pour les pros : 5 minutes par niveau, pas une de plus.' },
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
    // Each picks an animal in the lobby; without a clear choice, the first seat is the maki.
    const roles: Role[] = pieces[0] === 'zebu' || pieces[1] === 'maki' ? ['zebu', 'maki'] : ['maki', 'zebu'];
    const first = Math.min(LEVELS.length, Math.max(1, Math.floor(Number(options.niveau)) || 1)) - 1;
    const minutes = Number(options.chrono);
    return begin(players, roles, first, LEVELS.length - 1, minutes > 0 ? minutes * 60_000 : null);
  },

  validate(s, action, by): action is MiarakaAction {
    if (s.won || s.lost || s.cleared !== null || !isAction(action)) return false;
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
