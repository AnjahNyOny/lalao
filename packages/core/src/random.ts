/** Uses getRandomValues, which (unlike randomUUID) also works on plain-http LAN pages. */
export function randomId(length = 12, alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

export function randomSeed(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0];
}

/**
 * One mulberry32 step with explicit state, for games that keep their RNG
 * inside their (serialisable) State. Returns a float in [0, 1) and the next state.
 */
export function mulberryStep(state: number): [value: number, next: number] {
  const a = (state + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

/** Deterministic PRNG for game logic: same seed, same game. Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    const [value, next] = mulberryStep(a);
    a = next;
    return value;
  };
}
