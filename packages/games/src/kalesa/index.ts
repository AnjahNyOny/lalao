import type { GameDefinition, GameOption, GamePiece } from '@game/core';
import { kalesaBot } from './bot';
import { ACCEL, BRAKE, CHANGE_MS, COUNTDOWN_MS, GRACE_MS, HOP, terrainAtOf, type Car, type KalesaAction, type KalesaState } from './race';
import { speedOn } from './terrain';
import { lengthOf, trackOf, type Course } from './track';
import { makeWheel, MAX_STROKE, PAD, STARTING_WHEEL } from './wheel';

export { bestShape, SHAPES, type Shape } from './bot';
export * from './race';
export * from './terrain';
export * from './track';
export * from './wheel';

/**
 * Kalesa: a race on the roads of Madagascar where you draw your own wheels.
 * Cars drive themselves; whatever shape a player traces becomes their wheels
 * at once, and each stretch of road wants its own: round on tarmac, studs on
 * slippery clay, paddles in the mud and the fords, big over potholes.
 *
 * The server runs every car (a car only needs the shape of its wheels, and a
 * wheel drawn 100 ms late still makes sense); devices only send the wheels
 * their players draw.
 */

export const CARS: GamePiece[] = [
  { id: 'taxi4l', label: 'Taxi 4L' },
  { id: 'deuche', label: 'Deux-chevaux' },
  { id: 'bachee', label: 'Bâchée 404' },
  { id: 'brousse', label: 'Taxi-brousse' },
  { id: 'karenjy', label: 'Karenjy' },
  { id: 'bajaj', label: 'Bajaj' },
];

export const KALESA_OPTIONS: GameOption[] = [
  {
    id: 'piste',
    label: 'Piste',
    default: 'rn7',
    choices: [
      { value: 'rn7', label: 'RN7', hint: 'D’Antananarivo à Antsirabe : rizières, latérite rouge et nids-de-poule.' },
      { value: 'ouest', label: 'Baobabs', hint: 'De Miandrivazo à l’Allée des Baobabs : sable et rivières à passer à gué.' },
      { value: 'nord', label: 'Tsingy', hint: 'D’Antsiranana à l’Ankarana : rochers, argile glissante et boue.' },
      { value: 'hasard', label: 'Au hasard', hint: 'Une route différente à chaque partie.' },
    ],
  },
  {
    id: 'longueur',
    label: 'Longueur',
    default: 'etape',
    choices: [
      { value: 'sprint', label: 'Sprint', hint: 'Une demi-route, environ une minute.' },
      { value: 'etape', label: 'Étape', hint: 'Toute la route, environ deux minutes.' },
    ],
  },
];

const round2 = (v: number) => Math.round(v * 100) / 100;

/** When the race ends: everyone home, or the winner home long enough. */
function finished(s: KalesaState): boolean {
  const times = s.cars.map((c) => c.finish).filter((t): t is number => t !== null);
  return times.length === s.cars.length || (times.length > 0 && s.time >= Math.min(...times) + GRACE_MS);
}

function tick(state: KalesaState, dtMs: number): KalesaState {
  if (state.over) return state;
  const time = state.time + dtMs;
  // The part of this tick after the start signal.
  const dt = Math.max(0, Math.min(dtMs, time)) / 1000;
  const s: KalesaState = { ...state, time, cars: state.cars };
  if (dt > 0) {
    s.cars = state.cars.map((car) => {
      if (car.finish !== null) return car;
      const c = { ...car };
      const target = speedOn(terrainAtOf(s, c.d), c.wheel);
      c.v = c.v < target ? Math.min(target, c.v + ACCEL * dt) : Math.max(target, c.v - BRAKE * dt);
      const d = c.d + c.v * dt;
      if (d >= s.length) {
        // The moment it crossed, within this tick: close finishes are told apart.
        c.finish = Math.round(time - ((d - s.length) / Math.max(c.v, 0.01)) * 1000);
        c.d = s.length;
      } else c.d = d;
      c.d = Math.min(s.length, round2(c.d));
      c.v = round2(c.v);
      return c;
    });
  }
  if (finished(s)) s.over = true;
  return s;
}

const isInt = (v: unknown): v is number => Number.isInteger(v);

function isAction(a: unknown): a is KalesaAction {
  if (typeof a !== 'object' || a === null) return false;
  const m = a as Record<string, unknown>;
  return (
    m.type === 'wheel' &&
    Array.isArray(m.pts) &&
    m.pts.length >= 4 &&
    m.pts.length <= 2 * MAX_STROKE &&
    m.pts.length % 2 === 0 &&
    m.pts.every((v) => isInt(v) && Math.abs(v) <= PAD)
  );
}

export const kalesa: GameDefinition<KalesaState, KalesaAction> = {
  id: 'kalesa',
  name: 'Kalesa',
  minPlayers: 2,
  maxPlayers: 4,
  options: KALESA_OPTIONS,
  pieces: CARS,

  setup(players, seed, options = {}) {
    const course: Course = {
      track: ['rn7', 'ouest', 'nord', 'hasard'].includes(options.piste) ? options.piste : 'rn7',
      seed,
      sprint: options.longueur === 'sprint',
    };
    return {
      players,
      course,
      length: lengthOf(trackOf(course)),
      time: -COUNTDOWN_MS,
      cars: players.map((): Car => ({ d: 0, v: 0, wheel: STARTING_WHEEL, n: 0, at: -COUNTDOWN_MS, finish: null })),
      over: false,
    };
  },

  validate(s, action, by): action is KalesaAction {
    if (s.over || !s.players.includes(by) || !isAction(action)) return false;
    return makeWheel(action.pts) !== null;
  },

  apply(state, action, by) {
    const seat = state.players.indexOf(by);
    const car = state.cars[seat];
    // Past the line, or a second wheel right on top of the first: nothing to do.
    if (car.finish !== null || state.time - car.at < CHANGE_MS) return state;
    const wheel = makeWheel(action.pts)!;
    const cars = state.cars.slice();
    cars[seat] = { ...car, wheel, n: car.n + 1, at: state.time, v: round2(car.v * (1 - HOP)) };
    return { ...state, cars };
  },

  tick,

  result(s) {
    if (!s.over) return null;
    const times = s.cars.map((c) => c.finish).filter((t): t is number => t !== null);
    const best = Math.min(...times);
    return { kind: 'win', winners: s.players.filter((_, seat) => s.cars[seat].finish === best) };
  },

  bot: kalesaBot,
  // Quick: a bot's reaction time is in the bot itself (how far ahead it looks).
  botDelayMs: [80, 200],
};
