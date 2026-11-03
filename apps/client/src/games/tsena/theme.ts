import type { CellKind } from '@game/games/tsena';
import type { Theme } from '../../theme/theme';

/** The Red Island in the sun: laterite roads, ravinala green, turquoise lagoons. */
export const island = {
  sky: '#a9dcef',
  skyFar: '#d9f1f7',
  ocean: '#2b8fbf',
  lagoon: '#5cc9d1',
  sand: '#ecd9a6',
  grass: '#79b956',
  grassDark: '#5e9e45',
  laterite: '#c4643b',
  road: '#b9653f',
  hill: ['#6aa84f', '#7fb45a', '#8fc062', '#b9683e'],
  rice: ['#9ad66a', '#7cc456', '#5fae47'],
  tile: '#fff4dc',
  tileEdge: '#d9c39a',
  ink: '#3a2116',
  /** A mortgaged site's tile. */
  tileMortgaged: '#d3cbbd',
  /** Special cells get their own colour. */
  special: {
    start: '#f2c14e',
    taxi: '#f6d873',
    vintana: '#9cc3f2',
    fihavanana: '#f6bf8e',
    tax: '#d9b99b',
    landtax: '#d6c7a3',
    festival: '#f4a6c0',
    cyclone: '#c3c9d3',
    jail: '#a9b2bc',
    roadblock: '#ef9a73',
  } satisfies Record<Exclude<CellKind, 'site'>, string>,
  /** Band colour of each region's sites (as in REGIONS). */
  regions: ['#c8683f', '#8ab33f', '#e0a030', '#ef7a6a', '#e9c43a', '#8a63b8', '#2a9d8f', '#3d7dd8', '#2f7a45', '#d64f8a', '#7a2e3a'],
  /** Seat colours: each pawn stands on a disc of its player's colour. */
  players: ['#e63946', '#1f6fe5', '#f5b700', '#8e44ad'],
};

export const tsenaTheme: Theme = {
  id: 'tsena',
  themeColor: island.sky,
  vars: {
    bg: '#e8f5ef',
    ink: island.ink,
    muted: '#7a5b49',
    card: '#fffaf0',
    'card-border': `2px solid #ecd9b6`,
    'card-shadow': '0 5px 0 rgba(122, 64, 30, 0.18)',
    accent: '#1f8a4c',
    'accent-ink': '#ffffff',
    'accent-shadow': '#146236',
    'btn-bg': island.laterite,
    'btn-ink': '#ffffff',
    'btn-shadow': '#8a3e1f',
    line: '#ecd9b6',
    'input-bg': '#ffffff',
    'font-display': "'Baloo 2', ui-rounded, system-ui, sans-serif",
    'font-body': "'Baloo 2', ui-rounded, system-ui, sans-serif",
    'text-size': '17px',
    'display-size': '1.15',
    radius: '16px',
    glow: 'none',
  },
};
