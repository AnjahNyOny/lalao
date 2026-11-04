import { describe, expect, it } from 'vitest';
import {
  ACCEL,
  CHANGE_MS,
  circle,
  COUNTDOWN_MS,
  gear,
  GRACE_MS,
  HOP,
  hubHeight,
  kalesa,
  lengthOf,
  makeWheel,
  PAD,
  scoreOn,
  segmentAt,
  speedOn,
  SPRINT_M,
  standings,
  star,
  STARTING_WHEEL,
  TERRAIN_IDS,
  trackOf,
  TRACKS,
  type KalesaAction,
  type KalesaState,
  type Terrain,
} from '.';

const P = ['a', 'b', 'c'];
const start = (options: Record<string, string> = {}, players = P) => kalesa.setup(players, 7, options);
const tick = (s: KalesaState, ms = 50) => kalesa.tick!(s, ms);
const ticks = (s: KalesaState, n: number) => {
  for (let i = 0; i < n; i++) s = tick(s);
  return s;
};
/** Past the countdown, `ms` into the race. */
const racing = (s: KalesaState, ms = 0) => ticks(s, (COUNTDOWN_MS + ms) / 50);
const wheel = (pts: number[]): KalesaAction => ({ type: 'wheel', pts });
const draw = (s: KalesaState, by: string, pts: number[]) => {
  const a = wheel(pts);
  expect(kalesa.validate(s, a, by)).toBe(true);
  return kalesa.apply(s, a, by);
};
/** Puts a car somewhere along the road, going at speed v. */
const put = (s: KalesaState, seat: number, d: number, v = 0): KalesaState => ({
  ...s,
  cars: s.cars.map((c, i) => (i === seat ? { ...c, d, v } : c)),
});
const W = (pts: number[]) => makeWheel(pts)!;

describe('kalesa wheels', () => {
  it('turns a drawn circle into a round wheel of the same size, centred on its hub', () => {
    const w = W(circle(60).map((v, i) => v + (i % 2 ? 30 : -20)));
    expect(w.closed).toBe(true);
    expect(w.size).toBeCloseTo(0.6, 1);
    expect(w.bump).toBeLessThan(0.05);
    expect(w.teeth).toBe(0);
    const xs = w.pts.filter((_, i) => i % 2 === 0);
    expect(Math.abs(xs.reduce((a, b) => a + b, 0) / xs.length)).toBeLessThan(1);
  });

  it('counts the points of a star and the studs of a gear', () => {
    expect(W(star(90, 35, 5))).toMatchObject({ teeth: 5 });
    expect(W(star(90, 35, 5)).depth).toBeGreaterThan(0.45);
    expect(W(gear(88, 58, 8))).toMatchObject({ teeth: 8 });
    expect(W(gear(88, 58, 8)).bump).toBeLessThan(0.1);
  });

  it('sees a stick as an open, lopsided wheel with two blades', () => {
    const w = W([-90, 0, 90, 0]);
    expect(w.closed).toBe(false);
    expect(w.bump).toBeGreaterThan(1.2);
    expect(w.teeth).toBe(2);
  });

  it('refuses a tap or a scribble too small to roll', () => {
    expect(makeWheel([0, 0, 5, 5, 10, 0])).toBeNull();
    expect(makeWheel([3, 3])).toBeNull();
  });

  it('measures the hub height as the lowest point under it', () => {
    // A stick lying flat: the hub is on the ground. Upright: half its length up.
    const stick = [-50, 0, 50, 0];
    expect(hubHeight(stick, Math.PI / 2)).toBeCloseTo(0);
    expect(hubHeight(stick, Math.PI)).toBeCloseTo(50);
  });
});

describe('kalesa terrains', () => {
  const best = (t: Terrain, shapes: Record<string, number[]>) =>
    Object.entries(shapes).reduce((a, b) => (scoreOn(t, W(b[1])) > scoreOn(t, W(a[1])) ? b : a))[0];
  const shapes = {
    rond: circle(50),
    grandRond: circle(90),
    crampons: gear(88, 58, 8),
    etoile: star(90, 35, 5),
    baton: [-90, 0, 90, 0],
  };

  it('wants a round wheel on tarmac, a big round one on sand', () => {
    expect(best('goudron', shapes)).toBe('grandRond');
    expect(best('sable', shapes)).toBe('grandRond');
    expect(scoreOn('goudron', W(circle(50)))).toBeGreaterThan(scoreOn('goudron', W(star(90, 35, 5))) + 0.15);
  });

  it('wants studs on slippery clay, paddles in mud and fords, big over potholes and rocks', () => {
    expect(best('glissant', shapes)).toBe('crampons');
    expect(best('boue', shapes)).toBe('etoile');
    expect(best('gue', shapes)).toBe('etoile');
    expect(scoreOn('trous', W(circle(90)))).toBeGreaterThan(scoreOn('trous', W(circle(40))) + 0.4);
    expect(scoreOn('rochers', W(star(90, 35, 5)))).toBeGreaterThan(scoreOn('rochers', W(circle(50))) + 0.3);
  });

  it('never stops a car dead, whatever the wheel', () => {
    for (const t of TERRAIN_IDS) for (const pts of Object.values(shapes)) expect(speedOn(t, W(pts))).toBeGreaterThanOrEqual(1.5);
  });
});

describe('kalesa setup', () => {
  it('lines everyone up on the starting wheel for the countdown', () => {
    const s = start();
    expect(s.time).toBe(-COUNTDOWN_MS);
    expect(s.cars).toHaveLength(3);
    expect(s.cars.every((c) => c.d === 0 && c.v === 0 && c.wheel === STARTING_WHEEL && c.finish === null)).toBe(true);
    expect(s.length).toBe(lengthOf(trackOf(s.course)));
    expect(s.course.track).toBe('rn7');
  });

  it('runs the chosen road, the sprint stopping halfway', () => {
    const full = start({ piste: 'ouest' });
    const sprint = start({ piste: 'ouest', longueur: 'sprint' });
    expect(full.length).toBe(lengthOf(TRACKS[1]));
    expect(sprint.length).toBeGreaterThanOrEqual(SPRINT_M);
    expect(sprint.length).toBeLessThan(full.length * 0.7);
    expect(start({ piste: 'nope' }).course.track).toBe('rn7');
  });

  it('draws a random road from the seed: the same for everyone, another next game', () => {
    const a = trackOf(kalesa.setup(P, 1, { piste: 'hasard' }).course);
    expect(trackOf(kalesa.setup(P, 1, { piste: 'hasard' }).course)).toEqual(a);
    expect(trackOf(kalesa.setup(P, 2, { piste: 'hasard' }).course).segments).not.toEqual(a.segments);
    expect(a.segments[0].t).toBe('goudron');
    a.segments.slice(1).forEach((seg, i) => expect(seg.t).not.toBe(a.segments[i].t));
  });
});

describe('kalesa race', () => {
  it('holds the cars during the countdown, then lets them go', () => {
    let s = ticks(start(), COUNTDOWN_MS / 50 - 1);
    expect(s.cars[0].d).toBe(0);
    s = ticks(s, 11);
    expect(s.time).toBe(500);
    expect(s.cars[0].v).toBeCloseTo(ACCEL * 0.5, 1);
    expect(s.cars[0].d).toBeGreaterThan(0);
  });

  it('speeds up to what its wheel allows on that road, and slows on a worse one', () => {
    let s = racing(start(), 6000);
    const target = speedOn('goudron', STARTING_WHEEL);
    expect(s.cars[0].v).toBeCloseTo(target, 1);
    // Into the potholes with a small wheel: it brakes.
    const road = trackOf(s.course);
    s = put(s, 0, segmentAt(road, 0).end + 0.5, target);
    s = ticks(s, 30);
    expect(s.cars[0].v).toBeCloseTo(speedOn('trous', STARTING_WHEEL), 1);
  });

  it('swaps the wheel at once, at the cost of a little hop', () => {
    let s = racing(start(), 2000);
    const v = s.cars[1].v;
    s = draw(s, 'b', circle(90));
    expect(s.cars[1].n).toBe(1);
    expect(s.cars[1].wheel.size).toBeGreaterThan(0.8);
    expect(s.cars[1].v).toBeCloseTo(v * (1 - HOP), 2);
    expect(s.cars[0].wheel).toBe(STARTING_WHEEL);
  });

  it('ignores a second wheel drawn right on top of the first', () => {
    let s = racing(start(), 1000);
    s = draw(s, 'a', circle(90));
    const again = draw(s, 'a', star(90, 35, 5));
    expect(again).toBe(s);
    s = ticks(s, CHANGE_MS / 50);
    expect(draw(s, 'a', star(90, 35, 5)).cars[0].n).toBe(2);
  });

  it('lets players draw during the countdown', () => {
    const s = ticks(start(), 10);
    expect(draw(s, 'c', circle(90)).cars[2].n).toBe(1);
  });

  it('never changes the state it is given', () => {
    const s = racing(start(), 1000);
    const copy = JSON.parse(JSON.stringify(s));
    tick(s);
    draw(s, 'a', circle(80));
    expect(s).toEqual(copy);
  });

  it('times the finish within the tick, then waits for the others', () => {
    let s = racing(start({ longueur: 'sprint' }), 1000);
    // At 10 m/s, a tick is half a metre: the line is crossed halfway through it.
    s = put(s, 0, s.length - 0.25, 10);
    const before = s.time;
    s = tick(s);
    expect(s.cars[0].finish).toBeGreaterThan(before + 20);
    expect(s.cars[0].finish).toBeLessThan(before + 30);
    expect(s.cars[0].d).toBe(s.length);
    expect(s.over).toBe(false);
    expect(kalesa.result(s)).toBeNull();
    // A finished car can't change its wheels any more.
    expect(kalesa.apply(s, wheel(circle(80)), 'a')).toBe(s);
    expect(standings(s)[0]).toBe(0);
  });

  it('ends once everyone is home, the fastest winning', () => {
    let s = racing(start({ longueur: 'sprint' }), 1000);
    s = put(put(put(s, 0, s.length - 0.25, 10), 1, s.length - 0.1, 10), 2, s.length - 0.4, 10);
    s = tick(s);
    expect(s.over).toBe(true);
    expect(kalesa.result(s)).toEqual({ kind: 'win', winners: ['b'] });
    expect(standings(s)).toEqual([1, 0, 2]);
  });

  it('ends a while after the winner, whoever is still on the road', () => {
    let s = racing(start({ longueur: 'sprint' }), 1000);
    s = tick(put(s, 2, s.length - 0.1, 10));
    const won = s.cars[2].finish!;
    while (!s.over) s = tick(s);
    expect(s.time).toBeGreaterThanOrEqual(won + GRACE_MS);
    expect(s.time).toBeLessThan(won + GRACE_MS + 100);
    expect(kalesa.result(s)).toEqual({ kind: 'win', winners: ['c'] });
    // The others are ranked by how far they got.
    expect(standings(s)[0]).toBe(2);
    expect(tick(s)).toBe(s);
  });

  it('shares the win on a dead heat', () => {
    let s = racing(start({ longueur: 'sprint' }, ['a', 'b']), 1000);
    s = tick(put(put(s, 0, s.length - 0.3, 10), 1, s.length - 0.3, 10));
    expect(kalesa.result(s)).toEqual({ kind: 'win', winners: ['a', 'b'] });
  });

  it('rewards the right wheel: drawing for each stretch beats keeping the first one', () => {
    const best: Record<Terrain, number[]> = {
      goudron: circle(90),
      sable: circle(90),
      trous: circle(90),
      glissant: gear(88, 58, 8),
      boue: star(90, 35, 5),
      gue: star(90, 35, 5),
      rochers: star(90, 35, 5),
    };
    let s = racing(start({}, ['a', 'b']));
    const road = trackOf(s.course);
    let last: Terrain | null = null;
    while (s.cars[0].finish === null) {
      const t = segmentAt(road, s.cars[0].d).t;
      if (t !== last) {
        s = draw(s, 'a', best[t]);
        last = t;
      }
      s = tick(s);
    }
    // When the one who drew is home, the other one is far behind.
    expect(s.cars[1].d).toBeLessThan(s.length * 0.65);
  });
});

describe('kalesa refusals', () => {
  const s = racing(start(), 1000);
  it.each([
    ['not an object', 'circle'],
    ['no points', { type: 'wheel' }],
    ['points not a list', { type: 'wheel', pts: '1,2,3,4' }],
    ['odd count', { type: 'wheel', pts: [1, 2, 3] }],
    ['not whole numbers', { type: 'wheel', pts: [0.5, 0, 50, 50] }],
    ['off the pad', { type: 'wheel', pts: [0, 0, PAD + 1, 0] }],
    ['too many points', { type: 'wheel', pts: Array.from({ length: 400 }, (_, i) => (i % 50) - 25) }],
    ['too small', { type: 'wheel', pts: [0, 0, 4, 4] }],
    ['wrong type', { type: 'boost', pts: circle(50) }],
  ])('refuses a malformed wheel: %s', (_, action) => {
    expect(kalesa.validate(s, action, 'a')).toBe(false);
  });

  it('refuses someone not in the race, and anything once it is over', () => {
    expect(kalesa.validate(s, wheel(circle(50)), 'z')).toBe(false);
    expect(kalesa.validate({ ...s, over: true }, wheel(circle(50)), 'a')).toBe(false);
  });
});
