import { describe, expect, it } from 'vitest';
import {
  bodyOf,
  cellIndex,
  cellsWith,
  GRIP,
  gripTime,
  gustAt,
  MOUNTAIN,
  orchidTotal,
  PHYS,
  step,
  tady,
  tire,
  touchingGrip,
  type Body,
  type Climber,
  type Input,
  type TadyAction,
  type TadyState,
} from '.';
import { duo, takeTurns } from './duo';
import { nextAction, type Progress } from './solution';

const P = ['a', 'b'];
const start = (chute?: string) => tady.setup(P, 1, chute ? { chute } : {});
const still: Input = { mx: 0, my: 0, jump: false, grab: false };
/** Feet on top of row `top`. */
const on = (top: number) => top - PHYS.hh;

function place(s: TadyState, seat: number, c: Partial<Climber>): TadyState {
  return { ...s, climbers: s.climbers.map((k, i) => (i === seat ? { ...k, vx: 0, vy: 0, ...c, at: s.time } : k)) };
}
/** One climber's device for some frames of 1/60 s; the partner stays where the state has them. */
function run(s: TadyState, seat: number, b: Body, input: (f: number, b: Body) => Partial<Input>, frames: number, watch?: (b: Body) => void): Body {
  for (let f = 0; f < frames; f++) {
    b = step(s, seat, b, { ...still, ...input(f, b) }, 1 / 60);
    watch?.(b);
  }
  return b;
}
const move = (s: TadyState, seat: number, m: Partial<TadyAction>): TadyState => {
  const c = s.climbers[seat];
  const a: TadyAction = { type: 'move', x: c.x, y: c.y, vx: 0, vy: 0, g: c.ground, h: c.grab, r: 0, f: 1, s: c.sync, ...m };
  expect(tady.validate(s, a, P[seat])).toBe(true);
  return tady.apply(s, a, P[seat]);
};
const ticks = (s: TadyState, n: number) => {
  for (let i = 0; i < n; i++) s = tady.tick!(s, 50);
  return s;
};

describe('tady setup', () => {
  it('ropes the two together at the foot of the mountain', () => {
    const s = start();
    expect(s.climbers.map((c) => [c.x, c.y])).toEqual([
      [2.5, on(103)],
      [3.5, on(103)],
    ]);
    expect(s.rope).toBe(PHYS.rope);
    expect(s.rough).toBe(false);
    expect(start('rude').rough).toBe(true);
  });

  it('every row is as wide as the others, with two starts, camps and a summit', () => {
    expect(new Set(MOUNTAIN.rows.map((r) => r.length)).size).toBe(1);
    expect(cellsWith(MOUNTAIN, 'a')).toHaveLength(1);
    expect(cellsWith(MOUNTAIN, 'b')).toHaveLength(1);
    expect(cellsWith(MOUNTAIN, 'C')).toHaveLength(MOUNTAIN.stages.length - 1);
    expect(cellsWith(MOUNTAIN, 'S').length).toBeGreaterThan(1);
    expect(orchidTotal()).toBeGreaterThan(5);
  });
});

describe('tady moves', () => {
  it('runs, and jumps up 2 tiles but not 3', () => {
    const s = place(start(), 1, { x: 9.5, y: on(100) });
    // On the 2-step at x 9..11 (top 100); the next block (x 12..15) is 3 higher.
    const b = run(s, 0, { ...bodyOf(s.climbers[0]), x: 10.5, y: on(100) }, (f) => ({ mx: 1, jump: f === 0 }), 90);
    expect(b.y).toBeCloseTo(on(100));
    let top = 999;
    run(start(), 0, { ...bodyOf(start().climbers[0]), x: 4, y: on(103) }, (f) => ({ jump: f === 0 }), 60, (k) => (top = Math.min(top, k.y)));
    expect(on(103) - top).toBeGreaterThan(2.3);
    expect(on(103) - top).toBeLessThan(3);
  });

  it('from the partner’s head, 3 tiles up', () => {
    let s = start();
    s = place(s, 1, { x: 11, y: on(100), ground: true });
    const b = run(s, 0, { ...bodyOf(s.climbers[0]), x: 11, y: on(100) - 2 * PHYS.hh, onPartner: true, ground: true }, (f) => ({ mx: f > 6 ? 1 : 0, jump: f === 0 }), 90);
    expect(b.y).toBeCloseTo(on(97));
  });

  it('grips granite and wood, not ice; a gripping climber doesn’t move, however hard the rope pulls', () => {
    const s = start();
    expect(touchingGrip({ x: 4, y: on(103) })).toBe(true);
    // The ledge halfway up the first wall (x 19..20, row 94).
    expect(touchingGrip({ x: 19.5, y: on(94) })).toBe(true);
    // The ice ledge at x 9..12, row 34: no grip there (nor next to the rock at x 7..8).
    expect(touchingGrip({ x: 10.5, y: on(34) })).toBe(false);
    const b = run(s, 0, { ...bodyOf(s.climbers[0]), x: 4, y: on(103) }, () => ({ grab: true, mx: 1 }), 30);
    expect([b.x, b.y, b.grab]).toEqual([4, on(103), true]);
  });

  it('a fall drags a partner who doesn’t grip: yanked to the edge and over it, both down at the bottom; a grip holds it', () => {
    // Koto stands on the slab (x 8..13, top 76); Soa walks off its left edge, into the pit 7 deep.
    const fall = (grab: boolean) => {
      let s = place(start(), 0, { x: 11, y: on(76), ground: true });
      s = place(s, 1, { x: 8.6, y: on(76), ground: true });
      let fastest = 0;
      let over = -1;
      const end = duo(s, [() => ({ grab }), (f) => (f < 20 ? { mx: -1 } : {})], 120, (_, [koto], f) => {
        fastest = Math.max(fastest, -koto.vx);
        if (over < 0 && koto.x < 8) over = f;
      });
      return { ...end, fastest, over };
    };
    const dropped = fall(false);
    expect(dropped.fastest).toBeGreaterThan(6);
    expect(dropped.over).toBeGreaterThan(0);
    expect(dropped.over).toBeLessThan(70);
    expect(dropped.bodies.map((b) => b.y)).toEqual([on(83), on(83)]);
    const held = fall(true);
    expect(held.bodies[0]).toMatchObject({ x: 11, y: on(76), grab: true });
    expect(held.bodies[1].y).toBeLessThan(on(83) - 0.5);
  });

  it('falling on a slanted rope, a swing: fast under a grip, and still a swing while the other is dragged', () => {
    // Koto on the slab at x 15..18 (top 25); Soa drops from off its right end, open air below.
    const swing = (grab: boolean) => {
      let s = place(start(), 0, { x: 15.4, y: on(25), ground: true });
      s = place(s, 1, { x: 20.3, y: 26.2, ground: false });
      let fastest = 0;
      let hung = 0;
      const end = duo(s, [() => ({ grab }), () => ({})], 120, (_, [, soa]) => {
        fastest = Math.max(fastest, Math.abs(soa.vx));
        if (soa.hanging) hung++;
      });
      return { ...end, fastest, hung };
    };
    const held = swing(true);
    expect(held.fastest).toBeGreaterThan(10);
    expect(held.hung).toBeGreaterThan(100);
    const dragged = swing(false);
    expect(dragged.hung).toBeGreaterThan(10);
    // Both down on the camp floor below (row 38).
    expect(dragged.bodies.every((b) => Math.abs(b.y - on(38)) < 0.01)).toBe(true);
  });

  it('hangs on the rope under a partner who grips, and swings', () => {
    // The partner grips the top of the slab (x 8..13, row 76); to the left, open air down to row 83.
    const s = place(start(), 1, { x: 8.3, y: on(76), grab: true, ground: false });
    let lo = 99;
    let hi = 0;
    let b = run(s, 0, { ...bodyOf(s.climbers[0]), x: 6, y: 76, ground: false }, () => ({}), 90);
    expect(Math.hypot(b.x - 8.3, b.y - on(76))).toBeCloseTo(PHYS.rope, 1);
    expect(b.y).toBeLessThan(on(83));
    // Hanging against the face: push off it, then pump with the swing.
    b = run(s, 0, b, (_, k) => ({ mx: k.vx > 0 ? 1 : -1 }), 360, (k) => ((lo = Math.min(lo, k.x)), (hi = Math.max(hi, k.x))));
    expect(hi - lo).toBeGreaterThan(3);
  });

  it('the one gripping hauls the other up; the one hanging can climb the rope', () => {
    // The partner grips the top of the slab (x 8..13, row 76); the other hangs by its face, over the camp floor.
    let s = place(start(), 1, { x: 13.6, y: on(76), grab: true, ground: false, reel: 1 });
    s = place(s, 0, { x: 14.5, y: 79.5, ground: false });
    s = ticks(s, 10);
    expect(s.rope).toBeLessThan(4.5);
    // Hauled: pulled up the face towards the top.
    let b = bodyOf(s.climbers[0]);
    for (let i = 0; i < 6; i++) {
      s = ticks(s, 1);
      b = run(s, 0, b, () => ({}), 3);
    }
    expect(b.y).toBeLessThan(79);
    // Climbing from below, even with slack in the rope.
    let t = place(start(), 1, { x: 13.6, y: on(76), grab: true, ground: false });
    t = place(t, 0, { x: 14.5, y: 78, ground: false, reel: 1 });
    expect(ticks(t, 10).rope).toBeLessThan(PHYS.rope - 0.8);
  });

  it('pays out rope to whoever climbs above, but keeps holding the one below', () => {
    let s = place(start(), 1, { x: 20.6, y: 95, grab: true, ground: false });
    s = { ...s, rope: 1.3 };
    const up = run(s, 0, { ...bodyOf(s.climbers[0]), x: 20.6, y: 95 - 1.2, ground: false, vy: -PHYS.jump }, () => ({}), 18);
    expect(20.6 - up.x + (95 - up.y)).toBeGreaterThan(2);
    const down = run(s, 0, { ...bodyOf(s.climbers[0]), x: 20.6, y: 96.5, ground: false }, () => ({}), 30);
    expect(Math.hypot(down.x - 20.6, down.y - 95)).toBeLessThan(1.4);
  });

  it('the first step, together: one up from the other’s head, then grips; the other climbs the rope and pulls up over the edge', () => {
    // From the 2-step (x 9..11, row 100) to the block above (x 12..15, row 97): 3 up.
    let s = start();
    s = place(s, 1, { x: 11.5, y: on(100), ground: true });
    s = place(s, 0, { x: 11.5, y: on(100) - 2 * PHYS.hh, ground: true });
    const { s: end, bodies } = duo(
      s,
      [(f) => (f < 10 ? {} : f === 10 ? { jump: true, mx: 1 } : f < 50 ? { mx: 1 } : { grab: true }), (f) => (f < 70 ? {} : { my: -1, mx: 0.5 })],
      300,
    );
    expect(bodies.every((b) => b.y <= on(97) + 0.01)).toBe(true);
    expect(end.climbers.map((c) => c.sync)).toEqual([0, 0]);
  });

  it('no jumping off the rope: hanging, you swing, climb, or pull up at its top', () => {
    // The partner grips the top of the slab; the other hangs in the air beside its face.
    let s = place(start(), 1, { x: 13.6, y: on(76), grab: true, ground: false });
    s = place(s, 0, { x: 14.5, y: 79.5, ground: false });
    let b = run(s, 0, bodyOf(s.climbers[0]), () => ({}), 30);
    expect(b.hanging).toBe(true);
    const y = b.y;
    b = run(s, 0, b, (f) => ({ jump: f === 0 }), 10);
    expect(b.y).toBeGreaterThan(y - 0.2);
    // At the top of the rope, up pulls you over the edge, onto the slab.
    const top = { ...s, rope: PHYS.ropeMin };
    let landed = false;
    run(top, 0, { ...bodyOf(s.climbers[0]), x: 14.36, y: on(76) + 0.75, ground: false }, () => ({ my: -1, mx: -1 }), 40, (k) => (landed ||= k.ground && k.x < 14 && k.y < on(76) + 0.01));
    expect(landed).toBe(true);
    // Down lets the rope out: longer, up to its full length.
    let t = place(s, 0, { reel: -1 });
    t = { ...t, rope: 2 };
    expect(ticks(t, 10).rope).toBeGreaterThan(3);
  });

  it('every hard passage can be climbed by two taking turns: one holds the face, the other climbs past', () => {
    const passages: [string, number, number, number, 1 | -1][] = [
      // The 7-tile slab beside camp 1 (its face at x 14).
      ['dalle', 14.4, 83, 76, -1],
      // The last wall of the col, no ledge on it, up to the camp floor.
      ['col', 18.5, 44, 38, 1],
      // The pillar on the Pic Boby, from its one ledge.
      ['pilier', 7.5, 31, 27, -1],
      // The two hanging blocks under the summit.
      ['bloc 1', 18.5, 25, 22, 1],
      ['bloc 2', 20.5, 22, 19, 1],
    ];
    for (const [name, x, floor, top, dir] of passages) {
      const { s, up, weakest } = takeTurns(start(), x, floor, top, dir);
      expect({ name, up, sync: s.climbers.map((c) => c.sync) }).toEqual({ name, up: true, sync: [0, 0] });
      expect(weakest).toBeGreaterThan(0.05);
    }
  });

  it('the orchid on its plank in the pit by the slab: a swing gets it, a jump from the floor doesn’t', () => {
    const orchid = cellIndex(MOUNTAIN, 4, 78);
    // One grips the top of the slab, the other steps off into the pit, lets the rope out and swings.
    let s = place(start(), 0, { x: 8.3, y: on(76), ground: true });
    s = place(s, 1, { x: 9.2, y: on(76), ground: true });
    const swung = duo(s, [() => ({ grab: true }), (f, me) => (f < 40 ? { mx: -1 } : f < 120 ? { my: 1 } : { mx: me.vx > 0.3 ? 1 : -1 })], 60 * 4);
    expect(swung.s.picked).toContain(orchid);
    // From the floor of the pit, even from a partner's head, a jump falls short (it takes a grip on the plank, and the rope).
    for (const x of [3.5, 4.5, 5.5]) {
      let t = place(start(), 1, { x, y: on(83), ground: true });
      t = place(t, 0, { x, y: on(83) - 2 * PHYS.hh, ground: true });
      expect(duo(t, [(f) => ({ jump: f === 3 }), () => ({})], 90).s.picked).not.toContain(orchid);
    }
  });

  it('a grip tires: the stage’s seconds rested, sooner holding the partner, then it slips and lets go', () => {
    // Gripping the first wall's face alone (the forest: 9 s), the partner at its foot, off to the side.
    const s = place(start(), 1, { x: 19.5, y: on(97) });
    const face = { ...bodyOf(s.climbers[0]), x: 20.66, y: 95, ground: false };
    expect(gripTime(95)).toBe(MOUNTAIN.stages[0].grip);
    let b = run(s, 0, face, () => ({ grab: true }), 60 * 8);
    expect(b.grab).toBe(true);
    expect(b.stamina).toBeCloseTo(1 - 8 / 9, 1);
    // Nearly spent, it slides down the rock, then lets go.
    const y = b.y;
    let slid = 0;
    b = run(s, 0, b, () => ({ grab: true }), 60, (k) => k.grab && (slid = Math.max(slid, k.y - y)));
    expect(slid).toBeGreaterThan(0.1);
    expect(b.tired).toBe(true);
    // Spent, no grip in the air; on its feet, it rests.
    expect(run(s, 0, { ...b, ground: false, y: 95 }, () => ({ grab: true }), 5).grab).toBe(false);
    b = run(s, 0, b, () => ({}), 40);
    expect([b.ground, b.tired]).toEqual([true, false]);
    expect(b.stamina).toBeGreaterThan(0.5);
    // Higher up a grip lasts less, and holding a partner on the rope tires it faster.
    expect(gripTime(20)).toBeLessThan(gripTime(70));
    const alone = tire({ stamina: 1, tired: false, y: 20 }, true, false, false, 1);
    const holdingOn = tire({ stamina: 1, tired: false, y: 20 }, true, false, true, 1);
    expect(1 - holdingOn.stamina).toBeCloseTo((1 - alone.stamina) * GRIP.load);
    // In the air, it doesn't come back.
    expect(tire({ stamina: 0.5, tired: false, y: 20 }, false, false, false, 1).stamina).toBe(0.5);
  });

  it('the server counts the grips too, and refuses one that is spent', () => {
    let s = place(start(), 0, { x: 20.66, y: 95, grab: true, ground: false });
    s = ticks(s, 20);
    expect(s.climbers[0].stamina).toBeLessThan(0.95);
    s = ticks(s, 20 * 10);
    expect([s.climbers[0].grab, s.climbers[0].tired]).toEqual([false, true]);
    const a: TadyAction = { type: 'move', x: 20.66, y: 95, vx: 0, vy: 0, g: false, h: true, r: 0, f: 1, s: 0 };
    const refused = tady.apply(s, a, 'a');
    expect([refused.climbers[0].sync, refused.climbers[0].grab]).toEqual([1, false]);
  });

  it('gusts blow across the col, and a grip holds against them', () => {
    const [w] = MOUNTAIN.winds;
    const time = w.phase + 10;
    expect(gustAt(time, 50)).toBe(w.dir);
    expect(gustAt(w.phase + w.on + 10, 50)).toBe(0);
    expect(gustAt(time, 90)).toBe(0);
    const s = { ...place(start(), 1, { x: 12, y: 53 }), time };
    // In the air over the col.
    const flying = run(s, 0, { ...bodyOf(s.climbers[0]), x: 10, y: 54, ground: false }, () => ({}), 20);
    expect(flying.x - 10).toBeGreaterThan(0.5);
    // Gripping the rock at x 13..16, row 52.
    const held = run(s, 0, { ...bodyOf(s.climbers[0]), x: 14, y: on(52), ground: true }, () => ({ grab: true }), 20);
    expect(held.x).toBe(14);
  });

  it('slides on the ice', () => {
    const stop = (top: number, x: number) => {
      const s = place(start(), 1, { x, y: on(top) });
      return run(s, 0, { ...bodyOf(s.climbers[0]), x, y: on(top), ground: true, vx: PHYS.run }, () => ({}), 30).x - x;
    };
    // The icy bridge (x 9..14, row 27) against the rock under the pillar's foot (x 7..8, row 34).
    expect(stop(27, 9.5)).toBeGreaterThan(stop(103, 3) * 3);
  });
});

describe('tady world', () => {
  it('a crumbling ledge gives way under you, and comes back once nobody is in the way', () => {
    // At x 7..9, row 60.
    const i = cellIndex(MOUNTAIN, 8, 60);
    let s = place(start(), 0, { x: 8.5, y: on(60), ground: true });
    s = ticks(s, 1);
    expect(s.crumble[i]).toBe(0);
    s = ticks(s, 15);
    expect(s.crumble[i]).toBeGreaterThanOrEqual(700);
    expect(s.fx.some((f) => f.t === 'crumble')).toBe(true);
    const fell = run(s, 0, bodyOf(s.climbers[0]), () => ({}), 20);
    expect(fell.y).toBeGreaterThan(on(60) + 0.5);
    s = place(s, 0, { x: 2.5, y: on(62), ground: true });
    s = ticks(s, 80);
    expect(s.crumble[i]).toBeUndefined();
  });

  it('a camp floor catches a fall; in the rough mode only a short drop', () => {
    // Above the camp floor at row 83 (x 14..22), from high up.
    const fall = (chute: string, from: number) => {
      const s = place(start(chute), 1, { x: 18, y: on(83) });
      return run(s, 0, { ...bodyOf(s.climbers[0]), x: 16, y: from, ground: false, peak: from }, () => ({}), 60);
    };
    expect(fall('douce', 76).y).toBeCloseTo(on(83));
    expect(fall('rude', 76).y).toBeGreaterThan(83);
    expect(fall('rude', 81).y).toBeCloseTo(on(83));
  });

  it('picks orchids, reaches camps, counts the long falls', () => {
    let s = place(start(), 0, { x: 22.4, y: on(91), ground: true });
    s = ticks(s, 1);
    expect(s.picked).toEqual([cellIndex(MOUNTAIN, 22, 90)]);
    s = place(s, 0, { x: 15.5, y: on(83), ground: true });
    s = ticks(s, 1);
    expect(s.camp).toBe(1);
    // Up high in the air, then down on the ground far below.
    s = place(s, 0, { x: 16, y: 76, ground: false, peak: 76 });
    s = ticks(s, 1);
    s = place(s, 0, { x: 16, y: on(83), ground: true });
    s = ticks(s, 1);
    expect(s.falls).toBe(1);
  });

  it('stuck? both go back to the last camp, except in the rough mode', () => {
    let s = place(start(), 0, { x: 15.5, y: on(83), ground: true });
    s = ticks(s, 1);
    s = place(s, 0, { x: 10, y: 70 });
    s = tady.apply(s, { type: 'camp' }, 'b');
    const [cx, cy] = cellsWith(MOUNTAIN, 'C').sort((a, b) => b[1] - a[1])[0];
    expect(s.climbers.map((c) => [c.y, c.sync])).toEqual([
      [on(cy + 1), 1],
      [on(cy + 1), 1],
    ]);
    expect(s.climbers.every((c) => Math.abs(c.x - cx - 0.5) < 1)).toBe(true);
    // Before any camp: back to the foot.
    expect(tady.apply(start(), { type: 'camp' }, 'a').climbers.map((c) => c.x)).toEqual([2.5, 3.5]);
    expect(tady.validate(start('rude'), { type: 'camp' }, 'a')).toBe(false);
  });

  it('accepts believable reports, refuses the rest by snapping the device back', () => {
    let s = move(start(), 0, { x: 2.8 });
    expect(s.climbers[0].x).toBe(2.8);
    // Too far in no time.
    const far = move(s, 0, { x: 7 });
    expect(far.climbers[0]).toMatchObject({ x: 2.8, sync: 1 });
    // Inside the rock.
    expect(move(ticks(s, 40), 0, { x: 6.5, y: on(103) + 0.6 }).climbers[0].sync).toBe(1);
    // Further than the rope allows.
    expect(move(ticks(s, 40), 0, { x: 3, y: 95 }).climbers[0].sync).toBe(1);
    // A report from before the snap is ignored.
    expect(tady.apply(far, { type: 'move', x: 3, y: on(103), vx: 0, vy: 0, g: true, h: false, r: 0, f: 1, s: 0 }, 'a')).toBe(far);
  });

  it('refuses malformed actions and strangers', () => {
    const s = start();
    const ok: TadyAction = { type: 'move', x: 3, y: on(103), vx: 0, vy: 0, g: true, h: false, r: 0, f: 1, s: 0 };
    for (const a of [null, {}, { ...ok, type: 'fly' }, { ...ok, x: NaN }, { ...ok, g: 1 }, { ...ok, r: 2 }, { ...ok, f: 0 }, { ...ok, s: 0.5 }]) {
      expect(tady.validate(s, a, 'a')).toBe(false);
    }
    expect(tady.validate(s, ok, 'zz')).toBe(false);
  });

  it('wins once both stand on the summit for a moment', () => {
    const [[x1, y1], [x2]] = cellsWith(MOUNTAIN, 'S');
    let s = place(start(), 0, { x: x1 + 0.5, y: on(y1 + 1), ground: true });
    s = place(s, 1, { x: x2 + 0.5, y: on(y1 + 1), ground: true });
    s = ticks(s, 20);
    expect(s.won).toBe(false);
    s = ticks(s, 5);
    expect(tady.result(s)).toEqual({ kind: 'win', winners: P });
    expect(tady.validate(s, { type: 'move', x: 3, y: 12, vx: 0, vy: 0, g: true, h: false, r: 0, f: 1, s: 0 }, 'a')).toBe(false);
  });

  it('never mutates the state it is given', () => {
    const s = place(start(), 0, { x: 8.5, y: on(60), ground: true });
    const copy = structuredClone(s);
    ticks(s, 30);
    move(s, 1, { x: 3.7 });
    expect(s).toEqual(copy);
  });
});

describe('tady route', () => {
  for (const chute of ['douce', 'rude']) {
    it(`leads from the foot to the summit (${chute}), without a report refused`, () => {
      let s = start(chute);
      const plans: Progress[] = [{ step: 0 }, { step: 0 }];
      for (let t = 0; t < 20000 && !s.won; t++) {
        for (const seat of [0, 1]) {
          const a = nextAction(s, seat, plans);
          if (a) s = tady.apply(s, a, P[seat]);
        }
        s = tady.tick!(s, 50);
        expect(s.climbers.map((c) => c.sync)).toEqual([0, 0]);
      }
      expect(s.won).toBe(true);
      expect(s.camp).toBe(MOUNTAIN.stages.length - 1);
    });
  }
});
