import type { Theme } from '../../theme/theme';

/** Toy-box cartoon: a chunky plastic board on a sunny lawn. */
export const connect4Scene = {
  sky: '#bfe3f5',
  skyLow: '#e4f4fb',
  grass: '#9fd49a',
  grassDark: '#7fbf7a',
  board: '#3d6fd9',
  boardDark: '#2a4f9e',
  outline: '#1d2b4f',
  discs: ['#ff6b6b', '#ffc93c'] as const,
  discsDark: ['#d94848', '#e0a514'] as const,
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
