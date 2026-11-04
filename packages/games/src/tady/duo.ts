/** Two devices and the server, frame by frame, as in a real game: for the tests of moves done together. */
import { bodyOf, PHYS, step, tady, type Body, type Input, type TadyState } from '.';

export type Script = (frame: number, me: Body, s: TadyState) => Partial<Input>;
const still: Input = { mx: 0, my: 0, jump: false, grab: false };

export function duo(s: TadyState, scripts: [Script, Script], frames: number, log?: (s: TadyState, bodies: Body[], f: number) => void) {
  const bodies = s.climbers.map(bodyOf);
  let since = 0;
  for (let f = 0; f < frames; f++) {
    for (const seat of [0, 1]) {
      const input = { ...still, ...scripts[seat](f, bodies[seat], s) };
      const b = step(s, seat, bodies[seat], input, 1 / 60);
      bodies[seat] = b;
      const c = s.climbers[seat];
      const action = { type: 'move' as const, x: b.x, y: b.y, vx: b.vx, vy: b.vy, g: b.ground, h: b.grab, r: (input.my < -0.5 ? 1 : input.my > 0.5 ? -1 : 0) as -1 | 0 | 1, f: b.face, s: c.sync };
      if (tady.validate(s, action, s.players[seat])) s = tady.apply(s, action, s.players[seat]);
      if (s.climbers[seat].sync !== c.sync) bodies[seat] = bodyOf(s.climbers[seat]);
    }
    since += 1000 / 60;
    while (since >= 50) {
      s = tady.tick!(s, 50);
      since -= 50;
    }
    log?.(s, bodies, f);
  }
  return { s, bodies };
}

/**
 * Up a face, taking turns: seat 0 jumps from seat 1's head and grips; then
 * the lower one climbs the rope and pulls up past the other, who holds, and
 * they swap, until both stand above `top`. The face is on the `dir` side.
 */
export function takeTurns(s: TadyState, x: number, floor: number, top: number, dir: 1 | -1, frames = 60 * 30) {
  const on = (row: number) => row - PHYS.hh;
  s = { ...s, climbers: s.climbers.map((c, i) => ({ ...c, x, y: on(floor) - (i === 0 ? 2 * PHYS.hh : 0), vx: 0, vy: 0, ground: true, grab: false, at: s.time })) };
  const above = (b: { y: number }) => b.y < on(top) + 0.1;
  const turn =
    (seat: number): Script =>
    (f, me, st) => {
      const other = st.climbers[1 - seat];
      if (seat === 0 && f === 5) return { jump: true, mx: dir };
      if (f < 30) return seat === 0 ? { mx: dir, grab: f > 22 } : {};
      if (above(me) && (me.ground || me.grab)) return above(other) && other.ground ? {} : { grab: true };
      if (above(me)) return { mx: dir };
      if (me.y < other.y - 0.15) return { grab: true, mx: dir };
      if (other.grab) return { my: -1, mx: dir };
      return { grab: true, mx: dir };
    };
  let weakest = 1;
  const end = duo(s, [turn(0), turn(1)], frames, (_, bodies) => {
    if (!bodies.every(above)) weakest = Math.min(weakest, ...bodies.map((b) => b.stamina));
  });
  return { ...end, up: end.bodies.every((b) => above(b) && b.ground), weakest };
}
