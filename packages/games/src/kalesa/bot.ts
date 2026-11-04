import type { BotLevel, PlayerId } from '@game/core';
import { CHANGE_MS, roadOf, type KalesaAction, type KalesaState } from './race';
import { scoreOn, TERRAIN_IDS, type Terrain } from './terrain';
import { segmentAt } from './track';
import { circle, gear, makeWheel, PAD, star, type Wheel } from './wheel';

/** A shape a bot knows how to draw, and how well it does on each terrain. */
export interface Shape {
  name: string;
  stroke: number[];
  wheel: Wheel;
  score: Record<Terrain, number>;
}

function shape(name: string, stroke: number[]): Shape {
  const wheel = makeWheel(stroke)!;
  return { name, stroke, wheel, score: Object.fromEntries(TERRAIN_IDS.map((t) => [t, scoreOn(t, wheel)])) as Record<Terrain, number> };
}

/** What a bot can draw (and what the hints show). */
export const SHAPES: Shape[] = [
  shape('rond', circle(48)),
  shape('grand rond', circle(90)),
  shape('crampons', gear(88, 58, 8)),
  shape('étoile', star(90, 35, 5)),
  shape('petite étoile', star(55, 22, 5)),
  shape('croix', star(90, 30, 4)),
];

/** The best shape a bot knows for a terrain. */
export const bestShape = (t: Terrain): Shape => SHAPES.reduce((a, b) => (b.score[t] > a.score[t] ? b : a));

interface Level {
  /** Where it looks, in metres from its car: negative, it only reacts once well into a new stretch. */
  ahead: (v: number) => number;
  /** Keeps its wheel unless the best one is this much better. */
  slack: number;
  /** How much its hand shakes, in pad units. */
  shake: number;
  /** The shortest time between two of its wheels, ms. */
  cool: number;
  /** How often it draws something else than the right shape. */
  wrong: number;
}

const LEVELS: Record<BotLevel, Level> = {
  // Notices a new road three seconds late, and often guesses.
  easy: { ahead: () => -14, slack: 0.3, shake: 9, cool: 2500, wrong: 0.4 },
  // Reacts half a second after it gets there, nearly always with the right shape.
  medium: { ahead: () => -6, slack: 0.12, shake: 6, cool: 900, wrong: 0.12 },
  // Changes right as it gets to a new stretch (allowing for its own reaction), with a steady hand.
  hard: { ahead: (v) => 0.5 + v * 0.12, slack: 0.04, shake: 2, cool: CHANGE_MS + 50, wrong: 0 },
};

/** A stroke as a hand would draw it: every point a little off. */
function shaky(stroke: number[], amount: number, rand: () => number): number[] {
  return stroke.map((v) => Math.max(-PAD, Math.min(PAD, Math.round(v + (rand() - 0.5) * 2 * amount))));
}

export function kalesaBot(view: KalesaState, me: PlayerId, level: BotLevel, rand: () => number): KalesaAction | null {
  const s = view;
  const seat = s.players.indexOf(me);
  if (s.over || seat < 0) return null;
  const car = s.cars[seat];
  const p = LEVELS[level];
  if (car.finish !== null || s.time - car.at < p.cool) return null;
  const at = Math.max(0, Math.min(s.length - 0.01, car.d + p.ahead(car.v)));
  const t = segmentAt(roadOf(s), at).t;
  const best = bestShape(t);
  if (scoreOn(t, car.wheel) >= best.score[t] - p.slack) return null;
  const drawn = rand() < p.wrong ? SHAPES[Math.floor(rand() * SHAPES.length)] : best;
  return { type: 'wheel', pts: shaky(drawn.stroke, p.shake, rand) };
}
