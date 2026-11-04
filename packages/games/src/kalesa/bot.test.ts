import { BOT_LEVELS, mulberry32, type BotLevel } from '@game/core';
import { describe, expect, it } from 'vitest';
import { bestShape, COUNTDOWN_MS, kalesa, scoreOn, segmentAt, SHAPES, trackOf, type KalesaState } from '.';

/**
 * A whole race between bots, the way a room plays it: each bot is asked
 * every tick, and what it draws lands a moment later.
 */
function race(levels: BotLevel[], seed: number, options: Record<string, string> = { piste: 'hasard', longueur: 'sprint' }) {
  const players = levels.map((_, i) => `bot${i}`);
  const rand = mulberry32(seed);
  let s: KalesaState = kalesa.setup(players, seed, options);
  const waiting = new Map<number, number>();
  let illegal = 0;
  for (let k = 0; k < 20 * 300 && !s.over; k++) {
    s = kalesa.tick!(s, 50);
    levels.forEach((level, seat) => {
      const due = waiting.get(seat);
      if (due === undefined) {
        if (kalesa.bot!(s, players[seat], level, rand)) waiting.set(seat, s.time + 150);
        return;
      }
      if (due > s.time) return;
      waiting.delete(seat);
      const a = kalesa.bot!(s, players[seat], level, rand);
      if (!a) return;
      if (!kalesa.validate(s, a, players[seat])) illegal++;
      else s = kalesa.apply(s, a, players[seat]);
    });
  }
  return { s, illegal, winner: kalesa.result(s)?.kind === 'win' ? (kalesa.result(s) as { winners: string[] }).winners : [] };
}

describe('kalesa bot', () => {
  it('does nothing for a seat that is not its own, or once it is over', () => {
    const s = kalesa.setup(['a', 'b'], 1, {});
    const later = kalesa.tick!(s, COUNTDOWN_MS);
    expect(kalesa.bot!(later, 'z', 'hard', mulberry32(1))).toBeNull();
    expect(kalesa.bot!({ ...later, over: true }, 'a', 'hard', mulberry32(1))).toBeNull();
  });

  it('knows a best shape for every terrain, and draws it for the road ahead', () => {
    expect(bestShape('goudron').name).toBe('grand rond');
    expect(bestShape('glissant').name).toBe('crampons');
    expect(bestShape('boue').name).toMatch(/étoile|croix/);
    let s = kalesa.tick!(kalesa.setup(['a', 'b'], 1, { piste: 'rn7' }), COUNTDOWN_MS);
    const road = trackOf(s.course);
    // Just before the potholes, the hard bot already wants a big wheel.
    const edge = segmentAt(road, 0).end;
    s = { ...s, cars: s.cars.map((c, i) => (i === 0 ? { ...c, d: edge - 1, v: 12 } : c)) };
    const a = kalesa.bot!(s, 'a', 'hard', mulberry32(3));
    expect(a).not.toBeNull();
    expect(kalesa.validate(s, a, 'a')).toBe(true);
    const drawn = kalesa.apply(s, a!, 'a').cars[0].wheel;
    expect(scoreOn('trous', drawn)).toBeGreaterThan(0.9);
    // Once it has that wheel, it leaves it alone.
    expect(kalesa.bot!(kalesa.apply(s, a!, 'a'), 'a', 'hard', mulberry32(3))).toBeNull();
  });

  it.each(BOT_LEVELS)('%s only ever draws legal wheels, and gets to the end', (level) => {
    const { s, illegal } = race([level, level, level], 5);
    expect(illegal).toBe(0);
    expect(s.over).toBe(true);
    expect(s.cars.some((c) => c.finish !== null)).toBe(true);
  });

  it('hard clearly beats easy, and medium beats easy', () => {
    let hard = 0;
    let medium = 0;
    for (let seed = 1; seed <= 10; seed++) {
      if (race(['hard', 'easy'], seed).winner.includes('bot0')) hard++;
      if (race(['medium', 'easy'], seed).winner.includes('bot0')) medium++;
    }
    expect(hard).toBeGreaterThanOrEqual(8);
    expect(medium).toBeGreaterThanOrEqual(8);
  });

  it('hard beats medium most of the time', () => {
    let hard = 0;
    for (let seed = 1; seed <= 10; seed++) if (race(['hard', 'medium'], seed).winner.includes('bot0')) hard++;
    expect(hard).toBeGreaterThanOrEqual(7);
  });

  it('decides quickly', () => {
    let s = kalesa.tick!(kalesa.setup(['a', 'b', 'c', 'd'], 1, {}), COUNTDOWN_MS + 5000);
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) {
      s = kalesa.tick!(s, 50);
      kalesa.bot!(s, 'a', 'hard', Math.random);
    }
    expect((performance.now() - t0) / 200).toBeLessThan(5);
    expect(SHAPES.length).toBeGreaterThan(4);
  });
});
