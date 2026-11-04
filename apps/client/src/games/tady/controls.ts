import { useEffect, useRef } from 'react';

/** What the player is doing with their hands right now: read every frame by the game loop. */
export interface Pad {
  /** Stick, -1..1: x right, y down (up hauls the rope in). */
  mx: number;
  my: number;
  /** Set when jump is pressed; the loop clears it once used. */
  jump: boolean;
  /** Held down. */
  grab: boolean;
}

const KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  KeyW: [0, -1],
  KeyS: [0, 1],
  KeyA: [-1, 0],
  KeyD: [1, 0],
};
const JUMP = ['Space', 'KeyK'];
const GRAB = ['ShiftLeft', 'ShiftRight', 'KeyJ'];

/**
 * Keyboard, thumb stick and buttons, merged. Keys go by position, so WASD is
 * ZQSD on a French keyboard; space jumps, shift (or J) grips while held.
 */
export function usePad() {
  const pad = useRef<Pad>({ mx: 0, my: 0, jump: false, grab: false });
  const keys = useRef(new Set<string>());
  const stick = useRef<[number, number]>([0, 0]);
  const grips = useRef({ key: false, button: false });

  const merge = () => {
    let [mx, my] = stick.current;
    for (const k of keys.current) {
      if (!KEYS[k]) continue;
      mx += KEYS[k][0];
      my += KEYS[k][1];
    }
    pad.current.mx = Math.max(-1, Math.min(1, mx));
    pad.current.my = Math.max(-1, Math.min(1, my));
    pad.current.grab = grips.current.key || grips.current.button;
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (JUMP.includes(e.code)) {
        if (!e.repeat) pad.current.jump = true;
      } else if (GRAB.includes(e.code)) grips.current.key = true;
      else if (KEYS[e.code]) keys.current.add(e.code);
      else return;
      e.preventDefault();
      merge();
    };
    const up = (e: KeyboardEvent) => {
      if (GRAB.includes(e.code)) grips.current.key = false;
      keys.current.delete(e.code);
      merge();
    };
    const blur = () => {
      keys.current.clear();
      grips.current = { key: false, button: false };
      merge();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    pad,
    setStick: (x: number, y: number) => {
      stick.current = [x, y];
      merge();
    },
    jump: () => {
      pad.current.jump = true;
    },
    hold: (on: boolean) => {
      grips.current.button = on;
      merge();
    },
  };
}
