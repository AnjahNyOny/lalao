import { describe, expect, it } from 'vitest';
import {
  bodyOf,
  cellIndex,
  heightAt,
  LEVELS,
  miaraka,
  NEXT_MS,
  PHYS,
  step,
  type Avatar,
  type Body,
  type MiarakaAction,
  type MiarakaState,
  type Role,
} from '.';
import { nextAction, type Progress } from './solution';

const P = ['a', 'b'];
const start = (level = 1, chrono?: string) => miaraka.setup(P, 1, { niveau: String(level), ...(chrono ? { chrono } : {}) });
const MAKI = 0;
const ZEBU = 1;
const EAST = Math.PI / 2;
const NORTH = Math.PI;

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
const ticks = (s: MiarakaState, n: number) => {
  for (let i = 0; i < n; i++) s = tick(s);
  return s;
};
const move = (s: MiarakaState, seat: number, x: number, z: number, y = 0) =>
  act(s, P[seat], { type: 'move', x, y, z, f: 0, s: s.avatars[seat].sync });
const charge = (s: MiarakaState, f: number) => act(s, P[ZEBU], { type: 'charge', f });
const still = { mx: 0, mz: 0, jump: false, charge: false };
/** Runs a device's movement for some frames of 1/60 s. */
const run = (s: MiarakaState, role: Role, b: Body, input: Partial<typeof still>, frames: number) => {
  for (let i = 0; i < frames; i++) b = step(s, role, b, { ...still, ...input, jump: !!input.jump && i === 0, charge: !!input.charge && i === 0 }, 1 / 60).body;
  return b;
};

describe('miaraka setup', () => {
  it('puts the maki and the zebu at their starts, the maki first unless picked otherwise', () => {
    const s = start();
    expect(s.avatars.map((a) => [a.role, a.x, a.z])).toEqual([
      ['maki', 2.5, 6.5],
      ['zebu', 2.5, 8.5],
    ]);
    expect(miaraka.setup(P, 1, {}, ['zebu', 'maki']).avatars.map((a) => a.role)).toEqual(['zebu', 'maki']);
    expect(s.limit).toBe(null);
    expect(start(1, '5').limit).toBe(5 * 60_000);
  });

  it('starts at the level the host picked, and runs to the last one', () => {
    expect(start().level).toBe(0);
    expect(start(3)).toMatchObject({ level: 2, last: LEVELS.length - 1 });
    expect(miaraka.setup(P, 1, { niveau: '99' }).level).toBe(LEVELS.length - 1);
    expect(miaraka.setup(P, 1, { niveau: 'n’importe' }).level).toBe(0);
  });

  it('every level has its starts, two treasure pads, and the foes and groups it names', () => {
    for (const l of LEVELS) {
      const text = l.rows.join('');
      expect(new Set(l.rows.map((r) => r.length)).size).toBe(1);
      expect(text.match(/m/g)).toHaveLength(1);
      expect(text.match(/z/g)).toHaveLength(1);
      expect(text.match(/T/g)).toHaveLength(2);
      for (const g of Object.keys(l.groups)) {
        expect(text).toContain(g);
        expect(text).toContain(g.toUpperCase());
      }
    }
  });
});

describe('miaraka movement', () => {
  it('walks, and stops against walls', () => {
    const b = run(start(), 'maki', bodyOf(start().avatars[MAKI]), { mx: -1 }, 60);
    expect(b.x).toBeCloseTo(1 + 0.28, 2);
  });

  it('the maki jumps up onto a ledge, the zebu cannot', () => {
    const s = start();
    // Under the ledge at (4,2)-(5,3), facing north.
    let b = run(s, 'maki', { ...bodyOf(s.avatars[MAKI]), x: 4.5, z: 4.6 }, { jump: true }, 1);
    b = run(s, 'maki', b, { mz: -1 }, 15);
    b = run(s, 'maki', b, {}, 60);
    expect(b.y).toBe(PHYS.ledge);
    expect(Math.floor(b.z)).toBe(3);
    const z = run(s, 'zebu', { ...bodyOf(s.avatars[ZEBU]), x: 4.5, z: 4.6 }, { mz: -1, jump: true }, 40);
    expect(z.y).toBe(0);
    expect(z.z).toBeGreaterThan(4);
  });

  it('the maki can’t jump up a high rock alone, but can from the zebu’s back', () => {
    // Level 3: the rock and its lever at (4,1)-(5,1).
    let s = start(3);
    let b = run(s, 'maki', { ...bodyOf(s.avatars[MAKI]), x: 4.5, z: 2.4 }, { jump: true, mz: -1 }, 30);
    b = run(s, 'maki', b, {}, 60);
    expect(b.y).toBe(0);
    expect(b.z).toBeGreaterThan(2);
    // The zebu stands under the rock: the maki hops onto its back, then up.
    s = put(s, ZEBU, 4.5, 2.5);
    b = run(s, 'maki', { ...bodyOf(s.avatars[MAKI]), x: 4.5, z: 3.6 }, { mz: -1 }, 20);
    expect(b.y).toBe(0);
    expect(b.z).toBeGreaterThan(2.5 + 0.6);
    b = run(s, 'maki', b, { jump: true, mz: -1 }, 12);
    b = run(s, 'maki', b, {}, 40);
    expect(b.y).toBeCloseTo(PHYS.back);
    b = run(s, 'maki', b, { jump: true, mz: -1 }, 40);
    b = run(s, 'maki', b, {}, 60);
    expect(b.y).toBe(PHYS.high);
    expect(Math.floor(b.z)).toBe(1);
  });

  it('rotten planks hold the maki and give way under the zebu', () => {
    // Level 2: planks at (19,1)-(20,1).
    const s = start(2);
    expect(heightAt(s, 19, 1, 'maki')).toBe(0);
    expect(heightAt(s, 19, 1, 'zebu')).toBe(PHYS.water);
    const fell = tick(put(s, ZEBU, 19.5, 1.5, PHYS.water));
    expect(fell.avatars[ZEBU].sync).toBe(1);
    expect(fell.fx.at(-1)?.t).toBe('fall');
    expect(tick(put(s, MAKI, 19.5, 1.5)).avatars[MAKI].sync).toBe(0);
  });

  it('a charging zebu stops at the water’s edge; walking on, it falls in', () => {
    // Level 1: the river starts at x = 21.
    const s = start();
    const b = run(s, 'zebu', { ...bodyOf(s.avatars[ZEBU]), x: 19.5, z: 3.5, f: EAST }, { charge: true }, 30);
    expect(b.y).toBe(0);
    expect(b.x).toBeLessThan(21);
    const w = run(s, 'zebu', { ...bodyOf(s.avatars[ZEBU]), x: 19.5, z: 3.5 }, { mx: 1 }, 60);
    expect(w.y).toBe(PHYS.water);
  });

  it('accepts believable reports, refuses the rest by snapping the device back', () => {
    let s = move(start(), MAKI, 2.7, 6.5);
    expect(s.avatars[MAKI].x).toBe(2.7);
    // Too far in no time.
    const far = move(s, MAKI, 6, 6.5);
    expect(far.avatars[MAKI]).toMatchObject({ x: 2.7, sync: 1 });
    // Inside a wall.
    expect(move(tick(s, 2000), MAKI, 0.5, 6.5).avatars[MAKI].sync).toBe(1);
    // A zebu doesn't get up on ledges, nor the maki on a high rock from the ground.
    s = put(start(), ZEBU, 4.5, 4.6);
    expect(move(s, ZEBU, 4.5, 3.6, PHYS.ledge).avatars[ZEBU].sync).toBe(1);
    expect(move(put(start(3), MAKI, 4.5, 2.5), MAKI, 4.5, 1.6, PHYS.high).avatars[MAKI].sync).toBe(1);
    expect(move(put(start(3), MAKI, 4.5, 2.5, PHYS.back), MAKI, 4.5, 1.6, PHYS.high).avatars[MAKI].sync).toBe(0);
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
  const l = LEVELS[0];

  it('the zebu breaks a cracked wall, and only it', () => {
    const s = charge(put(start(), ZEBU, 6.4, 7.5), EAST);
    expect(s.broken).toEqual([cellIndex(l, 7, 7)]);
    expect(heightAt(s, 7, 7)).toBe(0);
    expect(s.fx.at(-1)?.t).toBe('break');
  });

  it('a heavy plate holds a gate open under the zebu, not under the maki', () => {
    expect(tick(put(start(), MAKI, 11.5, 3.5)).open).toEqual([]);
    const held = tick(put(start(), ZEBU, 11.5, 3.5));
    expect(held.open).toEqual(['a']);
    expect(held.pressed).toEqual([cellIndex(l, 11, 3)]);
    expect(heightAt(held, 15, 5)).toBe(0);
    expect(tick(put(held, ZEBU, 10.5, 3.5)).open).toEqual([]);
  });

  it('a lever, once pulled, stays pulled', () => {
    let s = tick(put(start(), MAKI, 19.5, 2.5, PHYS.ledge));
    expect(s.levers).toEqual(['b']);
    s = tick(put(s, MAKI, 17.5, 7.5));
    expect(s.open).toContain('b');
  });

  it('a timed lever springs back, and works again once its puller has stepped away', () => {
    // Level 2: the lever at (10,1) opens the gate at (12,12) for a while.
    let s = tick(put(start(2), ZEBU, 10.5, 2.2));
    expect(s.open).toContain('b');
    s = ticks(s, 4500 / 50);
    expect(s.open).not.toContain('b');
    // Still standing there: it doesn't come back on by itself.
    expect(ticks(s, 10).open).not.toContain('b');
    s = tick(put(s, ZEBU, 10.5, 6.5));
    expect(tick(put(s, ZEBU, 10.5, 2.2)).open).toContain('b');
  });

  it('plates that go together open their gate for good once all are pressed at once', () => {
    // Level 2: three plates; the crate on one, an animal on each of the others.
    let s = start(2);
    s = put(put(s, MAKI, 6.5, 2.5), ZEBU, 6.5, 12.5);
    expect(tick(s).levers).toEqual([]);
    expect(tick(s).pressed).toHaveLength(2);
    s = { ...s, crates: [{ ...s.crates[0], x: 5, z: 5 }] };
    s = tick(s);
    expect(s.levers).toEqual(['a']);
    s = tick(put(put(s, MAKI, 2.5, 2.5), ZEBU, 2.5, 12.5));
    expect(s.open).toContain('a');
  });

  it('the zebu pushes the crate onto the plate, and the bridge comes up', () => {
    let s = charge(put(start(), ZEBU, 16.5, 10.5), EAST);
    expect(s.crates.map((c) => [c.x, c.z])).toEqual([[18, 10]]);
    s = charge(put(tick(s, 1000), ZEBU, 17.5, 10.5), EAST);
    s = tick(s);
    expect(s.crates.map((c) => [c.x, c.z])).toEqual([[19, 10]]);
    expect(s.open).toContain('c');
    expect(heightAt(s, 21, 7)).toBe(0);
    // Too soon after a charge: nothing happens.
    expect(miaraka.apply(s, { type: 'charge', f: EAST }, 'b').crates[0]).toMatchObject({ x: 19, z: 10 });
  });

  it('a crate that can’t go goes back where it started', () => {
    // Level 1: the crate at (17,10), pushed north, then east to the river.
    let s = tick(charge(put(start(), ZEBU, 17.5, 11.5), NORTH), 1000);
    expect(s.crates[0]).toMatchObject({ x: 17, z: 9 });
    for (const x of [16.5, 17.5, 18.5]) s = tick(charge(put(s, ZEBU, x, 9.5), EAST), 1000);
    expect(s.crates[0]).toMatchObject({ x: 20, z: 9 });
    // Into the river at (21,9): deep water carries it off, and it comes home.
    s = tick(charge(put(s, ZEBU, 19.5, 9.5), EAST), 1000);
    expect(s.crates[0]).toMatchObject({ x: 17, z: 10, sunk: false });
    expect(s.fx.at(-1)?.t).toBe('home');
    // Someone in the way: it just doesn't move.
    s = charge(put(put(s, MAKI, 18.5, 10.5), ZEBU, 16.5, 10.5), EAST);
    expect(s.crates[0]).toMatchObject({ x: 17, z: 10 });
  });

  it('crates pushed into the shallows sink and make a ford', () => {
    // Level 3: shallows at (12,7)-(13,7), crates at (11,7) and (11,9).
    let s = start(3);
    expect(heightAt(s, 12, 7)).toBe(PHYS.water);
    s = tick(charge(put(s, ZEBU, 10.5, 7.5), EAST), 1000);
    expect(s.crates[0]).toMatchObject({ x: 12, z: 7, sunk: true });
    expect(heightAt(s, 12, 7)).toBe(0);
    for (const z of [10.5, 9.5]) s = tick(charge(put(s, ZEBU, 11.5, z), NORTH), 1000);
    expect(s.crates[1]).toMatchObject({ x: 11, z: 7 });
    s = tick(charge(put(s, ZEBU, 10.5, 7.5), EAST), 1000);
    // Over the sunk one, standing on it…
    expect(s.crates[1]).toMatchObject({ x: 12, z: 7, sunk: false });
    expect(heightAt(s, 12, 7)).toBe(PHYS.crate);
    s = tick(charge(put(s, ZEBU, 11.5, 7.5), EAST), 1000);
    // …then into the next one.
    expect(s.crates[1]).toMatchObject({ x: 13, z: 7, sunk: true });
    expect([heightAt(s, 12, 7), heightAt(s, 13, 7)]).toEqual([0, 0]);
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
    s = tick(put({ ...s, foes: [{ ...s.foes[0], x: 21.5, z: 7.5 }] }, ZEBU, 21.5, 7.5));
    expect(s.fx.at(-1)?.t).toBe('bite');
  });

  it('a charge stuns the crocodile', () => {
    const s0 = start();
    const s = charge(put({ ...s0, foes: [{ ...s0.foes[0], x: 21.5, z: 7.5 }] }, ZEBU, 20.3, 7.5), EAST);
    expect(s.foes[0].stun).toBeGreaterThan(0);
    expect(tick(s).fx.at(-1)?.t).not.toBe('bite');
  });

  it('bats hit whoever is up high, and fly over those on the ground', () => {
    // Level 2: the bat crosses the raised path at (15,3).
    const s0 = start(2);
    const s = { ...s0, foes: [{ ...s0.foes[0], x: 15.5, z: 3.5 }] };
    expect(tick(put(s, MAKI, 15.5, 3.5, PHYS.ledge)).fx.at(-1)?.t).toBe('bite');
    expect(tick(put(s, MAKI, 15.5, 3.5, 0)).avatars[MAKI].sync).toBe(0);
    // Out of the zebu's reach, too.
    expect(charge(put(s, ZEBU, 14.6, 3.5), EAST).foes[0].stun).toBe(0);
  });

  it('the fosa runs at whoever comes near on the ground, bites, then rests; a charge stuns it', () => {
    // Level 4: the fosa starts at (15.5,9.5).
    let s = put(start(4), MAKI, 15.5, 12);
    s = tick(s);
    expect(s.foes[0].hunt).toBe(MAKI);
    const before = Math.hypot(s.foes[0].x - 15.5, s.foes[0].z - 12);
    s = ticks(s, 5);
    expect(Math.hypot(s.foes[0].x - 15.5, s.foes[0].z - 12)).toBeLessThan(before);
    s = ticks(s, 30);
    expect(s.avatars[MAKI].sync).toBe(1);
    expect(s.foes[0]).toMatchObject({ hunt: -1 });
    expect(s.foes[0].stun).toBeGreaterThan(0);
    // Up on a ledge, or across a gate, the maki is out of its reach.
    const up = tick(put(start(4), MAKI, 16.5, 2.5, PHYS.ledge));
    expect(up.foes[0].hunt).toBe(-1);
    // The zebu charges it.
    const s1 = put(start(4), ZEBU, 14.3, 9.5);
    const stun = charge(s1, EAST);
    expect(stun.foes[0].stun).toBeGreaterThan(2000);
    expect(ticks(stun, 20).avatars[ZEBU].sync).toBe(0);
  });

  it('wins when both stand on the treasure pads of the last level; loses when time runs out', () => {
    let s = put(put(start(4), MAKI, 31.5, 3.5), ZEBU, 31.5, 12.5);
    s = ticks(s, 19);
    expect(s.won).toBe(false);
    s = ticks(s, 2);
    expect(miaraka.result(s)).toEqual({ kind: 'win', winners: P });
    expect(miaraka.validate(s, { type: 'charge', f: 0 }, 'b')).toBe(false);
    const late = tick(start(1, '5'), 5 * 60_000);
    expect(miaraka.result(late)).toEqual({ kind: 'lose' });
  });

  it('a treasure before the last level opens the way to the next', () => {
    let s = put(put(start(), MAKI, 31.5, 3.5), ZEBU, 31.5, 11.5);
    s = { ...s, vanilla: 3 };
    s = ticks(s, 21);
    expect(s.cleared).not.toBe(null);
    expect(miaraka.result(s)).toBe(null);
    // Nobody moves in the meantime.
    expect(miaraka.validate(s, { type: 'charge', f: 0 }, 'b')).toBe(false);
    s = ticks(s, NEXT_MS / 50 - 1);
    expect(s).toMatchObject({ level: 1, cleared: null, time: 0, vanilla: 0, bag: 3, keys: 0, levers: [] });
    expect(s.avatars.map((a) => [a.x, a.z, a.sync])).toEqual([
      [2.5, 6.5, 1],
      [2.5, 8.5, 1],
    ]);
  });

  it('never mutates the state it is given', () => {
    const s = put(start(), ZEBU, 6.4, 7.5);
    const copy = structuredClone(s);
    tick(charge(s, EAST), 50);
    move(s, MAKI, 2.6, 6.5);
    expect(s).toEqual(copy);
  });
});

/** Both follow the solution; returns the state when the level ends, checking nobody gets snapped back. */
function playLevel(s: MiarakaState, plans: Progress[]): MiarakaState {
  const level = s.level;
  const syncs = s.avatars.map((a) => a.sync);
  for (let t = 0; t < 6000 && s.level === level && !s.won; t++) {
    for (const seat of [0, 1]) {
      const a = nextAction(s, seat, plans[seat]);
      if (a && miaraka.validate(s, a, P[seat])) s = miaraka.apply(s, a, P[seat]);
    }
    s = tick(s);
    if (s.level === level) expect(s.avatars.map((a) => a.sync)).toEqual(syncs);
  }
  return s;
}

describe('miaraka levels', () => {
  for (const [i, l] of LEVELS.entries()) {
    it(`${i + 1}. ${l.name} can be finished by the two of them, following the solution`, () => {
      const s = playLevel(start(i + 1), [{ step: 0 }, { step: 0 }]);
      expect(s.level !== i || s.won).toBe(true);
    });
  }

  it('a whole run, from the first level to the last treasure', () => {
    let s = start();
    const plans: Progress[] = [{ step: 0 }, { step: 0 }];
    let time = 0;
    while (!s.won && s.level < LEVELS.length) {
      const level = s.level;
      s = playLevel(s, plans);
      time += s.time;
      if (!s.won) expect(s.level).toBe(level + 1);
    }
    expect(s.won).toBe(true);
    expect(time).toBeLessThan(5 * 60_000);
  });
});
