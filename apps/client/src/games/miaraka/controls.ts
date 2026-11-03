import { useEffect, useRef } from 'react';

/** What the player is doing with their hands right now: read every frame by the scene. */
export interface Controls {
  /** Stick, length up to 1: x east (right), z south (down the screen). */
  mx: number;
  mz: number;
  /** Set when the action button is pressed; the scene clears it once used. */
  action: boolean;
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

/**
 * Keyboard and on-screen stick, merged. Keys go by position, so WASD is ZQSD
 * on a French keyboard; space or enter is the action.
 */
export function useControls() {
  const controls = useRef<Controls>({ mx: 0, mz: 0, action: false });
  const keys = useRef(new Set<string>());
  const stick = useRef<[number, number]>([0, 0]);

  const merge = () => {
    let [mx, mz] = stick.current;
    for (const k of keys.current) {
      mx += KEYS[k][0];
      mz += KEYS[k][1];
    }
    const len = Math.hypot(mx, mz);
    controls.current.mx = len > 1 ? mx / len : mx;
    controls.current.mz = len > 1 ? mz / len : mz;
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        if (!e.repeat) controls.current.action = true;
        e.preventDefault();
      } else if (KEYS[e.code]) {
        keys.current.add(e.code);
        merge();
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      keys.current.delete(e.code);
      merge();
    };
    const blur = () => {
      keys.current.clear();
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

  const setStick = (x: number, z: number) => {
    stick.current = [x, z];
    merge();
  };
  const press = () => {
    controls.current.action = true;
  };
  return { controls, setStick, press };
}
