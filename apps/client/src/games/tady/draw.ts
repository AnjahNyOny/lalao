import { cellIndex, cellsWith, gustAt, MOUNTAIN, PHYS, size, type TadyState } from '@game/games/tady';
import { noise, paintCrumble, paintFire, paintFlag, paintOrchid, SPRITE_FEET, SPRITE_W, T, climber, type Frame } from './art';
import { PAL, SKY } from './theme';

/** What a climber looks like this frame: where, which way, doing what. */
export interface Shown {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ground: boolean;
  grab: boolean;
  face: 1 | -1;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface Frame2D {
  s: TadyState;
  shown: Shown[];
  pieces: string[];
  /** ms, for animations. */
  t: number;
  /** Camera centre, in tiles. */
  cam: { x: number; y: number };
  particles: Particle[];
}

const m = MOUNTAIN;
const { w: MW, h: MH } = size(m);
const SUMMIT_ROW = cellsWith(m, 'S')[0][1];
const CAMPS = cellsWith(m, 'C');
const ORCHIDS = cellsWith(m, '*').map(([cx, cy]) => ({ cx, cy, i: cellIndex(m, cx, cy) }));
const CRUMBLES = cellsWith(m, '%').map(([cx, cy]) => ({ cx, cy, i: cellIndex(m, cx, cy) }));
const FLAG = cellsWith(m, 'S')[1];
const BEDROCK = '#2e2826';

/** How far up the mountain, 0 at the foot, 1 at the summit: night turns to sunrise with it. */
export const progress = (y: number) => Math.max(0, Math.min(1, (MH - 1 - y) / (MH - 1 - SUMMIT_ROW)));

const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function mix(a: string, b: string, k: number): string {
  const [ar, ag, ab] = hex(a);
  const [br, bg, bb] = hex(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * k).toString(16).padStart(2, '0');
  return `#${c(ar, br)}${c(ag, bg)}${c(ab, bb)}`;
}
/** Sky colour k (0 top, 2 low) along night → dawn → sunrise. */
function sky(k: number, p: number): string {
  if (p < 0.6) return mix(SKY.night[k], SKY.dawn[k], p / 0.6);
  return mix(SKY.dawn[k], SKY.sunrise[k], (p - 0.6) / 0.4);
}

/** The sky in pixel bands, the stars, the moon or the sun, two ranges of far mountains. */
function backdrop(g: CanvasRenderingContext2D, W: number, H: number, f: Frame2D, p: number): void {
  const top = sky(0, p);
  const mid = sky(1, p);
  const low = sky(2, p);
  const BANDS = 14;
  for (let y = 0; y < H; y++) {
    const k = y / H;
    const band = Math.min(BANDS - 1, Math.floor(k * BANDS));
    const color = (b: number) => (b / BANDS < 0.5 ? mix(top, mid, (b / BANDS) * 2) : mix(mid, low, (b / BANDS - 0.5) * 2));
    g.fillStyle = color(band);
    g.fillRect(0, y, W, 1);
    // Dither into the next band.
    const into = k * BANDS - band;
    if (into > 0.7 && band < BANDS - 1) {
      g.fillStyle = color(band + 1);
      for (let x = (y % 2) * 1; x < W; x += 2) g.fillRect(x, y, 1, 1);
    }
  }
  // Stars, fading with the dawn.
  const stars = 1 - p * 1.5;
  if (stars > 0) {
    g.globalAlpha = stars;
    g.fillStyle = SKY.star;
    const drift = f.cam.y * T * 0.04;
    for (let i = 0; i < 90; i++) {
      const x = Math.floor(noise(i, 1) * W);
      const y = Math.floor((noise(i, 2) * H * 1.4 + drift) % (H * 0.8));
      const twinkle = noise(i, Math.floor(f.t / 600)) < 0.15;
      if (!twinkle) g.fillRect(x, y, 1, 1);
      if (i % 11 === 0) g.fillRect(x + 1, y, 1, 1);
    }
    g.globalAlpha = 1;
  }
  // The moon early on, the sun coming up near the top.
  if (p < 0.55) disc(g, Math.floor(W * 0.78), Math.floor(H * 0.16), 7, SKY.moon, 1 - p / 0.55);
  if (p > 0.7) disc(g, Math.floor(W * 0.25), Math.floor(H * (0.82 - (p - 0.7) * 1.3)), 11, SKY.sun, Math.min(1, (p - 0.7) / 0.15));
  // Two ranges, sinking as the climbers rise above them.
  ridge(g, W, H, f, 0.08, H * 0.52 + (1 - p) * H * 0.12, mix(SKY.far[0], SKY.far[2], p), 0.05, 26);
  ridge(g, W, H, f, 0.18, H * 0.66 + (1 - p) * H * 0.18, mix(SKY.near[0], SKY.near[2], p), 0.09, 18);
}

function disc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, alpha: number): void {
  g.globalAlpha = Math.max(0, Math.min(1, alpha));
  g.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    g.fillRect(cx - half, cy + y, half * 2 + 1, 1);
  }
  g.globalAlpha = 1;
}

/** A mountain range against the sky, a column of pixels at a time. */
function ridge(g: CanvasRenderingContext2D, W: number, H: number, f: Frame2D, parallax: number, base: number, color: string, freq: number, height: number): void {
  g.fillStyle = color;
  const off = f.cam.x * T * parallax;
  for (let x = 0; x < W; x++) {
    const u = x + off;
    const y = base - (Math.sin(u * freq) * 0.5 + Math.sin(u * freq * 2.3 + 1.7) * 0.3 + Math.sin(u * freq * 5.1) * 0.15 + 1) * height * 0.5;
    g.fillRect(x, Math.floor(y), 1, H - Math.floor(y));
  }
}

function frameOf(c: Shown, t: number, seat: number): Frame {
  if (c.grab) return 'grip';
  if (!c.ground) return c.vy < 0 ? 'jump' : 'fall';
  if (Math.abs(c.vx) > 0.6) return (['run0', 'run1', 'run2', 'run1'] as const)[Math.floor(t / 90) % 4];
  // A blink now and then.
  return Math.floor(t / 100 + seat * 17) % 40 === 0 ? 'idle1' : 'idle0';
}

/** The rope between the two, sagging when there's slack. */
function rope(g: CanvasRenderingContext2D, a: Shown, b: Shown, length: number, ox: number, oy: number): void {
  const ax = a.x * T - ox;
  const ay = (a.y - 0.05) * T - oy;
  const bx = b.x * T - ox;
  const by = (b.y - 0.05) * T - oy;
  const d = Math.hypot(bx - ax, by - ay) / T;
  // Slack rope sags, but lies on the ground rather than through it.
  const floor = Math.max(ay, by) + (PHYS.hh + 0.05) * T - (ay + by) / 2;
  const sag = d < length ? Math.min(Math.sqrt(length * length - d * d) * 0.45 * T, floor * 2) : 0;
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2 + sag;
  const steps = Math.max(6, Math.ceil((Math.abs(bx - ax) + Math.abs(by - ay) + sag) / 2));
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    const x = (1 - k) * (1 - k) * ax + 2 * (1 - k) * k * mx + k * k * bx;
    const y = (1 - k) * (1 - k) * ay + 2 * (1 - k) * k * my + k * k * by;
    g.fillStyle = PAL.rope[1];
    g.fillRect(Math.round(x), Math.round(y) + 1, 1, 1);
    g.fillStyle = PAL.rope[0];
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
}

/** One frame of the game, at the art's resolution (W × H pixels). */
export function draw(g: CanvasRenderingContext2D, W: number, H: number, level: HTMLCanvasElement, f: Frame2D): void {
  const p = progress(f.cam.y);
  g.imageSmoothingEnabled = false;
  backdrop(g, W, H, f, p);
  const ox = Math.round(f.cam.x * T - W / 2);
  const oy = Math.round(f.cam.y * T - H / 2);
  g.drawImage(level, -ox, -oy);
  // Below the valley floor, more rock.
  const bottom = MH * T - oy;
  if (bottom < H) {
    g.fillStyle = BEDROCK;
    g.fillRect(0, bottom, W, H - bottom);
  }

  const s = f.s;
  for (const k of CRUMBLES) {
    const t = s.crumble[k.i];
    if (t !== undefined && t >= 700) continue;
    const shake = t === undefined ? 0 : Math.floor(f.t / 50) % 2 ? 1 : -1;
    paintCrumble(g, k.cx * T - ox, k.cy * T - oy, shake, k.cx * 31 + k.cy);
  }
  for (const o of ORCHIDS) if (!s.picked.includes(o.i)) paintOrchid(g, o.cx * T + 8 - ox, (o.cy + 1) * T - oy, f.t);
  for (const [cx, cy] of CAMPS) paintFire(g, cx * T + 10 - ox, (cy + 1) * T - oy, f.t);
  paintFlag(g, FLAG[0] * T + 8 - ox, (FLAG[1] + 1) * T - oy, f.t);

  const [a, b] = f.shown;
  rope(g, a, b, s.rope, ox, oy);
  f.shown.forEach((c, seat) => {
    const sprite = climber(frameOf(c, f.t, seat), f.pieces[seat], c.face < 0);
    g.drawImage(sprite, Math.round(c.x * T - SPRITE_W / 2 - ox), Math.round((c.y + PHYS.hh) * T - SPRITE_FEET - oy));
  });

  // Gusts across the col: streaks of wind.
  for (let y = 0; y < H; y += 3) {
    const row = (y + oy) / T;
    if (!gustAt(s.time, row)) continue;
    g.fillStyle = 'rgba(235, 240, 255, 0.55)';
    for (let i = 0; i < 2; i++) {
      if (noise(Math.floor((y + oy) / 3), i, 11) > 0.35) continue;
      const len = 4 + Math.floor(noise(y, i, 12) * 8);
      const x = Math.floor((noise(y, i, 13) * W * 2 + f.t * 0.35) % (W + 20)) - 10;
      g.fillRect(x, y, len, 1);
    }
  }

  for (const q of f.particles) {
    g.fillStyle = q.color;
    g.fillRect(Math.round(q.x - ox), Math.round(q.y - oy), 1, 1);
  }

  // Night over the lower slopes, lifting as dawn comes; each climber and each fire gives a little light.
  const night = 1 - Math.min(1, p / 0.85);
  if (night > 0.02) {
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = mix('#ffffff', '#7a86c8', night);
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    const glow = (x: number, y: number, r: number, strength: number) => {
      const grad = g.createRadialGradient(x, y, 1, x, y, r);
      grad.addColorStop(0, `rgba(255, 200, 130, ${0.42 * strength})`);
      grad.addColorStop(1, 'rgba(255, 200, 130, 0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    };
    for (const c of f.shown) glow(Math.round(c.x * T - ox), Math.round(c.y * T - oy), 40, night);
    for (const [cx, cy] of CAMPS) glow(cx * T + 10 - ox, (cy + 1) * T - 4 - oy, 34, night);
    g.globalCompositeOperation = 'source-over';
  }
}

export const MAP_PX = { w: MW * T, h: MH * T };
