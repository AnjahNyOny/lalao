import { charAt, size, stageAt, type Mountain } from '@game/games/tady';
import { PAL, SCARVES, STAGE_ART } from './theme';

/** Pixels per tile: the whole game is drawn at this resolution, then scaled up by whole numbers. */
export const T = 16;

/**
 * A ring-tailed lemur (maki), facing right, feet on rows 13–14. Drawn one
 * pixel per character: k outline, g G grey fur, l belly, w white (face, tail
 * rings), m dark mask, e amber eye, n nose, b black tail rings, f hands and
 * feet, r R the scarf (repainted in each climber's colour).
 */
// prettier-ignore
const FRAMES = {
  idle0: [
    '................',
    '...kkk..........',
    '..kbbbk.........',
    '.kwwkk..........',
    '.kwwk......kkk..',
    'kbbk......kmgmk.',
    'kbbk.....kgggggk',
    'kwwkkkkkkkggwmek',
    'kwwkggggggrwwwwn',
    '.kbbggggggrgglwk',
    '..kbbgggggrRkkk.',
    '...kggggRrgk....',
    '....klllllk.....',
    '....fkkkkkf.....',
    '....f.....f.....',
    '................',
  ],
  idle1: [
    '...kk...........',
    '..kbbk..........',
    '.kbbk...........',
    'kwwk............',
    'kwwk.......kkk..',
    'bbk.......kmgmk.',
    'bbk......kgggggk',
    'wwk.kkkkkkggwmmk',
    'kwwkggggggrwwwwn',
    '.kbbggggggrgglwk',
    '..kbbgggggrRkkk.',
    '...kggggRrgk....',
    '....klllllk.....',
    '....fkkkkkf.....',
    '....f.....f.....',
    '................',
  ],
  run0: [
    '................',
    '................',
    '................',
    '.kkk............',
    'kbbbk......kkk..',
    'kwwk......kmgmk.',
    'wwk......kgggggk',
    'bbk.kkkkkkggwmek',
    'bbkkggggggrwwwwn',
    'wwwgggggggrgglwk',
    'kkbbbgggggrRkkk.',
    '..kkggggRrgk....',
    '....klllllk.....',
    '...f.kkkkk.f....',
    '...f.......f....',
    '................',
  ],
  run1: [
    '................',
    '................',
    '.kkk............',
    'kbbbk......kkk..',
    'kwwk......kmgmk.',
    'wwk......kgggggk',
    'bbk.kkkkkkggwmek',
    'bbkkggggggrwwwwn',
    'wwwgggggggrgglwk',
    'kkbbbgggggrRkkk.',
    '..kkggggRrgk....',
    '....klllllk.....',
    '....fkkkkkf.....',
    '....f.....f.....',
    '................',
    '................',
  ],
  run2: [
    '................',
    '................',
    '................',
    '.kkk............',
    'kbbbk......kkk..',
    'kwwk......kmgmk.',
    'wwk......kgggggk',
    'bbk.kkkkkkggwmek',
    'bbkkggggggrwwwwn',
    'wwwgggggggrgglwk',
    'kkbbbgggggrRkkk.',
    '..kkggggRrgk....',
    '....klllllk.....',
    '.....fkkkf......',
    '.....f...f......',
    '................',
  ],
  jump: [
    '................',
    '...kkk..........',
    '..kbbbk.........',
    '.kwwkk..........',
    '.kwwk......kkk..',
    'kbbk......kmgmk.',
    'kbbk.....kgggggk',
    'kwwkkkkkkkggwmek',
    'kwwkggggggrwwwwn',
    '.kbbggggggrgglwk',
    '..kbbgggggrRkkk.',
    '...kggggRrgk....',
    '....kflllfk.....',
    '.....kkkkk......',
    '................',
    '................',
  ],
  fall: [
    '...kk...........',
    '..kbbk..........',
    '.kbbk...........',
    'kwwk............',
    'kwwk.......kkk..',
    'bbk.......kmgmkf',
    'bbk......kggggfk',
    'wwk.kkkkkkggwmek',
    'kwwkggggggrwwwwn',
    '.kbbggggggrgglwk',
    '..kbbgggggrRkkk.',
    '...kggggRrgk....',
    '....klllllk.....',
    '...f.kkkkk.f....',
    '...f.......f....',
    '................',
  ],
  grip: [
    '................',
    '...kkk..........',
    '..kbbbk.........',
    '.kwwkk..........',
    '.kwwk......kkk..',
    'kbbk......kmgmkf',
    'kbbk.....kggggfk',
    'kwwkkkkkkkggwmek',
    'kwwkggggggrwwwwn',
    '.kbbggggggrgglwk',
    '..kbbgggggrRkkk.',
    '...kggggRrgk....',
    '....klllllk.....',
    '.....fkkkf......',
    '.....f...f......',
    '................',
  ],
};

const IDLE = FRAMES.idle0;
const ALL = {
  ...FRAMES,
  // The tail swayed the other way, eyes open: idle0 and idle2 take turns.
  idle2: FRAMES.idle1.map((row) => row.replace('ggwmmk', 'ggwmek')),
  // Squashed for a moment on landing: a pixel lower, the feet spread.
  land: ['................', '................', ...IDLE.slice(1, 12), '...fklllllkf....', '...ff.....ff....', '................'],
  // On the end of the rope: a paw up to it, the feet dangling together.
  hang: [...FRAMES.fall.slice(0, 13), '.....fkkkf......', '......f.f.......', '................'],
};

export type Frame = keyof typeof ALL;
export const SPRITE_W = 16;
export const SPRITE_H = 16;
/** The pixel row under the feet: it stands on the ground. */
export const SPRITE_FEET = 15;

const BODY: Record<string, string> = {
  k: PAL.outline,
  g: '#9a96a0',
  G: '#76727e',
  l: '#d6d2d4',
  w: '#f6f4f0',
  m: '#2a2430',
  e: '#f2b42c',
  n: '#121014',
  b: '#2a2630',
  f: '#5a5662',
};

/** How red the effort turns the fur and the face, strain 0 to 3; at 3 the eyes squeeze shut. */
const FLUSH = [0, 0.3, 0.5, 0.68];
const FLUSHED = new Set(['g', 'G', 'l', 'w']);

function toward(a: string, b: string, k: number): string {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * k).toString(16).padStart(2, '0');
  return `#${c(ar, br)}${c(ag, bg)}${c(ab, bb)}`;
}

const sprites = new Map<string, HTMLCanvasElement>();

/** One frame of a climber, in their scarf's colour, facing right or left, red with the strain of holding on. */
export function climber(frame: Frame, piece: string, flip: boolean, strain = 0): HTMLCanvasElement {
  const key = `${frame}:${piece}:${flip}:${strain}`;
  let c = sprites.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = SPRITE_W;
  c.height = SPRITE_H;
  const g = c.getContext('2d')!;
  const scarf = SCARVES[piece] ?? SCARVES.koto;
  ALL[frame].forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const k = strain >= 3 && ch === 'e' ? 'k' : ch;
      let color = k === 'r' ? scarf.main : k === 'R' ? scarf.shade : BODY[k];
      if (!color) return;
      if (strain > 0 && FLUSHED.has(k)) color = toward(color, PAL.flush, FLUSH[strain] * (k === 'w' ? 0.6 : 1));
      g.fillStyle = color;
      g.fillRect(flip ? SPRITE_W - 1 - x : x, y, 1, 1);
    }),
  );
  sprites.set(key, c);
  return c;
}

const pieces = new Map<string, string>();

/** The lobby's picture of a climber: the idle frame, blown up with sharp pixels. */
export function pieceImage(piece: string): string {
  let url = pieces.get(piece);
  if (url) return url;
  const scale = 6;
  const c = document.createElement('canvas');
  c.width = SPRITE_W * scale;
  c.height = SPRITE_H * scale;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(climber('idle0', piece, false), 0, 0, c.width, c.height);
  url = c.toDataURL();
  pieces.set(piece, url);
  return url;
}

/** A repeatable 0..1 noise from integers. */
export function noise(a: number, b: number, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

/**
 * Everything that never moves, painted once: rock, ice, wooden ledges, camp
 * floors, tents, the grass. Crumbling ledges, orchids, fires and the flag
 * are drawn every frame on top.
 */
export function paintMountain(m: Mountain): HTMLCanvasElement {
  const { w, h } = size(m);
  const canvas = document.createElement('canvas');
  canvas.width = w * T;
  canvas.height = h * T;
  const g = canvas.getContext('2d')!;
  const img = g.createImageData(canvas.width, canvas.height);
  const data = img.data;
  const put = (x: number, y: number, hex: string) => {
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
    const [r, gg, b] = rgb(hex);
    const i = (y * canvas.width + x) * 4;
    data[i] = r;
    data[i + 1] = gg;
    data[i + 2] = b;
    data[i + 3] = 255;
  };
  const rock = (cx: number, cy: number) => charAt(m, cx, cy) === '#';

  for (let cy = 0; cy < h; cy++) {
    for (let cx = 0; cx < w; cx++) {
      const c = charAt(m, cx, cy);
      const art = STAGE_ART[stageAt(m, cy)];
      const x0 = cx * T;
      const y0 = cy * T;
      if (c === '#') {
        const open = { up: !rock(cx, cy - 1), down: !rock(cx, cy + 1), left: !rock(cx - 1, cy), right: !rock(cx + 1, cy) };
        // Moss, lichen, grass or frost: as deep as a few pixels, ragged.
        const cap = [...Array(T)].map((_, x) => (open.up ? 2 + Math.floor(noise(cx * T + x, cy, 1) * 3) : 0));
        for (let y = 0; y < T; y++) {
          for (let x = 0; x < T; x++) {
            const n = noise(cx * T + x, cy * T + y);
            // Granite: speckled, in slabs of slightly different shades, a short crack here and there.
            const slab = noise(Math.floor((cx * T + x) / 24), Math.floor((cy * T + y) / 20), 8);
            let color = n < 0.1 ? art.rock[1] : n < 0.2 ? art.rock[2] : slab < 0.3 ? art.rock[2] : art.rock[0];
            if (slab > 0.85 && n > 0.6) color = art.rock[1];
            const crack = noise(cx, cy, 7);
            if (crack < 0.35 && y > 4 && y < 12 && x === 4 + Math.floor(crack * 20) + (y % 3 === 0 ? 1 : 0)) color = art.edge;
            if (y < cap[x]) color = y === 0 ? art.cap[1] : y === cap[x] - 1 ? art.cap[2] : art.cap[0];
            if ((open.left && x === 0) || (open.right && x === T - 1) || (open.down && y === T - 1)) color = art.edge;
            else if ((open.left && x === 1) || (open.down && y === T - 2)) color = y < cap[x] ? color : art.rock[2];
            put(x0 + x, y0 + y, color);
          }
        }
        // A tuft or a pebble on top now and then.
        if (open.up && charAt(m, cx, cy - 1) === '.') {
          for (let x = 1; x < T - 1; x++) {
            const n = noise(cx * T + x, cy, 3);
            if (n < 0.16) {
              put(x0 + x, y0 - 1, art.cap[0]);
              if (n < 0.06) put(x0 + x, y0 - 2, art.cap[1]);
            }
          }
        }
      } else if (c === '~') {
        for (let y = 0; y < T; y++) {
          for (let x = 0; x < T; x++) {
            let color = PAL.ice[0];
            if ((x + y * 2 + cx * 5) % 13 === 0) color = PAL.ice[3];
            else if (y < 2) color = PAL.ice[1];
            else if (y > T - 3 || x === 0 || x === T - 1) color = PAL.ice[2];
            put(x0 + x, y0 + y, color);
          }
        }
      } else if (c === '-') {
        const end = (dx: number) => charAt(m, cx + dx, cy) !== '-';
        for (let y = 0; y < 5; y++) {
          for (let x = 0; x < T; x++) {
            let color = y === 0 ? PAL.wood[2] : y === 4 ? PAL.wood[1] : PAL.wood[0];
            if ((x === 0 && end(-1)) || (x === T - 1 && end(1))) color = PAL.wood[3];
            if (y === 2 && (x === 3 || x === 12)) color = PAL.wood[3];
            if (y === 1 && noise(cx * T + x, cy, 4) < 0.2) color = PAL.wood[1];
            put(x0 + x, y0 + y, color);
          }
        }
        // A post down to whatever holds it, at the ends.
        for (const x of [2, 13]) for (let y = 5; y < 8; y++) put(x0 + x, y0 + y, PAL.wood[1]);
      } else if (c === '_') {
        for (let y = 0; y < 6; y++) {
          for (let x = 0; x < T; x++) {
            const n = noise(cx * T + x, cy * T + y, 5);
            let color = y < 2 ? (y === 0 ? art.cap[1] : art.cap[0]) : n < 0.3 ? PAL.earth[1] : PAL.earth[0];
            if (y === 5) color = n < 0.5 ? PAL.earth[2] : '#00000000';
            if (color !== '#00000000') put(x0 + x, y0 + y, color);
          }
        }
        // Roots hanging under the ledge.
        for (let x = 0; x < T; x++) if (noise(cx * T + x, cy, 6) < 0.14) for (let y = 6; y < 6 + 1 + Math.floor(noise(x, cy) * 3); y++) put(x0 + x, y0 + y, PAL.earth[2]);
      }
    }
  }
  g.putImageData(img, 0, 0);
  // Tents at the camps, beside where the fire burns.
  for (let cy = 0; cy < h; cy++) for (let cx = 0; cx < w; cx++) if (charAt(m, cx, cy) === 'C') paintTent(g, cx * T - 10, (cy + 1) * T);
  return canvas;
}

/** A little ridge tent, its foot at (x, y). */
function paintTent(g: CanvasRenderingContext2D, x: number, y: number): void {
  const [main, dark, light] = PAL.tent;
  for (let row = 0; row < 12; row++) {
    const half = Math.floor(row * 0.95) + 1;
    for (let dx = -half; dx <= half; dx++) {
      g.fillStyle = dx === -half || dx === half ? dark : dx < 0 ? light : main;
      g.fillRect(x + dx, y - 12 + row, 1, 1);
    }
  }
  // The door.
  g.fillStyle = PAL.outline;
  for (let row = 5; row < 12; row++) {
    const half = Math.floor((row - 5) * 0.5);
    g.fillRect(x - half, y - 12 + row, half * 2 + 1, 1);
  }
}

/** Fire beside a tent: three flickering frames. */
export function paintFire(g: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const f = Math.floor(t / 120) % 3;
  g.fillStyle = PAL.wood[1];
  g.fillRect(x - 3, y - 1, 7, 1);
  const tall = [5, 6, 4][f];
  for (let row = 0; row < tall; row++) {
    const half = Math.max(0, Math.floor((tall - row) / 2) - (row === tall - 1 ? 0 : 0));
    g.fillStyle = row < 2 ? PAL.fire[2] : row < 4 ? PAL.fire[1] : PAL.fire[0];
    g.fillRect(x - half + ((row + f) % 2 ? 0 : -0), y - 2 - row, half * 2 + 1, 1);
  }
}

/** An orchid on its stem; a picked one is gone. */
export function paintOrchid(g: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const bob = Math.round(Math.sin(t / 400 + x) * 1);
  const [white, pink, deep, stem] = PAL.orchid;
  g.fillStyle = stem;
  g.fillRect(x, y - 5 + bob, 1, 5 - bob);
  const top = y - 9 + bob;
  const petals: [number, number, string][] = [
    [0, 0, white],
    [-2, 1, white],
    [2, 1, white],
    [-1, 2, pink],
    [1, 2, pink],
    [0, 1, deep],
    [0, 3, white],
  ];
  for (const [dx, dy, color] of petals) {
    g.fillStyle = color;
    g.fillRect(x + dx, top + dy, 1, 1);
  }
}

/** The flag on the summit, flying in the morning wind. */
export function paintFlag(g: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  g.fillStyle = PAL.cairn[2];
  g.fillRect(x, y - 22, 1, 22);
  const [white, red, green] = PAL.flag;
  for (let fx = 0; fx < 12; fx++) {
    const wave = Math.round(Math.sin(t / 160 - fx * 0.7) * 1);
    for (let fy = 0; fy < 8; fy++) {
      g.fillStyle = fx < 4 ? white : fy < 4 ? red : green;
      g.fillRect(x + 1 + fx, y - 22 + fy + wave, 1, 1);
    }
  }
  // A cairn at its foot.
  const stones: [number, number, number][] = [
    [-3, 0, 7],
    [-2, -2, 5],
    [-1, -4, 3],
  ];
  for (const [dx, dy, wdt] of stones) {
    g.fillStyle = PAL.cairn[0];
    g.fillRect(x + dx, y - 2 + dy, wdt, 2);
    g.fillStyle = PAL.cairn[1];
    g.fillRect(x + dx, y - 2 + dy, wdt, 1);
  }
}

const crumbles = new Map<number, HTMLCanvasElement>();

/** A crumbling ledge: sandy rock with cracks; it shakes before it goes. Each one painted once. */
export function paintCrumble(g: CanvasRenderingContext2D, x: number, y: number, shake: number, seed: number): void {
  let tile = crumbles.get(seed);
  if (!tile) {
    tile = document.createElement('canvas');
    tile.width = T;
    tile.height = T;
    paintCrumbleTile(tile.getContext('2d')!, seed);
    crumbles.set(seed, tile);
  }
  g.drawImage(tile, x + shake, y);
}

function paintCrumbleTile(g: CanvasRenderingContext2D, seed: number): void {
  const [main, dark, light, crack] = PAL.crumble;
  for (let py = 0; py < T; py++) {
    for (let px = 0; px < T; px++) {
      const n = noise(seed * T + px, py, 9);
      let color = n < 0.15 ? light : n < 0.28 ? dark : main;
      if (py === 0) color = light;
      if (py === T - 1 || px === 0 || px === T - 1) color = dark;
      // Cracks of its own: a line down from the top, one across.
      const down = 3 + Math.floor(noise(seed, 1, 9) * 9);
      const across = 5 + Math.floor(noise(seed, 2, 9) * 6);
      if ((px === down + (py % 4 === 0 ? 1 : 0) && py > 1 && py < across + 1) || (py === across && px > down - 3 && px < down + 4)) color = crack;
      // Worn, rounded corners.
      if ((px === 0 || px === T - 1) && (py === 0 || py === T - 1)) continue;
      g.fillStyle = color;
      g.fillRect(px, py, 1, 1);
    }
  }
}
