import { PAD, segmentAt, type Terrain, type TrackDef, type Wheel } from '@game/games/kalesa';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * What the road looks like under the wheels. Only for the eye: the race
 * itself only knows each wheel's size, roundness and spikes. Holes, rocks
 * and mud make the cars dip and bounce here, the same way on every screen.
 */

/** Metres per pad unit: a circle drawn to the pad's edge is a wheel 0.85 m in radius. */
export const WHEEL_M = 0.85 / PAD;
/** The road's half-width, metres. */
export const ROAD_W = 6.5;
/** How far apart the lanes are. */
export const LANE = 3;

/** Lanes from the camera's side outwards: this screen's own car is always nearest. */
export function laneOf(order: number, count: number): number {
  return ((count - 1) / 2) * LANE - order * LANE;
}

export const hash = (a: number, b: number) => {
  let h = (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return h;
};
/** Three independent fractions from one hash. */
const fracs = (h: number): [number, number, number] => [(h & 1023) / 1023, ((h >>> 10) & 1023) / 1023, ((h >>> 20) & 1023) / 1023];

export interface Bump {
  x: number;
  z: number;
  r: number;
}

/** Potholes and stones sit on a jittered grid: whatever is drawn is also what the wheels feel. */
const GRID: Record<'trous' | 'rochers', { dx: number; dz: number; keep: number; r: [number, number] }> = {
  trous: { dx: 2.6, dz: 1.7, keep: 0.55, r: [0.45, 0.85] },
  rochers: { dx: 2.1, dz: 1.5, keep: 0.5, r: [0.22, 0.5] },
};

function bumpAt(kind: 'trous' | 'rochers', cx: number, cz: number): Bump | null {
  const g = GRID[kind];
  const [a, b, c] = fracs(hash(cx * 7 + (kind === 'trous' ? 1 : 2), cz));
  if (a > g.keep) return null;
  return { x: (cx + 0.15 + 0.7 * b) * g.dx, z: cz * g.dz + (c - 0.5) * 0.5, r: g.r[0] + (g.r[1] - g.r[0]) * ((a * 7) % 1) };
}

/** Every pothole or stone on a stretch of road (to draw them). */
export function bumpsOn(kind: 'trous' | 'rochers', from: number, to: number): Bump[] {
  const g = GRID[kind];
  const out: Bump[] = [];
  for (let cx = Math.floor(from / g.dx); cx <= Math.ceil(to / g.dx); cx++) {
    for (let cz = Math.ceil(-ROAD_W / g.dz) + 1; cz <= Math.floor(ROAD_W / g.dz) - 1; cz++) {
      const b = bumpAt(kind, cx, cz);
      if (b && b.x > from + b.r && b.x < to - b.r) out.push(b);
    }
  }
  return out;
}

/** How deep (potholes) or high (stones) the road is at (x, z), before the wheel's size is counted. */
function relief(kind: 'trous' | 'rochers', x: number, z: number): number {
  const g = GRID[kind];
  let best = 0;
  for (let cx = Math.floor(x / g.dx) - 1; cx <= Math.floor(x / g.dx) + 1; cx++) {
    for (let cz = Math.round(z / g.dz) - 1; cz <= Math.round(z / g.dz) + 1; cz++) {
      const b = bumpAt(kind, cx, cz);
      if (!b) continue;
      const d2 = ((x - b.x) ** 2 + (z - b.z) ** 2) / (b.r * b.r);
      if (d2 < 1) best = Math.max(best, (kind === 'trous' ? 0.34 : b.r * 0.9) * (1 - d2));
    }
  }
  return best;
}

/** How far below the riverbed's banks a ford's bed lies. */
export const FORD_DEPTH = 0.45;

/**
 * The height of the ground under a wheel at (x, z), metres: a big wheel
 * rides over holes and stones and sinks less into mud and sand. Eased in
 * over the first and last metres of a stretch.
 */
export function groundAt(road: TrackDef, x: number, z: number, big: number): number {
  const seg = segmentAt(road, Math.max(0, x));
  if (x < 0) return 0;
  const ease = Math.min(1, (x - seg.start) / 1.5, (seg.end - x) / 1.5);
  if (ease <= 0) return 0;
  const t: Terrain = seg.t;
  let y = 0;
  if (t === 'trous') y = -relief('trous', x, z) * (1 - 0.8 * big);
  else if (t === 'rochers') y = relief('rochers', x, z) * (1 - 0.55 * big);
  else if (t === 'boue') y = -(0.24 - 0.17 * big) + 0.03 * Math.sin(x * 2.1 + z);
  else if (t === 'sable') y = -(0.12 - 0.08 * big) + 0.05 * Math.sin(x * 0.7 + z * 0.3);
  else if (t === 'gue') y = -FORD_DEPTH;
  return y * Math.max(0, ease);
}

/** Where along a road's stretches something should go, never twice the same on every screen. */
export function scatter(seed: number, from: number, to: number, every: number): { x: number; f: [number, number, number] }[] {
  const out: { x: number; f: [number, number, number] }[] = [];
  for (let k = Math.ceil(from / every); k * every < to; k++) {
    const f = fracs(hash(k, seed));
    out.push({ x: (k + f[0] * 0.8) * every, f });
  }
  return out;
}

const THICK = 0.08;
const WIDTH = 0.24;

/**
 * The stroke as a thick ribbon: each point pushed out both ways along its
 * (mitred) normal, then given the wheel's width. One quad per side per segment.
 */
function ribbon(pts: [number, number][], closed: boolean): THREE.BufferGeometry {
  const n = pts.length;
  const segs = closed ? n : n - 1;
  const dir = (i: number): [number, number] => {
    const [ax, ay] = pts[i % n];
    const [bx, by] = pts[(i + 1) % n];
    const l = Math.hypot(bx - ax, by - ay) || 1;
    return [(bx - ax) / l, (by - ay) / l];
  };
  // Outer and inner edge of the ribbon at each point.
  const edges = pts.map((p, i): [[number, number], [number, number]] => {
    const before = closed || i > 0 ? dir((i - 1 + n) % n) : dir(0);
    const after = closed || i < n - 1 ? dir(i) : dir(n - 2);
    let nx = -(before[1] + after[1]);
    let ny = before[0] + after[0];
    const l = Math.hypot(nx, ny);
    if (l < 1e-6) [nx, ny] = [-after[1], after[0]];
    else [nx, ny] = [nx / l, ny / l];
    // Mitre: longer at a corner, but never a spike.
    const cos = Math.max(0.5, nx * -after[1] + ny * after[0]);
    const h = THICK / 2 / cos;
    return [
      [p[0] + nx * h, p[1] + ny * h],
      [p[0] - nx * h, p[1] - ny * h],
    ];
  });
  const out: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => out.push(...a, ...b, ...c, ...a, ...c, ...d);
  const z = WIDTH / 2;
  for (let i = 0; i < segs; i++) {
    const [o0, i0] = edges[i];
    const [o1, i1] = edges[(i + 1) % n];
    quad([o0[0], o0[1], z], [o0[0], o0[1], -z], [o1[0], o1[1], -z], [o1[0], o1[1], z]);
    quad([i1[0], i1[1], z], [i1[0], i1[1], -z], [i0[0], i0[1], -z], [i0[0], i0[1], z]);
    quad([o0[0], o0[1], z], [o1[0], o1[1], z], [i1[0], i1[1], z], [i0[0], i0[1], z]);
    quad([i0[0], i0[1], -z], [i1[0], i1[1], -z], [o1[0], o1[1], -z], [o0[0], o0[1], -z]);
  }
  if (!closed) {
    for (const [k, s] of [
      [0, 1],
      [n - 1, -1],
    ]) {
      const [o, i] = edges[k];
      const q = (a: number[], b: number[], c: number[], d: number[]) => (s > 0 ? quad(a, b, c, d) : quad(d, c, b, a));
      q([i[0], i[1], z], [i[0], i[1], -z], [o[0], o[1], -z], [o[0], o[1], z]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * A drawn wheel as a solid: the stroke as a thick ribbon, spokes from the
 * hub, and the hub itself. One geometry per wheel shape, shared by a car's wheels.
 */
export function wheelGeometry(w: Wheel): { tyre: THREE.BufferGeometry; hub: THREE.BufferGeometry } {
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < w.pts.length; i += 2) pts.push([w.pts[i] * WHEEL_M, w.pts[i + 1] * WHEEL_M]);
  const hubParts: THREE.BufferGeometry[] = [];
  // Three spokes, to whatever points are a third of the way round.
  for (let k = 0; k < 3; k++) {
    const [x, y] = pts[Math.floor((k * pts.length) / 3)];
    const len = Math.hypot(x, y);
    if (len < 0.05) continue;
    const spoke = new THREE.BoxGeometry(len, 0.035, 0.05);
    spoke.translate(len / 2, 0, 0);
    spoke.rotateZ(Math.atan2(y, x));
    hubParts.push(spoke);
  }
  const hub = new THREE.CylinderGeometry(0.09, 0.09, WIDTH + 0.06, 8);
  hub.rotateX(Math.PI / 2);
  hubParts.push(hub);
  return { tyre: ribbon(pts, w.closed), hub: mergeGeometries(hubParts.map((p) => p.toNonIndexed())) };
}
