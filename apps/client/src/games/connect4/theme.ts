import type { Theme } from '../../theme/theme';

/** Toy-box pastel: a sunny afternoon game on the lawn. */
export const connect4Scene = {
  sky: '#bfe3f5',
  ground: '#9fd49a',
  hemiSky: '#fff8ec',
  hemiGround: '#7fae7a',
  board: '#3d6fd9',
  boardFeet: '#2f57b0',
  discs: ['#ff6b6b', '#ffc93c'] as const,
};

export const connect4Theme: Theme = {
  id: 'connect4',
  themeColor: connect4Scene.sky,
  vars: {
    bg: connect4Scene.sky,
    ink: '#1d2b4f',
    muted: '#5b6b8c',
    card: '#ffffff',
    'card-border': 'none',
    'card-shadow': '0 6px 0 rgba(29, 43, 79, 0.08)',
    accent: '#ff6b6b',
    'accent-ink': '#ffffff',
    'accent-shadow': '#e14f4f',
    'btn-bg': '#1d2b4f',
    'btn-ink': '#ffffff',
    'btn-shadow': 'rgba(0, 0, 0, 0.25)',
    line: '#d9e4f2',
    'input-bg': '#ffffff',
    'font-display': "ui-rounded, 'SF Pro Rounded', 'Nunito', system-ui, sans-serif",
    'font-body': "ui-rounded, 'SF Pro Rounded', 'Nunito', system-ui, sans-serif",
    'text-size': '16px',
    'display-size': '1',
    radius: '18px',
    glow: 'none',
  },
};
