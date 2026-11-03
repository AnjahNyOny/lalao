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
