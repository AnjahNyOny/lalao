import type { GameDefinition, GameOption, PlayerId } from '@game/core';
import { cellIndex, cellsWith, charAt, size, type Mountain } from './level';
import { MOUNTAIN } from './mountain';

export * from './level';
export { MOUNTAIN } from './mountain';

/**
 * Tady (« la corde »): two ring-tailed lemurs, roped together, climb the Pic
 * Boby by night to see the sun rise from the top. Each is the other's
 * belay: grip the rock while your partner jumps, stand on their head, swing
 * at the end of the rope, haul them up.
 *
 * Like Miaraka, each device moves its own climber with `step` (the same code
 * runs here) and reports where it is; the server checks the report (speed,
 * rock, rope length) and keeps the shared things: the rope's length, the
 * crumbling ledges, the orchids, the camps, the summit.
 */

export const PHYS = {
  gravity: 34,
  /** Clears 2 tiles, not 3 (on a partner's head, 3). */
  jump: 13.2,
  run: 5.2,
  accel: 60,
  air: 24,
  ice: 6,
  maxFall: 18,
  /** Half the climber's width and height, in tiles. */
  hw: 0.34,
  hh: 0.4,
  coyote: 0.1,
  buffer: 0.12,
  rope: 5,
  ropeMin: 1.3,
  /** Hauling in, climbing up the rope, and the rope paying back out, in tiles per second. */
  reel: 3.2,
  climb: 2.4,
  relax: 3,
  /** A push off the rope while hanging under a partner who grips the rock. */
  ropeJumpCool: 0.45,
  /** A gust carries everyone who isn't gripping along at this speed. */
  wind: 4.5,
} as const;

/** How far from the paws something can still be gripped, in tiles. */
const GRIP_REACH = 0.25;
/** Fallen this far without a grip or a landing: it counts as a fall. */
const FALL_TILES = 5;
/** In the rough mode, a camp floor only catches a drop shorter than this. */
const ROUGH_FALL = 3;
const CRUMBLE_MS = 700;
const BACK_MS = 4500;
const SUMMIT_MS = 1200;
const FX_KEPT = 12;
/** Fastest a climber can believably go: a long fall, a swing, a yank of the rope. */
const MAX_SPEED = 26;

export interface Climber {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ground: boolean;
  /** Gripping the rock: doesn't move, holds the rope. */
  grab: boolean;
  /** Pulling the rope in (1) or paying it out (-1). */
  reel: -1 | 0 | 1;
  face: 1 | -1;
  /** Bumped whenever the server moves the climber itself: the device then snaps to it. */
  sync: number;
  /** Game time of the last accepted report. */
  at: number;
  /** Highest point (smallest y) since last on the ground or on the rock: for counting falls. */
  peak: number;
}

export interface Fx {
  n: number;
  t: 'fall' | 'crumble' | 'restore' | 'pick' | 'camp' | 'summit';
  x: number;
  y: number;
}

export interface TadyState {
  players: PlayerId[];
  climbers: Climber[];
  /** Length of rope between them right now. */
  rope: number;
  /** ms since the start. */
  time: number;
  /** The rough mode: camps don't catch a fall. */
  rough: boolean;
  /** Crumbling ledges that someone has stood on: ms since. */
  crumble: Record<number, number>;
  /** Orchids picked (tile indices). */
  picked: number[];
  /** Camps reached so far (0 = none yet). */
  camp: number;
  falls: number;
  /** How long both have stood on the summit. */
  summit: number;
  fx: Fx[];
  won: boolean;
}

export type TadyAction = TadyMove | { type: 'camp' };

/** Where a device's climber is, several times a second. */
export type TadyMove = {
  type: 'move';
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** On the ground, gripping, reeling, facing, sync. */
  g: boolean;
  h: boolean;
  r: -1 | 0 | 1;
  f: 1 | -1;
  s: number;
};

const M = (): Mountain => MOUNTAIN;
export const orchidTotal = () => cellsWith(M(), '*').length;

/** A full solid tile: rock, ice, a crumbling ledge still standing. */
export function solidAt(s: TadyState, cx: number, cy: number): boolean {
  const c = charAt(M(), cx, cy);
  if (c === '#' || c === '~') return true;
  if (c === '%') return !((s.crumble[cellIndex(M(), cx, cy)] ?? -1) >= CRUMBLE_MS);
  return false;
}

/** A ledge you land on from above and jump up through; in the rough mode, a camp floor lets a long fall through. */
export function ledgeAt(s: TadyState, cx: number, cy: number, fallen = 0): boolean {
  const c = charAt(M(), cx, cy);
  return c === '-' || (c === '_' && (!s.rough || fallen < ROUGH_FALL));
}

/** What you can grip: granite and the wooden ledges, not ice or crumbling stone. */
export const gripAt = (cx: number, cy: number) => '#-_'.includes(charAt(M(), cx, cy));

/** The gust blowing across row y right now: 1 east, -1 west, 0 calm. */
export function gustAt(time: number, y: number): -1 | 0 | 1 {
  for (const w of M().winds) {
    if (y < w.y0 || y > w.y1 + 1) continue;
    if ((((time - w.phase) % w.period) + w.period) % w.period < w.on) return w.dir;
  }
  return 0;
}

/** A body being moved on a device: the climber plus what only the mover needs. */
export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ground: boolean;
  grab: boolean;
  face: 1 | -1;
  /** Seconds left to jump after leaving an edge, to keep a jump pressed a little early, before the next push off the rope. */
  coyote: number;
  buffer: number;
  cool: number;
  /** Standing on the partner's head. */
  onPartner: boolean;
  /** Highest point (smallest y) since last held up by something. */
  peak: number;
}

export interface Input {
  /** Stick, -1..1: x right, y down. */
  mx: number;
  my: number;
  /** Jump pressed this frame; grip held. */
  jump: boolean;
  grab: boolean;
}

export const bodyOf = (c: Climber): Body => ({
  x: c.x,
  y: c.y,
  vx: c.vx,
  vy: c.vy,
  ground: c.ground,
  grab: c.grab,
  face: c.face,
  coyote: 0,
  buffer: 0,
  cool: 0,
  onPartner: false,
  peak: c.y,
});

/** Where the partner is, as best this device knows: a moving partner is a little ahead of their last report. */
function partnerOf(s: TadyState, seat: number) {
  const p = s.climbers[1 - seat];
  const age = p.grab ? 0 : Math.min(0.2, (s.time - p.at) / 1000 + 0.05);
  return { x: p.x + p.vx * age, y: p.y + p.vy * age, grab: p.grab, ground: p.ground };
}

/** Does the box at (x, y) overlap a tile for which `test` holds? */
function overlaps(x: number, y: number, hw: number, hh: number, test: (cx: number, cy: number) => boolean): boolean {
  for (let cy = Math.floor(y - hh); cy <= Math.floor(y + hh - 1e-9); cy++) {
    for (let cx = Math.floor(x - hw); cx <= Math.floor(x + hw - 1e-9); cx++) if (test(cx, cy)) return true;
  }
  return false;
}

/** Something to hold within reach of the paws: on either side, underneath or overhead. */
export const touchingGrip = (b: { x: number; y: number }) => overlaps(b.x, b.y, PHYS.hw + GRIP_REACH, PHYS.hh + GRIP_REACH, gripAt);

const EPS = 1e-4;

function moveX(s: TadyState, b: Body, dx: number): void {
  b.x += dx;
  const { hw, hh } = PHYS;
  for (let cy = Math.floor(b.y - hh); cy <= Math.floor(b.y + hh - 1e-9); cy++) {
    if (dx > 0) {
      const cx = Math.floor(b.x + hw - 1e-9);
      if (solidAt(s, cx, cy)) {
        b.x = cx - hw - EPS;
        b.vx = 0;
      }
    } else if (dx < 0) {
      const cx = Math.floor(b.x - hw);
      if (solidAt(s, cx, cy)) {
        b.x = cx + 1 + hw + EPS;
        b.vx = 0;
      }
    }
  }
}

function moveY(s: TadyState, b: Body, dy: number, p: { x: number; y: number }): void {
  const { hw, hh } = PHYS;
  const before = b.y + hh;
  b.y += dy;
  if (dy > 0) {
    const bottom = b.y + hh;
    const cy = Math.floor(bottom - 1e-9);
    for (let cx = Math.floor(b.x - hw); cx <= Math.floor(b.x + hw - 1e-9); cx++) {
      if (solidAt(s, cx, cy) || (ledgeAt(s, cx, cy, b.y - b.peak) && before <= cy + 1e-3)) {
        b.y = cy - hh;
        b.vy = 0;
        b.ground = true;
        return;
      }
    }
    // The partner's head is a ledge too.
    const top = p.y - hh;
    if (before <= top + 0.02 && bottom >= top && Math.abs(b.x - p.x) < 2 * hw - 0.06) {
      b.y = top - hh;
      b.vy = 0;
      b.ground = true;
      b.onPartner = true;
    }
  } else if (dy < 0) {
    const cy = Math.floor(b.y - hh);
    for (let cx = Math.floor(b.x - hw); cx <= Math.floor(b.x + hw - 1e-9); cx++) {
      if (solidAt(s, cx, cy)) {
        b.y = cy + 1 + hh + EPS;
        b.vy = 0;
        return;
      }
    }
  }
}

/** Out of any rock the rope has pulled the body into, by the shortest way. */
function pushOut(s: TadyState, b: Body): void {
  const { hw, hh } = PHYS;
  for (let k = 0; k < 4; k++) {
    let hit = false;
    for (let cy = Math.floor(b.y - hh); cy <= Math.floor(b.y + hh - 1e-9) && !hit; cy++) {
      for (let cx = Math.floor(b.x - hw); cx <= Math.floor(b.x + hw - 1e-9) && !hit; cx++) {
        if (!solidAt(s, cx, cy)) continue;
        hit = true;
        const out = [b.x + hw - cx, cx + 1 - (b.x - hw), b.y + hh - cy, cy + 1 - (b.y - hh)];
        const i = out.indexOf(Math.min(...out));
        if (i === 0) b.x = cx - hw - EPS;
        else if (i === 1) b.x = cx + 1 + hw + EPS;
        else if (i === 2) {
          b.y = cy - hh - EPS;
          if (b.vy > 0) b.vy = 0;
        } else b.y = cy + 1 + hh + EPS;
      }
    }
    if (!hit) return;
  }
}

/**
 * How much rope holds this climber back: hauled in, it only holds the one
 * below; whoever climbs above their partner gets all the rope they need.
 */
export const ropeFor = (rope: number, y: number, partnerY: number) => (y < partnerY - 0.2 ? PHYS.rope : rope);

/**
 * The rope: past its length, the two are pulled together. Whoever grips the
 * rock doesn't move; between two free climbers, the one on the ground
 * holds better than the one in the air.
 */
function tether(s: TadyState, b: Body, p: ReturnType<typeof partnerOf>): [number, number] | null {
  const dx = b.x - p.x;
  const dy = b.y - p.y;
  const d = Math.hypot(dx, dy);
  const length = ropeFor(s.rope, b.y, p.y);
  if (d <= length || d < 1e-6) return null;
  const hold = (grab: boolean, ground: boolean) => (grab ? Infinity : ground ? 2 : 1);
  const mine = hold(false, b.ground);
  const theirs = hold(p.grab, p.ground);
  const share = theirs === Infinity ? 1 : theirs / (mine + theirs);
  const nx = dx / d;
  const ny = dy / d;
  const over = d - length;
  const out = b.vx * nx + b.vy * ny;
  if (out > 0 && share > 0) {
    b.vx -= out * nx;
    b.vy -= out * ny;
  }
  return [-nx * over * share, -ny * over * share];
}

/**
 * One frame of a climber's movement, `dt` in seconds. Runs on the device
 * that owns the climber; the server checks the result.
 */
export function step(s: TadyState, seat: number, body: Body, input: Input, dt: number): Body {
  const b = { ...body };
  const p = partnerOf(s, seat);
  b.cool = Math.max(0, b.cool - dt);
  b.buffer = input.jump ? PHYS.buffer : Math.max(0, b.buffer - dt);
  if (input.grab && touchingGrip(b)) {
    b.grab = true;
    b.vx = 0;
    b.vy = 0;
    b.ground = false;
    b.peak = b.y;
    return b;
  }
  b.grab = false;
  if (Math.abs(input.mx) > 0.2) b.face = input.mx > 0 ? 1 : -1;
  const onIce = b.ground && !b.onPartner && charAt(M(), Math.floor(b.x), Math.floor(b.y + PHYS.hh + 0.05)) === '~';
  const accel = (b.ground ? (onIce ? PHYS.ice : PHYS.accel) : PHYS.air) * dt;
  // Running is relative to the air: a gust carries you along, against it you barely move.
  const target = Math.max(-1, Math.min(1, input.mx)) * PHYS.run + gustAt(s.time, b.y) * PHYS.wind;
  b.vx = b.vx < target ? Math.min(target, b.vx + accel) : Math.max(target, b.vx - accel);
  // Jump off the ground (a moment after leaving it still counts), or push off the rope under a gripping partner.
  b.coyote = b.ground ? PHYS.coyote : Math.max(0, b.coyote - dt);
  const hanging = p.grab && b.y > p.y + 0.3 && Math.hypot(b.x - p.x, b.y - p.y) >= ropeFor(s.rope, b.y, p.y) - 0.08;
  if (b.buffer > 0 && (b.coyote > 0 || (hanging && b.cool <= 0))) {
    if (b.coyote <= 0) b.cool = PHYS.ropeJumpCool;
    b.vy = -PHYS.jump;
    b.buffer = 0;
    b.coyote = 0;
  }
  b.vy = Math.min(b.vy + PHYS.gravity * dt, PHYS.maxFall);
  const n = Math.max(1, Math.ceil((Math.max(Math.abs(b.vx), Math.abs(b.vy)) * dt) / 0.3));
  b.ground = false;
  b.onPartner = false;
  for (let i = 0; i < n; i++) {
    moveX(s, b, (b.vx * dt) / n);
    moveY(s, b, (b.vy * dt) / n, p);
  }
  // The rope's pull moves the body like anything else: along the rock, never into it.
  const pull = tether(s, b, p);
  if (pull) {
    const [vx, vy] = [b.vx, b.vy];
    moveX(s, b, pull[0]);
    moveY(s, b, pull[1], p);
    // Pressed against the rock by the rope isn't stopping: keep the speed it had.
    [b.vx, b.vy] = [b.vx === 0 ? 0 : vx, b.vy === 0 && pull[1] > 0 ? 0 : vy];
    pushOut(s, b);
  }
  b.peak = b.ground ? b.y : Math.min(b.peak, b.y);
  return b;
}

/** Mutable copy for one tick or action. */
function copy(state: TadyState): TadyState {
  return {
    ...state,
    climbers: state.climbers.map((c) => ({ ...c })),
    crumble: { ...state.crumble },
    picked: state.picked.slice(),
    fx: state.fx.slice(),
  };
}

function fx(s: TadyState, t: Fx['t'], x: number, y: number): void {
  const n = (s.fx[s.fx.length - 1]?.n ?? 0) + 1;
  s.fx.push({ n, t, x, y });
  if (s.fx.length > FX_KEPT) s.fx.shift();
}

const near = (c: { x: number; y: number }, cx: number, cy: number, d: number) => Math.hypot(c.x - cx - 0.5, c.y - cy - 0.5) < d;
/** Feet on top of that tile. */
const standsOn = (c: Climber, cx: number, cy: number) =>
  Math.abs(c.y + PHYS.hh - cy) < 0.08 && c.x + PHYS.hw > cx && c.x - PHYS.hw < cx + 1;

/** Camps from the bottom of the mountain up. */
const camps = () => cellsWith(M(), 'C').sort((a, b) => b[1] - a[1]);

/** Stuck? Both back to the last camp reached (the foot of the mountain before the first), side by side. */
function backToCamp(s: TadyState): void {
  const camp = camps()[s.camp - 1];
  const spots = camp ? [-0.6, 0.6].map((dx) => [camp[0] + 0.5 + dx, camp[1]]) : ['a', 'b'].map((ch) => cellsWith(M(), ch)[0]).map(([cx, cy]) => [cx + 0.5, cy]);
  s.climbers.forEach((c, i) => {
    const [x, cy] = spots[i];
    Object.assign(c, { x, y: cy + 1 - PHYS.hh, vx: 0, vy: 0, ground: true, grab: false, reel: 0, sync: c.sync + 1, at: s.time });
    c.peak = c.y;
  });
  s.rope = PHYS.rope;
}

function tick(state: TadyState, dtMs: number): TadyState {
  if (state.won) return state;
  const s = copy(state);
  const m = M();
  const dt = dtMs / 1000;
  s.time += dtMs;

  // The rope: hauled in from a grip, climbed from below, paid out to whoever climbs above, or back to full length when nobody holds on.
  const [a, b] = s.climbers;
  const dist = Math.hypot(a.x - b.x, a.y - b.y);
  let change = 0;
  for (const [me, other] of [
    [a, b],
    [b, a],
  ]) {
    if (me.grab) change -= me.reel * PHYS.reel;
    else if (other.grab && me.reel === 1 && me.y > other.y) change -= PHYS.climb;
    else if (me.y < other.y - 0.2 && dist > s.rope) s.rope = Math.min(PHYS.rope, dist);
  }
  if (!a.grab && !b.grab) change = PHYS.relax;
  // Hauling a partner stuck against the rock doesn't take in more rope.
  s.rope = Math.max(PHYS.ropeMin, dist - 1, Math.min(PHYS.rope, s.rope + change * dt));
  s.rope = Math.min(PHYS.rope, s.rope);

  // Crumbling ledges: they go a moment after someone stands on them, and come back once nobody's in the way.
  for (const [cx, cy] of cellsWith(m, '%')) {
    const i = cellIndex(m, cx, cy);
    const t = s.crumble[i];
    if (t === undefined) {
      if (s.climbers.some((c) => standsOn(c, cx, cy))) s.crumble[i] = 0;
      continue;
    }
    s.crumble[i] = t + dtMs;
    if (t < CRUMBLE_MS && t + dtMs >= CRUMBLE_MS) fx(s, 'crumble', cx + 0.5, cy + 0.5);
    const inside = s.climbers.some((c) => Math.abs(c.x - cx - 0.5) < 0.5 + PHYS.hw && Math.abs(c.y - cy - 0.5) < 0.5 + PHYS.hh);
    if (t + dtMs >= BACK_MS && !inside) {
      delete s.crumble[i];
      fx(s, 'restore', cx + 0.5, cy + 0.5);
    }
  }

  for (const c of s.climbers) {
    for (const [cx, cy] of cellsWith(m, '*')) {
      const i = cellIndex(m, cx, cy);
      if (!s.picked.includes(i) && near(c, cx, cy, 0.7)) {
        s.picked.push(i);
        fx(s, 'pick', cx + 0.5, cy + 0.5);
      }
    }
    camps().forEach(([cx, cy], k) => {
      if (k + 1 > s.camp && near(c, cx, cy, 1.2)) {
        s.camp = k + 1;
        fx(s, 'camp', cx + 0.5, cy + 0.5);
      }
    });
    // A long drop, stopped by the ground or a grip: a fall.
    if (c.ground || c.grab) {
      if (c.y - c.peak > FALL_TILES) {
        s.falls++;
        fx(s, 'fall', c.x, c.y);
      }
      c.peak = c.y;
    } else c.peak = Math.min(c.peak, c.y);
  }

  // Both at the top, on their feet, for a moment.
  const top = cellsWith(m, 'S');
  if (s.climbers.every((c) => (c.ground || c.grab) && top.some(([cx, cy]) => near(c, cx, cy, 1.1)))) {
    s.summit += dtMs;
    if (s.summit >= SUMMIT_MS) {
      s.won = true;
      fx(s, 'summit', top[1][0] + 0.5, top[1][1] + 0.5);
    }
  } else s.summit = 0;
  return s;
}

/** Is a device's report believable: not too far too fast, not inside the rock, not further than the rope allows. */
function believable(s: TadyState, c: Climber, other: Climber, m: TadyMove): boolean {
  const seconds = (s.time - c.at) / 1000;
  if (Math.hypot(m.x - c.x, m.y - c.y) > MAX_SPEED * (seconds + 0.25) * 1.3 + 0.6) return false;
  const { w, h } = size(M());
  if (m.x < 0 || m.x > w || m.y < 0 || m.y > h) return false;
  if (overlaps(m.x, m.y, PHYS.hw - 0.06, PHYS.hh - 0.06, (cx, cy) => solidAt(s, cx, cy))) return false;
  // Some slack: each device sees the other a little late.
  return Math.hypot(m.x - other.x, m.y - other.y) <= s.rope + 2.5;
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function isAction(a: unknown): a is TadyAction {
  if (typeof a !== 'object' || a === null) return false;
  const m = a as Record<string, unknown>;
  if (m.type === 'camp') return true;
  return (
    m.type === 'move' &&
    finite(m.x) &&
    finite(m.y) &&
    finite(m.vx) &&
    finite(m.vy) &&
    typeof m.g === 'boolean' &&
    typeof m.h === 'boolean' &&
    (m.r === -1 || m.r === 0 || m.r === 1) &&
    (m.f === 1 || m.f === -1) &&
    Number.isInteger(m.s)
  );
}

export const TADY_OPTIONS: GameOption[] = [
  {
    id: 'chute',
    label: 'Chutes',
    default: 'douce',
    choices: [
      { value: 'douce', label: 'Douce', hint: 'Chaque camp vous rattrape : une chute ne fait jamais perdre plus d’une étape.' },
      { value: 'rude', label: 'Rude', hint: 'Une longue chute passe à travers les camps : elle peut vous ramener tout en bas.' },
    ],
  },
];

export const tady: GameDefinition<TadyState, TadyAction> = {
  id: 'tady',
  name: 'Tady',
  minPlayers: 2,
  maxPlayers: 2,
  options: TADY_OPTIONS,
  pieces: [
    { id: 'koto', label: 'Koto · écharpe rouge' },
    { id: 'soa', label: 'Soa · écharpe bleue' },
  ],

  setup(players, _seed, options = {}) {
    const start = (ch: string) => {
      const [cx, cy] = cellsWith(M(), ch)[0];
      return { x: cx + 0.5, y: cy + 1 - PHYS.hh };
    };
    return {
      players,
      climbers: ['a', 'b'].map((ch, i): Climber => {
        const { x, y } = start(ch);
        return { x, y, vx: 0, vy: 0, ground: true, grab: false, reel: 0, face: i === 0 ? 1 : -1, sync: 0, at: 0, peak: y };
      }),
      rope: PHYS.rope,
      time: 0,
      rough: options.chute === 'rude',
      crumble: {},
      picked: [],
      camp: 0,
      falls: 0,
      summit: 0,
      fx: [],
      won: false,
    };
  },

  validate(s, action, by): action is TadyAction {
    if (s.won || !s.players.includes(by) || !isAction(action)) return false;
    // In the rough mode a fall costs what it costs: no way back to the camp.
    return action.type === 'move' || !s.rough;
  },

  apply(state, action, by) {
    const s = copy(state);
    if (action.type === 'camp') {
      backToCamp(s);
      return s;
    }
    const seat = s.players.indexOf(by);
    const c = s.climbers[seat];
    // A report from before the last snap: the device hasn't caught up yet.
    if (action.s !== c.sync) return state;
    if (!believable(s, c, s.climbers[1 - seat], action)) {
      c.sync++;
      return s;
    }
    Object.assign(c, { x: action.x, y: action.y, vx: action.vx, vy: action.vy, ground: action.g, grab: action.h, reel: action.r, face: action.f, at: s.time });
    return s;
  },

  tick,

  result(s) {
    return s.won ? { kind: 'win', winners: s.players } : null;
  },
};
