import { CELLS, priceOf, rentOf } from '@game/games/tsena';
import * as THREE from 'three';
import { island } from './theme';
import { ar, KIND_ICON, KIND_LABEL } from './texts';
import type { Shown } from './replay';

export const LABEL_W = 1.34;
export const LABEL_H = 0.94;
const PX = 256;
const W = PX;
const H = Math.round((PX * LABEL_H) / LABEL_W);
const FONT = "'Baloo 2', ui-rounded, system-ui, sans-serif";

const cache = new Map<string, THREE.CanvasTexture>();

/** Largest font size (up to `max`) at which `text` fits in `width` pixels. */
function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, max: number, width: number): number {
  for (let size = max; size > 10; size -= 2) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    if (ctx.measureText(text).width <= width) return size;
  }
  return 10;
}

/**
 * The text painted on a cell's tile: region band, name and price for a site
 * (the rent once owned), an icon for special cells. Read from the south, like the camera.
 */
export function labelTexture(cell: number, shown: Pick<Shown, 'owner' | 'level' | 'mortgaged'>): THREE.CanvasTexture {
  const c = CELLS[cell];
  const who = shown.owner[cell];
  const rent = rentOf(shown, cell);
  const key = `${cell}:${who}:${rent}:${shown.mortgaged[cell]}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = island.ink;

  if (c.kind === 'site') {
    ctx.fillStyle = island.regions[c.region!];
    ctx.beginPath();
    ctx.roundRect(28, 20, W - 56, 26, 13);
    ctx.fill();
    ctx.fillStyle = island.ink;
    ctx.font = `800 ${fit(ctx, c.name, 800, 46, W - 26)}px ${FONT}`;
    ctx.fillText(c.name, W / 2, 96);
    const price = who === null ? ar(priceOf(cell)) : shown.mortgaged[cell] ? 'en gage' : `loyer ${ar(rent)}`;
    ctx.fillStyle = who === null ? island.ink : island.players[who];
    ctx.font = `700 ${fit(ctx, price, 700, 34, W - 40)}px ${FONT}`;
    ctx.fillText(price, W / 2, 142);
  } else {
    ctx.font = `60px ${FONT}`;
    ctx.fillText(KIND_ICON[c.kind], W / 2, 62);
    const text = c.kind === 'start' ? c.name : KIND_LABEL[c.kind];
    ctx.font = `800 ${fit(ctx, text, 800, 38, W - 30)}px ${FONT}`;
    ctx.fillText(text, W / 2, 136);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  cache.set(key, texture);
  return texture;
}

/** Drop cached labels: called once the board font has loaded. */
export const resetLabels = () => {
  cache.forEach((t) => t.dispose());
  cache.clear();
};

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.27, 0.22], [0.73, 0.22], [0.27, 0.5], [0.73, 0.5], [0.27, 0.78], [0.73, 0.78]],
};

let diceFaces: THREE.MeshStandardMaterial[] | null = null;

/** Die faces in BoxGeometry order (+x, −x, +y, −y, +z, −z): opposite faces add up to 7. */
export function diceMaterials(): THREE.MeshStandardMaterial[] {
  if (diceFaces) return diceFaces;
  diceFaces = [3, 4, 1, 6, 2, 5].map((n) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fffaf0';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = n === 1 ? island.laterite : island.ink;
    for (const [x, y] of PIPS[n]) {
      ctx.beginPath();
      ctx.arc(x * 128, y * 128, n === 1 ? 17 : 12, 0, Math.PI * 2);
      ctx.fill();
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map, roughness: 0.6 });
  });
  return diceFaces;
}

/** Rotation that puts face `n` on top. */
export const DIE_UP: Record<number, THREE.Euler> = {
  1: new THREE.Euler(0, 0, 0),
  6: new THREE.Euler(Math.PI, 0, 0),
  3: new THREE.Euler(0, 0, Math.PI / 2),
  4: new THREE.Euler(0, 0, -Math.PI / 2),
  2: new THREE.Euler(-Math.PI / 2, 0, 0),
  5: new THREE.Euler(Math.PI / 2, 0, 0),
};
