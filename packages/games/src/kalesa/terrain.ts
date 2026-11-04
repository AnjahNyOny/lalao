import type { Wheel } from './wheel';

/**
 * The roads of Madagascar, and the wheel each one wants. A wheel's score on
 * a terrain (0.15 to 1) times the terrain's top speed is how fast a car goes
 * there.
 */
export type Terrain = 'goudron' | 'glissant' | 'boue' | 'trous' | 'rochers' | 'sable' | 'gue';

export const TERRAIN_IDS: Terrain[] = ['goudron', 'glissant', 'boue', 'trous', 'rochers', 'sable', 'gue'];

/** What a wheel's shape is good for, each from 0 to 1. */
export interface Traits {
  /** The hub stays level as it turns. */
  round: number;
  /** Drawn big: rides over holes and stones. */
  big: number;
  /** Many little spikes, all the way round: they bite into slippery clay. */
  studs: number;
  /** A few deep spikes: they paddle through mud and water. */
  blades: number;
  /** Spikes of any kind. */
  grip: number;
  /** So lopsided it flops over rather than rolls (a stick, a V). */
  flop: number;
}

const c01 = (v: number) => Math.max(0, Math.min(1, v));

export function traits(w: Wheel): Traits {
  return {
    round: c01(1 - (w.bump - 0.12) / 0.45),
    big: c01((w.size - 0.3) / 0.45),
    studs: c01((w.teeth - 2) / 5) * c01(w.depth / 0.2),
    blades: w.teeth >= 2 ? c01(w.depth / 0.4) * c01(1 - (w.teeth - 6) / 3) : 0,
    grip: c01(w.teeth / 4) * c01(w.depth / 0.25),
    flop: c01((w.bump - 0.5) / 0.8),
  };
}

export interface TerrainInfo {
  /** Shown as a car reaches it. */
  name: string;
  /** The wheel it wants, in a few words. */
  hint: string;
  /** Top speed with the right wheel, m/s. */
  speed: number;
  score: (t: Traits) => number;
}

export const TERRAINS: Record<Terrain, TerrainInfo> = {
  goudron: {
    name: 'Goudron',
    hint: 'une roue bien ronde',
    speed: 19,
    score: (t) => 0.35 + 0.5 * t.round + 0.15 * t.big - 0.2 * t.grip,
  },
  glissant: {
    name: 'Latérite glissante',
    hint: 'plein de petits crampons tout autour',
    speed: 14,
    score: (t) => 0.25 + 0.6 * t.studs + 0.15 * t.round,
  },
  boue: {
    name: 'Boue des rizières',
    hint: 'quelques grandes palettes (une étoile)',
    speed: 12,
    score: (t) => 0.2 + 0.55 * t.blades + 0.25 * t.big,
  },
  trous: {
    name: 'Nids-de-poule',
    hint: 'une très grande roue',
    speed: 15,
    score: (t) => 0.25 + 0.75 * t.big,
  },
  rochers: {
    name: 'Rochers',
    hint: 'grande et pointue',
    speed: 12,
    score: (t) => 0.2 + 0.45 * t.big + 0.35 * t.grip,
  },
  sable: {
    name: 'Sable',
    hint: 'grande et bien ronde, sans pointes',
    speed: 13,
    score: (t) => 0.2 + 0.4 * t.big + 0.4 * t.round - 0.2 * t.grip,
  },
  gue: {
    name: 'Gué',
    hint: 'des palettes pour pagayer',
    speed: 10,
    score: (t) => 0.25 + 0.75 * t.blades,
  },
};

/** How well a wheel does on a terrain, 0.15 to 1. */
export function scoreOn(terrain: Terrain, w: Wheel): number {
  const t = traits(w);
  return Math.max(0.15, Math.min(1, TERRAINS[terrain].score(t) - 0.2 * t.flop));
}

/** How fast a car with this wheel goes on this terrain, m/s. */
export const speedOn = (terrain: Terrain, w: Wheel) => TERRAINS[terrain].speed * scoreOn(terrain, w);
