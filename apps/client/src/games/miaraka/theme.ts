import type { LevelDef } from '@game/games/miaraka';
import type { Theme } from '../../theme/theme';

/** The Tsingy at golden hour: grey needles, jungle green, warm laterite paths. */
export const tsingy = {
  sky: '#f3c98b',
  fog: '#e9c79a',
  floor: ['#c97a4a', '#bf7043', '#d0855a'],
  floorSide: '#8a4a2c',
  water: '#2f8fae',
  waterDeep: '#1f6a84',
  grass: '#6fa64e',
  ink: '#2c2620',
  /** Seat-free: the maki's and the zebu's own colours. */
  maki: '#f08a24',
  zebu: '#3b7dd8',
  wall: '#7c8389',
  open: '#4cc38a',
  shut: '#d9534f',
};

/** How each place looks: sky, ground, water, light, and what its walls are made of. */
export interface Look {
  sky: string;
  fog: string;
  /** Where the fog starts and ends, counted from the player (the camera's distance is added). */
  fogNear: number;
  fogFar: number;
  floor: string[];
  water: string;
  waterDeep: string;
  /** Beyond the walls. */
  grass: string;
  /** Walls on the minimap. */
  wall: string;
  /** Hemisphere light: sky colour, ground colour, strength. */
  hemi: [string, string, number];
  sun: number;
  sunColor: string;
  /** Tsingy needles, or dry-forest thickets. */
  walls: 'rock' | 'bush';
  /** Trees round the map. */
  jungle: boolean;
}

export const LOOKS: Record<LevelDef['look'], Look> = {
  // Bemaraha at golden hour.
  tsingy: {
    sky: tsingy.sky,
    fog: tsingy.fog,
    fogNear: 5,
    fogFar: 29,
    floor: tsingy.floor,
    water: tsingy.water,
    waterDeep: tsingy.waterDeep,
    grass: tsingy.grass,
    wall: tsingy.wall,
    hemi: ['#fff1d6', '#5a6b4a', 1.2],
    sun: 2.2,
    sunColor: '#ffe2b0',
    walls: 'rock',
    jungle: true,
  },
  // Under the Ankarana: black but for the lantern, a glint of light through the cracks.
  cave: {
    sky: '#07090b',
    fog: '#07090b',
    fogNear: -1,
    fogFar: 7,
    floor: ['#5c4f44', '#54483e', '#655749'],
    water: '#1f5466',
    waterDeep: '#0b2026',
    grass: '#111416',
    wall: '#4a4f55',
    hemi: ['#6f80a0', '#1d160f', 0.28],
    sun: 0.18,
    sunColor: '#9ab0d0',
    walls: 'rock',
    jungle: false,
  },
  // The Manambolo's gorge at midday: ochre sand, green river.
  gorge: {
    sky: '#bcdcea',
    fog: '#cfe2e6',
    fogNear: 7,
    fogFar: 33,
    floor: ['#c08a58', '#b47f50', '#cb9763'],
    water: '#2b8f7e',
    waterDeep: '#1a5f55',
    grass: '#79a84e',
    wall: '#8a7f78',
    hemi: ['#f4fbff', '#6b5a40', 1.25],
    sun: 2.4,
    sunColor: '#fff2d8',
    walls: 'rock',
    jungle: true,
  },
  // Kirindy in the dry season: dusty paths, olive thickets.
  forest: {
    sky: '#efd39a',
    fog: '#e8cf9c',
    fogNear: 5,
    fogFar: 29,
    floor: ['#b08a55', '#a5804c', '#bb955f'],
    water: '#3f8a96',
    waterDeep: '#265e68',
    grass: '#99a04e',
    wall: '#6f7a3a',
    hemi: ['#fff0d0', '#6a5a3a', 1.15],
    sun: 2.3,
    sunColor: '#ffd89a',
    walls: 'bush',
    jungle: true,
  },
};

export const miarakaTheme: Theme = {
  id: 'miaraka',
  themeColor: '#2f4a3a',
  vars: {
    bg: '#1f3329',
    ink: '#fdf6e8',
    muted: '#c9d6c3',
    card: '#2c4637',
    'card-border': '2px solid #4c6b56',
    'card-shadow': '0 5px 0 rgba(0, 0, 0, 0.35)',
    accent: '#f08a24',
    'accent-ink': '#1f1608',
    'accent-shadow': '#a85a10',
    'btn-bg': '#3d5e4b',
    'btn-ink': '#fdf6e8',
    'btn-shadow': '#1a2a21',
    line: '#4c6b56',
    'input-bg': '#253c2f',
    'font-display': "'Baloo 2', ui-rounded, system-ui, sans-serif",
    'font-body': "'Baloo 2', ui-rounded, system-ui, sans-serif",
    'text-size': '17px',
    'display-size': '1.15',
    radius: '16px',
    glow: 'none',
  },
};
