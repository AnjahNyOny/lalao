import { mulberry32 } from '@game/core';
import { TERRAIN_IDS, type Terrain } from './terrain';

/** A stretch of road, `len` metres long. */
export interface Segment {
  t: Terrain;
  len: number;
}

/** What the land round the road looks like. */
export type Look = 'hautes' | 'ouest' | 'nord';

export interface TrackDef {
  id: string;
  name: string;
  /** Where it starts and where it ends. */
  from: string;
  to: string;
  look: Look;
  segments: Segment[];
}

const s = (t: Terrain, len: number): Segment => ({ t, len });

/** The real roads, each with what it's known for. About 1.5 km each. */
export const TRACKS: TrackDef[] = [
  {
    // The RN7 out of the capital: rice fields, red earth, potholes.
    id: 'rn7',
    name: 'RN7, les Hautes Terres',
    from: 'Antananarivo',
    to: 'Antsirabe',
    look: 'hautes',
    segments: [
      s('goudron', 110),
      s('trous', 90),
      s('goudron', 75),
      s('boue', 100),
      s('glissant', 110),
      s('goudron', 90),
      s('trous', 110),
      s('glissant', 100),
      s('rochers', 90),
      s('goudron', 75),
      s('boue', 110),
      s('gue', 75),
      s('goudron', 110),
      s('trous', 90),
      s('glissant', 90),
      s('goudron', 75),
    ],
  },
  {
    // To Morondava's baobabs: sand, rivers to ford.
    id: 'ouest',
    name: 'La route des baobabs',
    from: 'Miandrivazo',
    to: 'l’Allée des Baobabs',
    look: 'ouest',
    segments: [
      s('goudron', 100),
      s('sable', 100),
      s('trous', 90),
      s('gue', 75),
      s('sable', 110),
      s('boue', 90),
      s('goudron', 75),
      s('rochers', 75),
      s('sable', 100),
      s('trous', 100),
      s('gue', 90),
      s('glissant', 75),
      s('sable', 110),
      s('goudron', 90),
      s('trous', 75),
      s('goudron', 75),
    ],
  },
  {
    // The track to the Ankarana: limestone, slippery clay, fords.
    id: 'nord',
    name: 'La piste des tsingy',
    from: 'Antsiranana',
    to: 'l’Ankarana',
    look: 'nord',
    segments: [
      s('goudron', 90),
      s('rochers', 100),
      s('glissant', 90),
      s('boue', 100),
      s('gue', 75),
      s('rochers', 110),
      s('trous', 90),
      s('glissant', 100),
      s('goudron', 60),
      s('rochers', 100),
      s('sable', 75),
      s('boue', 90),
      s('gue', 75),
      s('rochers', 100),
      s('glissant', 75),
      s('goudron', 90),
    ],
  },
];

/** A sprint stops at the first stretch past this many metres. */
export const SPRINT_M = 700;

/** The race being run: one of the tracks or a random road, full length or a sprint. */
export interface Course {
  track: string;
  /** For a random road. */
  seed: number;
  sprint: boolean;
}

/** A random road from a seed: tarmac to start, then no terrain twice in a row. */
function randomTrack(seed: number): TrackDef {
  const rand = mulberry32(seed);
  const segments: Segment[] = [s('goudron', 90)];
  while (segments.length < 16) {
    const choices = TERRAIN_IDS.filter((t) => t !== segments[segments.length - 1].t);
    segments.push(s(choices[Math.floor(rand() * choices.length)], 60 + 15 * Math.floor(rand() * 5)));
  }
  const looks: Look[] = ['hautes', 'ouest', 'nord'];
  return { id: 'hasard', name: 'Route au hasard', from: 'Quelque part', to: 'ailleurs', look: looks[Math.floor(rand() * 3)], segments };
}

const cache = new Map<string, TrackDef>();

/** The road for a course: computed once, the same everywhere (the state only carries the course). */
export function trackOf(c: Course): TrackDef {
  const key = `${c.track}:${c.track === 'hasard' ? c.seed : 0}:${c.sprint}`;
  let t = cache.get(key);
  if (!t) {
    const base = TRACKS.find((x) => x.id === c.track) ?? randomTrack(c.seed);
    let segments = base.segments;
    if (c.sprint) {
      let d = 0;
      const n = base.segments.findIndex((seg) => (d += seg.len) >= SPRINT_M);
      segments = base.segments.slice(0, n + 1);
    }
    t = { ...base, segments };
    if (cache.size > 64) cache.clear();
    cache.set(key, t);
  }
  return t;
}

export const lengthOf = (t: TrackDef) => t.segments.reduce((a, seg) => a + seg.len, 0);

/** Where each stretch starts, in metres. */
export function startsOf(t: TrackDef): number[] {
  const out: number[] = [];
  let d = 0;
  for (const seg of t.segments) {
    out.push(d);
    d += seg.len;
  }
  return out;
}

/** The stretch at `d` metres (the last one past the finish), and where it starts and ends. */
export function segmentAt(t: TrackDef, d: number): { index: number; start: number; end: number; t: Terrain } {
  let start = 0;
  for (let i = 0; i < t.segments.length; i++) {
    const end = start + t.segments[i].len;
    if (d < end || i === t.segments.length - 1) return { index: i, start, end, t: t.segments[i].t };
    start = end;
  }
  throw new Error('Piste vide');
}

export const terrainAt = (t: TrackDef, d: number): Terrain => segmentAt(t, d).t;
