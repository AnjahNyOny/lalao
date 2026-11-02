import type { Theme } from './theme';

/** Lalao's own look: the main menu. Neon on deep purple, pixel fonts, CRT scanlines. */
export const NEON = {
  pink: '#ff2a6d',
  cyan: '#05d9e8',
  yellow: '#f9c80e',
  night: '#0b0420',
  violet: '#1a0838',
};

export const arcadeTheme: Theme = {
  id: 'arcade',
  themeColor: NEON.night,
  vars: {
    bg: NEON.night,
    ink: '#f4f1ff',
    muted: '#a497d6',
    card: 'rgba(18, 6, 44, 0.86)',
    'card-border': `2px solid ${NEON.cyan}`,
    'card-shadow': `0 0 0 2px ${NEON.night}, 0 0 18px rgba(5, 217, 232, 0.35)`,
    accent: NEON.pink,
    'accent-ink': '#ffffff',
    'accent-shadow': '#9c0f42',
    'btn-bg': NEON.cyan,
    'btn-ink': NEON.night,
    'btn-shadow': '#027680',
    line: '#4a3590',
    'input-bg': '#120836',
    'font-display': "'Press Start 2P', monospace",
    'font-body': "'VT323', monospace",
    'text-size': '22px',
    'display-size': '0.75',
    radius: '4px',
    glow: `0 0 6px ${NEON.pink}, 0 0 18px rgba(255, 42, 109, 0.6)`,
  },
};
