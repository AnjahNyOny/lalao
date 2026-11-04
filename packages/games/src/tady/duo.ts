/** Two devices and the server, frame by frame, as in a real game: for the tests of moves done together. */
import { bodyOf, step, tady, type Body, type Input, type TadyState } from '.';

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
