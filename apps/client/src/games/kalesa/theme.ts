import type { Look, Terrain } from '@game/games/kalesa';
import type { Theme } from '../../theme/theme';

/** Red earth and the colours painted on the taxi-brousses: laterite, ochre, cream. */
export const kalesaTheme: Theme = {
  id: 'kalesa',
  themeColor: '#3a1f16',
  vars: {
    bg: '#3a1f16',
    ink: '#fff5e6',
    muted: '#e8cdb6',
    card: '#53301f',
    'card-border': '2px solid #7d4b33',
    'card-shadow': '0 5px 0 rgba(0, 0, 0, 0.35)',
    accent: '#f4b63c',
    'accent-ink': '#2b1a0c',
    'accent-shadow': '#a8731a',
    'btn-bg': '#6e3b27',
    'btn-ink': '#fff5e6',
    'btn-shadow': '#2a140c',
    line: '#7d4b33',
    'input-bg': '#462618',
    'font-display': "'Baloo 2', ui-rounded, system-ui, sans-serif",
    'font-body': "'Baloo 2', ui-rounded, system-ui, sans-serif",
    'text-size': '17px',
    'display-size': '1.2',
    radius: '14px',
    glow: 'none',
  },
};

/** Each stretch of road: its surface, and what sits on it. */
export const ROAD: Record<Terrain, { top: string; side: string; detail: string }> = {
  goudron: { top: '#4a4b4f', side: '#36373a', detail: '#f2efe4' },
  glissant: { top: '#b8532c', side: '#8a3b1f', detail: '#7c2f17' },
  boue: { top: '#5f4128', side: '#45301d', detail: '#3c2816' },
  trous: { top: '#6a655c', side: '#4d4943', detail: '#2a241e' },
  rochers: { top: '#9a8f80', side: '#746b5f', detail: '#7e8389' },
  sable: { top: '#e6cf98', side: '#c9b07a', detail: '#d9c088' },
  gue: { top: '#7a6a4f', side: '#5c4f3b', detail: '#3b8fb0' },
};

/** The land round the road, per region. */
export interface Land {
  sky: string;
  fog: string;
  ground: string[];
  /** Far hills. */
  hills: string;
  hemi: [string, string, number];
  sun: number;
  sunColor: string;
}

export const LANDS: Record<Look, Land> = {
  // Green rice terraces and red earth under a high sky.
  hautes: {
    sky: '#9fd0ef',
    fog: '#cfe3ea',
    ground: ['#79a84a', '#6c9c42', '#86b252'],
    hills: '#8e5a3c',
    hemi: ['#f6fbff', '#6b5a3a', 1.2],
    sun: 2.3,
    sunColor: '#fff1d6',
  },
  // The dry west at the end of the afternoon.
  ouest: {
    sky: '#f2c88f',
    fog: '#efd2a6',
    ground: ['#c99a5a', '#bd8e50', '#d1a466'],
    hills: '#a0603a',
    hemi: ['#fff0d8', '#7a5a38', 1.15],
    sun: 2.4,
    sunColor: '#ffd59a',
  },
  // Grey limestone and dry forest.
  nord: {
    sky: '#b7dbe8',
    fog: '#d6e6e2',
    ground: ['#9aa257', '#8d9650', '#a7ad62'],
    hills: '#80878d',
    hemi: ['#f4fbff', '#5f5a44', 1.2],
    sun: 2.3,
    sunColor: '#fff4dc',
  },
};

export const FX: Record<Terrain, string> = {
  goudron: '#c9c4b8',
  glissant: '#c8643a',
  boue: '#4d3420',
  trous: '#a69c8a',
  rochers: '#b0a898',
  sable: '#ecd9a6',
  gue: '#cfeefa',
};

/** Everything else the scene paints. */
export const SCENE = {
  tyre: '#2b2a29',
  hub: '#c9cdd2',
  water: '#3f9cc0',
  puddle: '#6a2c18',
  mudPuddle: '#4b3320',
  riverBed: '#25546a',
  stake: '#6b4a2c',
  checkerDark: '#1d1d1f',
  checkerLight: '#f6f3ea',
  rice: ['#7fbf4f', '#6aab43', '#9ccf68'],
  paddyWater: '#8fbcb2',
  dyke: '#8a5a3a',
  grass: '#a7b85a',
  dryGrass: '#c9a860',
};

/** The drawing pad: paper, guide, the wheel you have, the one you're drawing. */
export const PAD_COLORS = {
  paper: '#fff8ec',
  grid: '#ecdcc6',
  guide: '#d9c1a4',
  ghost: '#b89a7e',
  ink: '#2b1a0c',
  refused: '#d9483b',
};

/** The HUD: how well the wheel grips, the finish flag on the strip, outlines. */
export const GAUGE = {
  good: '#5cc25a',
  mid: '#f4b63c',
  bad: '#e5533d',
  flag: '#f6f3ea',
  mine: '#ffffff',
  outline: '#2b1a0c',
};
