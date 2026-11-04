/**
 * A drawn wheel. The player traces a shape on a square pad; the stroke itself
 * becomes the wheel, turning round its centre. What it's good at follows from
 * its shape: how big it is, how round (does the hub go up and down as it
 * turns?), and how many spikes stick out of it (studs, paddles).
 *
 * Pad coordinates run from -PAD to PAD, x to the right, y up.
 */

export const PAD = 100;
/** A wheel's outline, once resampled: enough points to see eight studs. */
export const WHEEL_POINTS = 40;
/** The most points a drawn stroke may have (the client thins it out first). */
export const MAX_STROKE = 160;
/** Smaller than this across, it's a tap or a slip of the finger, not a wheel. */
export const MIN_EXTENT = 18;

export interface Wheel {
  /** The outline round the hub, flattened [x0, y0, x1, y1…], in whole pad units. */
  pts: number[];
  /** Drawn as a loop (the ends meet) rather than an open line. */
  closed: boolean;
  /** Mean height of the hub above the ground as it turns, in pad units / PAD. */
  size: number;
  /** How far the hub goes up and down as it turns, relative to its mean: 0 for a circle. */
  bump: number;
  /** Spikes sticking out (studs, paddles, the points of a star)… */
  teeth: number;
  /** …and how deep they are, relative to the wheel's outer radius. */
  depth: number;
}

type Pt = [number, number];

const round3 = (v: number) => Math.round(v * 1000) / 1000;

function pairs(flat: number[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const last = out[out.length - 1];
    if (!last || last[0] !== flat[i] || last[1] !== flat[i + 1]) out.push([flat[i], flat[i + 1]]);
  }
  return out;
}

/** `n` points evenly spaced along the path (round the loop if it's closed). */
function resample(pts: Pt[], n: number, closed: boolean): Pt[] {
  const path = closed ? [...pts, pts[0]] : pts;
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    lengths.push(l);
    total += l;
  }
  const stride = total / (closed ? n : n - 1);
  const out: Pt[] = [];
  let i = 0;
  let start = 0;
  for (let k = 0; k < n; k++) {
    const target = k * stride;
    while (i < lengths.length - 1 && start + lengths[i] < target) start += lengths[i++];
    const t = lengths[i] > 0 ? Math.min(1, Math.max(0, (target - start) / lengths[i])) : 0;
    out.push([path[i][0] + (path[i + 1][0] - path[i][0]) * t, path[i][1] + (path[i + 1][1] - path[i][1]) * t]);
  }
  return out;
}

/** Takes the shake out of a hand-drawn line, not its corners. */
function smooth(pts: Pt[], closed: boolean): Pt[] {
  const n = pts.length;
  return pts.map((p, i): Pt => {
    if (!closed && (i === 0 || i === n - 1)) return p;
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    return [0.2 * a[0] + 0.6 * p[0] + 0.2 * b[0], 0.2 * a[1] + 0.6 * p[1] + 0.2 * b[1]];
  });
}

/**
 * The spikes of a profile: local maxima of the distance to the hub that
 * stand out from the valleys round them by at least `min` (topographic
 * prominence). Returns each one's prominence.
 */
function peaks(r: number[], closed: boolean, min: number): number[] {
  const n = r.length;
  const at = (i: number) => r[((i % n) + n) % n];
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const hasLeft = closed || i > 0;
    const hasRight = closed || i < n - 1;
    // Strict on the left, so a plateau counts once.
    if (hasLeft && !(r[i] > at(i - 1))) continue;
    if (hasRight && !(r[i] >= at(i + 1))) continue;
    const cols: number[] = [];
    for (const dir of [-1, 1]) {
      if ((dir < 0 && !hasLeft) || (dir > 0 && !hasRight)) continue;
      let low = Infinity;
      for (let k = 1; k < n; k++) {
        const j = i + dir * k;
        if (!closed && (j < 0 || j >= n)) break;
        if (at(j) > r[i]) break;
        low = Math.min(low, at(j));
      }
      if (low < Infinity) cols.push(low);
    }
    const prominence = r[i] - (cols.length ? Math.max(...cols) : r[i]);
    if (prominence >= min) out.push(prominence);
  }
  return out;
}

/** How high the hub stands when direction `angle` points at the ground: the outline's support function. */
export function hubHeight(pts: number[], angle: number): number {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  let h = 0;
  for (let i = 0; i + 1 < pts.length; i += 2) h = Math.max(h, pts[i] * c + pts[i + 1] * s);
  return h;
}

/** Size, roundness and spikes of an outline already centred on its hub. */
export function measure(pts: number[], closed: boolean): Wheel {
  const K = 48;
  const heights = Array.from({ length: K }, (_, k) => hubHeight(pts, (2 * Math.PI * k) / K));
  const mean = heights.reduce((a, b) => a + b, 0) / K;
  const bump = mean > 1 ? (Math.max(...heights) - Math.min(...heights)) / mean : 0;
  const radii: number[] = [];
  for (let i = 0; i + 1 < pts.length; i += 2) radii.push(Math.hypot(pts[i], pts[i + 1]));
  const outer = Math.max(...radii);
  const spikes = outer > 4 ? peaks(radii, closed, 0.2 * outer) : [];
  return {
    pts,
    closed,
    size: round3(mean / PAD),
    bump: round3(bump),
    teeth: spikes.length,
    depth: round3(spikes.length ? spikes.reduce((a, b) => a + b, 0) / spikes.length / outer : 0),
  };
}

/**
 * A stroke as drawn (flattened pad points) → the wheel it makes, or null if
 * it's too small to be one. Resampled evenly, lightly smoothed, centred on
 * its middle (the mean of its evenly spaced points), in whole pad units.
 */
export function makeWheel(stroke: number[]): Wheel | null {
  const pts = pairs(stroke);
  if (pts.length < 2) return null;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  if (extent < MIN_EXTENT) return null;
  let length = 0;
  for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const gap = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
  // The ends meet: a loop. A short V whose tips happen to be close isn't one.
  const closed = pts.length >= 3 && gap <= 0.3 * extent && length >= 1.8 * extent;
  const even = smooth(resample(pts, WHEEL_POINTS, closed), closed);
  const cx = even.reduce((a, p) => a + p[0], 0) / even.length;
  const cy = even.reduce((a, p) => a + p[1], 0) / even.length;
  return measure(
    // `|| 0`: no -0, which JSON would turn into a different number.
    even.flatMap(([x, y]) => [Math.round(x - cx) || 0, Math.round(y - cy) || 0]),
    closed,
  );
}

// ---------- Shapes, for the bots and the hints ----------

/** A shape drawn from its distance to the centre at each angle, as a closed stroke. */
export function polar(radius: (angle: number) => number, n = 64): number[] {
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const a = (2 * Math.PI * k) / n;
    const r = radius(a);
    out.push(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r));
  }
  // Back to the start, the way a finger closes a loop.
  out.push(out[0], out[1]);
  return out;
}

export const circle = (r: number) => polar(() => r);

/** A star of `points` spikes between radius `inner` and `outer`. */
export function star(outer: number, inner: number, points: number): number[] {
  const out: number[] = [];
  for (let k = 0; k <= 2 * points; k++) {
    const a = Math.PI / 2 + (Math.PI * k) / points;
    const r = k % 2 ? inner : outer;
    out.push(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r));
  }
  return out;
}

/** A gear: a ring of square studs. */
export const gear = (outer: number, inner: number, studs: number) =>
  polar((a) => ((a * studs) / (2 * Math.PI)) % 1 < 0.5 ? outer : inner, studs * 8);

/** The wheel everyone starts with: a medium circle. */
export const STARTING_WHEEL: Wheel = makeWheel(circle(45))!;
