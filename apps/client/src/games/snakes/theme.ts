import type { Theme } from '../../theme/theme';

/** A school exercise book: Seyès paper, ballpoint pen, coloured pencils. */
export const paper = {
  sheet: '#f8f4e9',
  board: '#fffdf7',
  graphite: '#34353f',
  pen: '#2a4cb8',
  redPen: '#d0403a',
  tape: 'rgba(222, 205, 160, 0.75)',
  /** Coloured-pencil washes for alternate cells. */
  washes: ['#f7dd8a', '#b9d7f0'],
  ladder: '#9a6534',
  snake: '#4caf50',
  snakeDark: '#23662a',
  snakeBelly: '#c7e9a8',
  postIt: '#fff0a0',
  pawns: ['#e0453b', '#2a6fdb', '#2f9e55', '#9b59d0'],
};

export const snakesTheme: Theme = {
  id: 'snakes',
  themeColor: paper.sheet,
  vars: {
    bg: paper.sheet,
    ink: paper.graphite,
    muted: '#6d6f7d',
    card: paper.board,
    'card-border': `2px solid ${paper.graphite}`,
    'card-shadow': '3px 4px 0 rgba(52, 53, 63, 0.18)',
    accent: paper.redPen,
    'accent-ink': '#ffffff',
    'accent-shadow': '#93271f',
    'btn-bg': paper.pen,
    'btn-ink': '#ffffff',
    'btn-shadow': '#17306f',
    line: '#cfc8b4',
    'input-bg': paper.board,
    'font-display': "'Caveat', cursive",
    'font-body': "'Patrick Hand', cursive",
    'text-size': '19px',
    'display-size': '1.35',
    radius: '6px',
    glow: 'none',
  },
};
