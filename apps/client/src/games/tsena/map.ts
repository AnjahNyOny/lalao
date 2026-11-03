import { mulberry32 } from '@game/core';
import { CELL_COUNT, CELLS } from '@game/games/tsena';
import * as THREE from 'three';

/**
 * The island in board units: x towards the east, z towards the south,
 * K units per degree of latitude. Antananarivo sits near the origin.
 */
const LON0 = 46.9;
const LAT0 = -18.9;
/** Room for 48 well-spaced cells along the road, even through the crowded highlands. */
export const K = 6.2;
const COS = Math.cos((19 * Math.PI) / 180);

export const geo = (lon: number, lat: number) => new THREE.Vector3((lon - LON0) * K * COS, 0, -(lat - LAT0) * K);

/** Coastline, clockwise from Cap d'Ambre (lon, lat). */
const COAST: [number, number][] = [
  [49.26, -11.95], [49.5, -12.3], [49.9, -12.9], [50.1, -13.5], [50.25, -14.3], [50.35, -15.0], [50.5, -15.4],
  [50.15, -15.9], [49.95, -16.4], [49.75, -16.9], [49.55, -17.5], [49.45, -18.1], [49.1, -19.2], [48.65, -20.4],
  [48.3, -21.4], [48.0, -22.3], [47.7, -23.2], [47.3, -24.3], [46.95, -25.05], [46.2, -25.25], [45.2, -25.6],
  [44.4, -25.15], [43.85, -24.4], [43.6, -23.4], [43.45, -22.5], [43.3, -21.7], [43.75, -21.0], [44.15, -20.2],
  [44.35, -19.3], [44.15, -18.3], [44.25, -17.2], [44.45, -16.2], [45.5, -15.85], [46.3, -15.6], [47.1, -15.05],
  [47.8, -14.4], [48.2, -13.75], [48.65, -13.25], [48.95, -12.55],
];
export const coast = COAST.map(([lon, lat]) => geo(lon, lat));

/** Small islands off the coast: Nosy Be and Nosy Boraha (Sainte-Marie). */
export const islets = [
  { at: geo(48.15, -13.25), r: 0.27 * K, stretch: 1 },
  { at: geo(49.98, -16.95), r: 0.14 * K, stretch: 2.6 },
];

/** The road's waypoints (lon, lat), in board order from Antananarivo. */
const ROUTE: [number, number][] = [
  // Tana, then the winding RN7 through the highlands.
  [47.52, -18.95], [47.3, -19.3], [47.15, -19.6], [46.95, -19.85], [47.05, -20.15], [47.3, -20.45], [47.5, -20.95],
  [47.3, -21.3], [47.0, -21.5], [46.85, -21.9], [46.3, -22.3], [45.45, -22.45], [45.15, -22.75],
  // Across the deep south.
  [45.6, -23.55], [46.25, -24.0], [46.8, -24.35], [46.75, -24.75], [46.3, -24.9], [45.7, -24.85], [45.0, -24.75], [44.45, -24.35],
  [44.15, -23.85], [44.1, -23.25], [44.1, -22.55],
  // Up the west coast.
  [44.2, -21.8], [44.5, -21.0], [44.65, -20.3], [44.8, -19.6], [44.85, -18.8], [44.85, -17.9], [45.0, -17.0],
  [45.6, -16.4], [46.3, -16.15], [47.05, -15.75], [47.8, -15.1], [48.45, -14.3],
  // Round the north (the tip is too narrow for the road to come back down).
  [48.75, -13.6], [49.0, -13.15], [49.3, -13.0], [49.6, -13.25], [49.8, -13.75], [49.9, -14.35], [49.9, -15.1],
  // Down the east coast, then up to Tana from the north.
  [49.65, -15.9], [49.35, -16.8], [49.1, -17.7], [48.85, -18.45], [48.4, -18.85], [48.1, -18.45], [47.75, -18.25],
  [47.4, -18.45], [47.42, -18.75],
];

/** Where each place really is (lon, lat): its cell lands as near as the road allows. */
const PLACES: Record<string, [number, number]> = {
  Antananarivo: [47.52, -18.91],
  Antsirabe: [47.03, -19.87],
  'Lac Tritriva': [46.92, -19.93],
  Ambositra: [47.24, -20.53],
  Ranomafana: [47.42, -21.26],
  Fianarantsoa: [47.09, -21.45],
  Ambalavao: [46.93, -21.83],
  Isalo: [45.4, -22.55],
  Ilakaka: [45.21, -22.68],
  Taolagnaro: [46.98, -25.03],
  Berenty: [46.3, -24.99],
  Anakao: [43.65, -23.67],
  Toliara: [43.67, -23.35],
  Ifaty: [43.62, -23.15],
  Morondava: [44.28, -20.28],
  Kirindy: [44.66, -20.07],
  'Tsingy de Bemaraha': [44.8, -18.75],
  Mahajanga: [46.32, -15.72],
  'Nosy Be': [48.27, -13.33],
  Ambanja: [48.45, -13.68],
  "Montagne d'Ambre": [49.15, -12.53],
  Antsiranana: [49.29, -12.28],
  "Mer d'Émeraude": [49.45, -12.25],
  Sambava: [50.17, -14.27],
  Marojejy: [49.75, -14.45],
  Masoala: [50.0, -15.6],
  'Nosy Boraha': [49.85, -16.95],
  Toamasina: [49.4, -18.15],
  Andasibe: [48.42, -18.93],
  'Lac Anosy': [47.52, -18.92],
  Ambohimanga: [47.56, -18.76],
  Rova: [47.53, -18.92],
};

export const road = new THREE.CatmullRomCurve3(
  ROUTE.map(([lon, lat]) => geo(lon, lat)),
  true,
  'centripetal',
);
road.arcLengthDivisions = 3000;
export const roadLength = road.getLength();

const SAMPLES = 1500;
const roadSamples = Array.from({ length: SAMPLES }, (_, i) => road.getPointAt(i / SAMPLES));

/** Distance along the road to the point nearest `p`. */
function arcOf(p: THREE.Vector3): number {
  let best = 0;
  let dist = Infinity;
  roadSamples.forEach((q, i) => {
    const d = q.distanceToSquared(p);
    if (d < dist) [best, dist] = [i, d];
  });
  return (best / SAMPLES) * roadLength;
}

const pointAt = (s: number) => road.getPointAt((((s % roadLength) + roadLength) % roadLength) / roadLength);

/** Distance kept between two cells, along the road and straight across: a tile is 1.64 wide. */
const GAP = 2.7;
const CHORD = 2.5;
const MAX_GAP = 6.2;

/**
 * Each cell's distance along the road from Antananarivo, increasing: places
 * as near their real spot as the spacing allows, special cells in between.
 */
const arcs: number[] = (() => {
  const n = CELL_COUNT;
  const L = roadLength;
  const start = arcOf(geo(...PLACES[CELLS[0].name]));
  const want: (number | null)[] = CELLS.map((c, i) => {
    const place = PLACES[c.name];
    if (!place || (i === 0 && c.kind !== 'start')) return null;
    let s = (arcOf(geo(...place)) - start + L) % L;
    // Tana's own sites come at the very end of the loop.
    if (i > n / 2 && s < L / 4) s += L;
    return s;
  });
  const s = want.slice() as number[];
  for (let i = 0; i < n; i++) {
    if (want[i] !== null) continue;
    let j = i - 1;
    while (want[j] === null) j--;
    let k = i + 1;
    while (k < n && want[k] === null) k++;
    const end = k < n ? want[k]! : L;
    s[i] = want[j]! + ((end - want[j]!) * (i - j)) / (k - j);
  }
  for (let iter = 0; iter < 1500; iter++) {
    if (iter < 1200) want.forEach((w, i) => w !== null && i > 0 && (s[i] += (w - s[i]) * 0.03));
    for (let i = 0; i < n; i++) {
      const next = i + 1 < n ? s[i + 1] : s[0] + L;
      // Along the road, and straight across: on a tight bend, tiles close in.
      // Long empty stretches close up too, so a pawn never races across the map.
      const short = Math.max(GAP - (next - s[i]), CHORD - pointAt(s[i]).distanceTo(pointAt(next)));
      const long = next - s[i] - MAX_GAP;
      const move = short > 0 ? Math.min(short, 0.2) / 2 : long > 0 ? -Math.min(long, 0.2) / 4 : 0;
      if (!move) continue;
      // Small steps keep the cells in order.
      s[i] -= move;
      if (i + 1 < n) s[i + 1] += move;
      else s[0] += move;
    }
  }
  const shift = s[0];
  return s.map((x) => x - shift);
})();

export const cellPos = arcs.map(pointAt);

/** Road distance from cell `i` to the next one. */
export const stretch = (i: number) => {
  const n = CELL_COUNT;
  const k = ((i % n) + n) % n;
  return (k + 1 < n ? arcs[k + 1] : arcs[0] + roadLength) - arcs[k];
};

/** A point on the road, `u` in cells: `roadAt(3)` is cell 3, `roadAt(3.5)` halfway to cell 4. */
export function roadAt(u: number): THREE.Vector3 {
  const n = CELL_COUNT;
  const w = ((u % n) + n) % n;
  const i = Math.floor(w);
  const a = arcs[i];
  const b = i + 1 < n ? arcs[i + 1] : arcs[0] + roadLength;
  return pointAt(a + (b - a) * (w - i));
}

/** Ray casting against the coastline (islets count as land). */
export function onLand(x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = coast.length - 1; i < coast.length; j = i++) {
    const a = coast[i];
    const b = coast[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside || islets.some((it) => ((x - it.at.x) / it.r) ** 2 + ((z - it.at.z) / (it.r * it.stretch)) ** 2 < 1);
}

const tangentAt = (cell: number) => roadAt(cell + 0.05).sub(roadAt(cell - 0.05)).normalize();

/**
 * Which side of the road a cell's landmark and its houses stand on. The
 * landmark goes behind the tile as the camera sees it (north), so it never
 * hides the tile's name; on a north–south road, inside the loop. Whatever
 * would end up in the sea moves to the other side.
 */
const LANDMARK_GAP = 1.7;
const HOUSE_GAP = 1.3;
const sides = cellPos.map((p, cell) => {
  const t = tangentAt(cell);
  const n = new THREE.Vector3(-t.z, 0, t.x);
  const toCentre = new THREE.Vector3(0, 0, 0).sub(p);
  let back = Math.abs(n.z) > 0.35 ? (n.z < 0 ? n : n.clone().negate()) : n.dot(toCentre) > 0 ? n : n.clone().negate();
  const land = (v: THREE.Vector3, gap: number) => {
    const q = p.clone().addScaledVector(v, gap);
    return onLand(q.x, q.z);
  };
  if (!land(back, LANDMARK_GAP) && land(back.clone().negate(), LANDMARK_GAP)) back = back.clone().negate();
  const front = back.clone().negate();
  // Too near the shore for houses across the road: they go in front of the landmark, which steps back.
  const crowded = !land(front, HOUSE_GAP + 0.3);
  return { back, front: crowded ? back : front, tangent: t, crowded };
});

export interface Spot {
  position: THREE.Vector3;
  /** Turned to face the road. */
  rotation: [number, number, number];
}

function facingRoad(cell: number, position: THREE.Vector3): Spot {
  const facing = cellPos[cell].clone().sub(position);
  // Models face -Y in Blender, +Z here.
  return { position, rotation: [0, Math.atan2(facing.x, facing.z), 0] };
}

/** A cell's landmark, beside the road. */
export const landmarkAt = (cell: number) =>
  facingRoad(cell, cellPos[cell].clone().addScaledVector(sides[cell].back, sides[cell].crowded ? LANDMARK_GAP + 0.9 : LANDMARK_GAP));

/** Up to three houses side by side across the road from the landmark (index 1 is the middle: the hotel). */
export function houseAt(cell: number, index: number): Spot {
  const { front, tangent } = sides[cell];
  const position = cellPos[cell].clone().addScaledVector(front, HOUSE_GAP).addScaledVector(tangent, (index - 1) * 0.42);
  return facingRoad(cell, position);
}

const clearOfRoad = (p: THREE.Vector3, gap: number) => roadSamples.every((q) => q.distanceToSquared(p) > gap * gap);
const taken = cellPos.flatMap((_, cell) => [landmarkAt(cell).position, houseAt(cell, 1).position]);
const clearOfCells = (p: THREE.Vector3, gap: number) => taken.every((q) => q.distanceToSquared(p) > gap * gap);

/** Scenery counts below were chosen at 4.2 units per degree. */
const DENSITY = (K / 4.2) ** 2;

export interface Placement {
  x: number;
  z: number;
  rot: number;
  scale: number;
  /** Extra vertical stretch. */
  sy?: number;
}

/** Scatters `count` objects within `radius` degrees of a spot, on land (or at sea), away from the board. */
function scatter(
  seed: number,
  lon: number,
  lat: number,
  radius: number,
  count: number,
  scale: [number, number],
  sea = false,
  gap = 0.9,
): Placement[] {
  const rand = mulberry32(seed);
  const c = geo(lon, lat);
  const out: Placement[] = [];
  // Counts were set for a smaller map: keep the same density on the bigger one.
  count = Math.round(count * DENSITY);
  for (let tries = 0; out.length < count && tries < count * 40; tries++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * radius * K;
    const p = new THREE.Vector3(c.x + Math.cos(a) * r, 0, c.z + Math.sin(a) * r);
    if (onLand(p.x, p.z) === sea || !clearOfRoad(p, gap + 0.4) || !clearOfCells(p, gap + 0.5)) continue;
    if (out.some((q) => (q.x - p.x) ** 2 + (q.z - p.z) ** 2 < 0.5)) continue;
    out.push({ x: p.x, z: p.z, rot: rand() * Math.PI * 2, scale: scale[0] + rand() * (scale[1] - scale[0]) });
  }
  return out;
}

/** Scenery: which model goes where. Model names match `assets/blender/tsena_assets.py`. */
export const scenery: Record<string, Placement[]> = {
  baobab: [
    ...scatter(1, 44.9, -20.6, 0.9, 16, [0.9, 1.3]),
    ...scatter(2, 44.4, -22.4, 0.8, 10, [0.8, 1.1]),
    ...scatter(3, 45.5, -24.3, 0.8, 7, [0.8, 1]),
    ...scatter(24, 45.3, -17.0, 0.6, 5, [0.8, 1]),
  ],
  tsingy: [...scatter(4, 45.2, -19.0, 0.6, 8, [0.8, 1.3]), ...scatter(25, 49.0, -12.7, 0.2, 2, [0.6, 0.8])],
  ravinala: [
    ...scatter(5, 48.9, -17.4, 0.9, 14, [0.8, 1.1]),
    ...scatter(6, 48.4, -19.8, 0.9, 10, [0.8, 1.1]),
    ...scatter(7, 49.4, -15.0, 0.6, 8, [0.8, 1]),
    ...scatter(26, 47.7, -22.6, 0.7, 6, [0.8, 1]),
  ],
  palm: [
    ...scatter(8, 49.6, -15.9, 0.6, 7, [0.8, 1.1]),
    ...scatter(9, 46.1, -15.9, 0.5, 5, [0.8, 1]),
    ...scatter(10, 43.9, -23.5, 0.45, 5, [0.8, 1]),
    ...scatter(11, 47.5, -24.0, 0.8, 6, [0.8, 1]),
    ...scatter(27, 48.2, -13.3, 0.25, 4, [0.7, 0.9]),
  ],
  hut: [
    ...scatter(12, 46.6, -20.6, 0.9, 8, [0.9, 1.1]),
    ...scatter(13, 48.6, -15.2, 0.6, 4, [0.9, 1]),
    ...scatter(14, 44.4, -21.6, 0.6, 4, [0.9, 1]),
    ...scatter(28, 45.9, -24.4, 0.5, 3, [0.9, 1]),
  ],
  pawn_zebu: [...scatter(15, 46.3, -22.7, 0.6, 6, [0.7, 0.8]), ...scatter(16, 45.0, -21.4, 0.5, 3, [0.7, 0.8])],
  pawn_lemur: [...scatter(17, 48.6, -19.2, 0.4, 3, [0.6, 0.7]), ...scatter(18, 45.7, -22.0, 0.4, 2, [0.6, 0.7])],
  pirogue: [
    ...scatter(19, 43.1, -22.6, 0.45, 4, [0.8, 1], true),
    ...scatter(20, 43.8, -20.4, 0.45, 3, [0.8, 1], true),
    ...scatter(21, 47.6, -14.0, 0.4, 3, [0.8, 1], true),
    ...scatter(29, 49.0, -19.6, 0.4, 2, [0.8, 1], true),
  ],
  whale: [...scatter(22, 50.5, -16.6, 0.35, 2, [1, 1.1], true), ...scatter(23, 51.0, -15.3, 0.35, 1, [0.9, 0.9], true)],
};

/** Low rounded hills across the central plateau and the north. */
export const hills = (() => {
  const rand = mulberry32(31);
  const out: (Placement & { color: number; height: number })[] = [];
  const areas: [number, number, number, number][] = [
    [46.3, -17.6, 1.1, 16],
    [47.9, -20.8, 0.9, 10],
    [48.8, -14.0, 0.7, 6],
    [46.0, -23.5, 0.9, 8],
    [45.6, -18.5, 0.8, 6],
  ];
  for (const [lon, lat, radius, count] of areas) {
    for (const p of scatter(Math.floor(rand() * 1e6), lon, lat, radius, count, [0.8, 1.4], false, 1.8)) {
      // Mostly green; now and then the red earth of the Red Island shows through.
      out.push({ ...p, color: rand() < 0.15 ? 3 : Math.floor(rand() * 3), height: 0.4 + rand() * 0.6 });
    }
  }
  return out;
})();

/** Terraced rice fields around the highland towns. */
export const paddies = [...scatter(41, 47.3, -19.4, 0.7, 3, [0.6, 0.8]), ...scatter(42, 47.0, -21.0, 0.6, 2, [0.6, 0.75])];

/** Camera framing for the whole island (centre and extent). */
export const islandBox = new THREE.Box3().setFromPoints(coast);
