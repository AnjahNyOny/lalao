import { describe, expect, it } from 'vitest';
import {
  bodyOf,
  cellIndex,
  heightAt,
  LEVELS,
  miaraka,
  PHYS,
  step,
  type Avatar,
  type MiarakaAction,
  type MiarakaState,
} from '.';
import { nextAction, type Progress } from './solution';

const P = ['a', 'b'];
const l = LEVELS[0];
const start = () => miaraka.setup(P, 1);
const MAKI = 0;
const ZEBU = 1;

/** Puts an avatar somewhere (cell centre by default), as if it had walked there. */
function put(s: MiarakaState, seat: number, x: number, z: number, y = 0): MiarakaState {
  const avatars = s.avatars.map((a, i): Avatar => (i === seat ? { ...a, x, z, y, at: s.time } : a));
  return { ...s, avatars };
}
const act = (s: MiarakaState, by: string, a: MiarakaAction) => {
  expect(miaraka.validate(s, a, by)).toBe(true);
  return miaraka.apply(s, a, by);
};
const tick = (s: MiarakaState, ms = 50) => miaraka.tick!(s, ms);
const move = (s: MiarakaState, seat: number, x: number, z: number, y = 0) =>
  act(s, P[seat], { type: 'move', x, y, z, f: 0, s: s.avatars[seat].sync });
const still = { mx: 0, mz: 0, jump: false, charge: false };

describe('miaraka setup', () => {
  it('puts the maki and the zebu at their starts, the maki first unless picked otherwise', () => {
    const s = start();
    expect(s.avatars.map((a) => [a.role, a.x, a.z])).toEqual([
      ['maki', 2.5, 6.5],
      ['zebu', 2.5, 8.5],
    ]);
    expect(miaraka.setup(P, 1, {}, ['zebu', 'maki']).avatars.map((a) => a.role)).toEqual(['zebu', 'maki']);
    expect(s.limit).toBe(null);
    expect(miaraka.setup(P, 1, { chrono: '6' }).limit).toBe(6 * 60_000);
  });
});

describe('miaraka movement', () => {
  it('walks, and stops against walls', () => {
    let b = bodyOf(start().avatars[MAKI]);
    for (let i = 0; i < 60; i++) b = step(start(), 'maki', b, { ...still, mx: -1 }, 1 / 60).body;
    expect(b.x).toBeCloseTo(1 + 0.28, 2);
  });

  it('the maki jumps up onto a ledge, the zebu cannot', () => {
    const s = start();
    // Under the ledge at (4,2)-(5,3), facing north.
    let b = { ...bodyOf(s.avatars[MAKI]), x: 4.5, z: 4.6 };
    b = step(s, 'maki', b, { ...still, jump: true }, 1 / 60).body;
    for (let i = 0; i < 15; i++) b = step(s, 'maki', b, { ...still, mz: -1 }, 1 / 60).body;
    for (let i = 0; i < 60; i++) b = step(s, 'maki', b, still, 1 / 60).body;
    expect(b.y).toBe(PHYS.ledge);
    expect(Math.floor(b.z)).toBe(3);
    let z = { ...bodyOf(s.avatars[ZEBU]), x: 4.5, z: 4.6 };
    for (let i = 0; i < 40; i++) z = step(s, 'zebu', z, { ...still, mz: -1, jump: true }, 1 / 60).body;
    expect(z.y).toBe(0);
    expect(z.z).toBeGreaterThan(4);
  });

  it('accepts believable reports, refuses the rest by snapping the device back', () => {
    let s = move(start(), MAKI, 2.7, 6.5);
    expect(s.avatars[MAKI].x).toBe(2.7);
    // Too far in no time.
    const far = move(s, MAKI, 6, 6.5);
    expect(far.avatars[MAKI]).toMatchObject({ x: 2.7, sync: 1 });
    // Inside a wall.
    expect(move(tick(s, 2000), MAKI, 0.5, 6.5).avatars[MAKI].sync).toBe(1);
    // A zebu doesn't get up on ledges.
    s = put(start(), ZEBU, 4.5, 4.6);
    expect(move(s, ZEBU, 4.5, 3.6, PHYS.ledge).avatars[ZEBU].sync).toBe(1);
    // A report from before the snap is ignored.
    expect(miaraka.apply(far, { type: 'move', x: 3, y: 0, z: 6.5, f: 0, s: 0 }, 'a')).toBe(far);
  });

  it('refuses malformed actions, and charges from the maki', () => {
    const s = start();
    for (const a of [null, {}, { type: 'move', x: 1 }, { type: 'move', x: NaN, y: 0, z: 0, f: 0, s: 0 }, { type: 'fly' }]) {
      expect(miaraka.validate(s, a, 'a')).toBe(false);
    }
    expect(miaraka.validate(s, { type: 'charge', f: 0 }, 'a')).toBe(false);
    expect(miaraka.validate(s, { type: 'charge', f: 0 }, 'zz')).toBe(false);
  });
});

describe('miaraka world', () => {
  const EAST = Math.PI / 2;

  it('the zebu breaks a cracked wall, and only it', () => {
    const s = act(put(start(), ZEBU, 6.4, 7.5), 'b', { type: 'charge', f: EAST });
    expect(s.broken).toEqual([cellIndex(l, 7, 7)]);
    expect(heightAt(s, 7, 7)).toBe(0);
    expect(s.fx.at(-1)?.t).toBe('break');
  });

  it('a heavy plate holds a gate open under the zebu, not under the maki', () => {
    expect(tick(put(start(), MAKI, 11.5, 3.5)).open).toEqual([]);
    const held = tick(put(start(), ZEBU, 11.5, 3.5));
    expect(held.open).toEqual(['a']);
    expect(heightAt(held, 15, 5)).toBe(0);
    expect(tick(put(held, ZEBU, 10.5, 3.5)).open).toEqual([]);
  });

  it('a lever, once pulled, stays pulled', () => {
    let s = tick(put(start(), MAKI, 19.5, 2.5, PHYS.ledge));
    expect(s.levers).toEqual(['b']);
    s = tick(put(s, MAKI, 17.5, 7.5));
    expect(s.open).toContain('b');
  });

  it('the zebu pushes the crate onto the plate, and the bridge comes up', () => {
    let s = act(put(start(), ZEBU, 16.5, 10.5), 'b', { type: 'charge', f: EAST });
    expect(s.crates).toEqual([[18, 10]]);
    s = act(put(tick(s, 1000), ZEBU, 17.5, 10.5), 'b', { type: 'charge', f: EAST });
    s = tick(s);
    expect(s.crates).toEqual([[19, 10]]);
    expect(s.open).toContain('c');
    expect(heightAt(s, 21, 7)).toBe(0);
    // Too soon after a charge: nothing happens.
    expect(miaraka.apply(s, { type: 'charge', f: EAST }, 'b').crates).toEqual([[19, 10]]);
  });

  it('picks up keys and vanilla, and a key opens the door it touches', () => {
    let s = tick(put(start(), MAKI, 26.5, 1.5, PHYS.ledge));
    expect(s.keys).toBe(1);
    s = tick(put(s, MAKI, 28.5, 7.5));
    expect(s.doors).toEqual([cellIndex(l, 29, 7)]);
    expect(s.keys).toBe(0);
    s = tick(put(s, ZEBU, 9.5, 11.5));
    expect(s.vanilla).toBe(1);
  });

  it('a fall in the water or a bite brings you back to your last checkpoint', () => {
    let s = tick(put(start(), MAKI, 17.5, 7.5));
    expect(s.avatars[MAKI].check).toEqual([17.5, 7.5]);
    s = tick(put(s, MAKI, 21.5, 9.5, PHYS.water));
    expect(s.avatars[MAKI]).toMatchObject({ x: 17.5, z: 7.5, sync: 1 });
    expect(s.fx.at(-1)?.t).toBe('splash');
    // The crocodile, swimming down from the top of the river.
    const c = s.crocs[0];
    s = tick(put({ ...s, crocs: [{ ...c, x: 21.5, z: 7.5 }] }, ZEBU, 21.5, 7.5));
    expect(s.fx.at(-1)?.t).toBe('bite');
  });

  it('a charge stuns the crocodile', () => {
    const s0 = start();
    const s = act(put({ ...s0, crocs: [{ ...s0.crocs[0], x: 21.5, z: 7.5 }] }, ZEBU, 20.3, 7.5), 'b', { type: 'charge', f: EAST });
    expect(s.crocs[0].stun).toBeGreaterThan(0);
    expect(tick(s).fx.at(-1)?.t).not.toBe('bite');
  });

  it('wins when both stand on the treasure pads for a second; loses when time runs out', () => {
    let s = put(put(start(), MAKI, 31.5, 3.5), ZEBU, 31.5, 11.5);
    for (let i = 0; i < 19; i++) s = tick(s);
    expect(s.won).toBe(false);
    s = tick(tick(s));
    expect(miaraka.result(s)).toEqual({ kind: 'win', winners: P });
    expect(miaraka.validate(s, { type: 'charge', f: 0 }, 'b')).toBe(false);
    const late = tick(miaraka.setup(P, 1, { chrono: '6' }), 6 * 60_000);
    expect(miaraka.result(late)).toEqual({ kind: 'lose' });
  });

  it('never mutates the state it is given', () => {
    const s = put(start(), ZEBU, 6.4, 7.5);
    const copy = structuredClone(s);
    tick(act(s, 'b', { type: 'charge', f: EAST }), 50);
    move(s, MAKI, 2.6, 6.5);
    expect(s).toEqual(copy);
  });
});

describe('miaraka level', () => {
  it('can be finished by the two of them, following the solution', () => {
    let s = start();
    const plans: Progress[] = [{ step: 0 }, { step: 0 }];
    for (let t = 0; t < 6000 && !s.won; t++) {
      for (const seat of [0, 1]) {
        const a = nextAction(s, seat, plans[seat]);
        if (a) s = act(s, P[seat], a);
      }
      s = tick(s);
      expect(s.avatars.every((a) => a.sync === 0)).toBe(true);
    }
    expect(s.won).toBe(true);
    // A few minutes of play at most.
    expect(s.time).toBeLessThan(5 * 60_000);
  });
});
