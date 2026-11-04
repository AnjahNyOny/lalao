import type { Theme } from '../../theme/theme';

/** Each climber's scarf: the colour that tells them apart. */
export const SCARVES: Record<string, { main: string; shade: string; name: string }> = {
  koto: { main: '#e2483d', shade: '#a32a24', name: 'Koto' },
  soa: { main: '#3d8be8', shade: '#22549e', name: 'Soa' },
};

/** The night sky at the foot of the mountain, dawn on the way up, sunrise at the top. */
export const SKY = {
  night: ['#070a1c', '#141a3c', '#232a5a'],
  dawn: ['#1c1d4a', '#5a3d78', '#c8667a'],
  sunrise: ['#3c5aa0', '#e88a6a', '#ffd38a'],
  star: '#e8ecff',
  moon: '#f4f0d8',
  sun: '#ffe08a',
  far: ['#1a2046', '#3a3466', '#6a4a70'],
  near: ['#10142e', '#262448', '#3e2e52'],
};

/** The rock and what grows on it, stage by stage from the bottom up. */
export const STAGE_ART = [
  // La forêt de Morarano: warm granite, moss.
  { rock: ['#5e5550', '#6c625b', '#4e4642'], cap: ['#4f8a3c', '#6fae4a', '#3a6a2e'], edge: '#2e2826' },
  // Les dalles: pale granite, lichen.
  { rock: ['#7c7a76', '#8c8a84', '#68665f'], cap: ['#a7b04a', '#c8c85a', '#7e8a38'], edge: '#3a3834' },
  // Le col du vent: dark rock, dry grass.
  { rock: ['#4e5058', '#5c5e66', '#42444c'], cap: ['#b0a05a', '#cfc07a', '#857840'], edge: '#26282e' },
  // Le Pic Boby: blue-grey rock, frost.
  { rock: ['#5a6474', '#687484', '#4c5564'], cap: ['#dce8f4', '#ffffff', '#a8bccc'], edge: '#262c38' },
];

export const PAL = {
  ice: ['#9ad8f0', '#c8f0ff', '#5aa8cc', '#ffffff'],
  wood: ['#9a6a3c', '#7a4e2a', '#c08a54', '#4e3018'],
  earth: ['#6a4e34', '#8a6a44', '#4a3422'],
  crumble: ['#a8865e', '#8a6a48', '#c8a67a', '#5a4430'],
  rope: ['#d8b47a', '#8a6a3e'],
  tent: ['#d8743c', '#a84e24', '#f0a060'],
  fire: ['#ffd84a', '#ff8a2a', '#e8401e'],
  orchid: ['#ffffff', '#f4a6c8', '#c8508a', '#4a8a3a'],
  flag: ['#ffffff', '#e2302a', '#1f9a4a'],
  cairn: ['#8a8a90', '#b0b0b8', '#5a5a62'],
  outline: '#140f1c',
  glow: '#ffcf8a',
  /** Holding on too long: the fur flushes towards this. */
  flush: '#e0402e',
  /** Grip strength above a climber's head: plenty, half, nearly spent; the frame round it; a drop of sweat. */
  strength: ['#6ad84a', '#f2c83a', '#ec4a32', '#140f1c', '#bfe6ff'],
  alarm: '#fff4d8',
  dust: ['#d8c8a8', '#a89878'],
};

export const tadyTheme: Theme = {
  id: 'tady',
  themeColor: '#141a3c',
  vars: {
    bg: '#0d1230',
    ink: '#f4f0e0',
    muted: '#b8bcd8',
    card: '#1e2450',
    'card-border': '2px solid #4a4f8a',
    'card-shadow': '0 4px 0 #070a1c',
    accent: '#ffb84a',
    'accent-ink': '#2a1a08',
    'accent-shadow': '#b06a1a',
    'btn-bg': '#2e3670',
    'btn-ink': '#f4f0e0',
    'btn-shadow': '#0d1230',
    line: '#4a4f8a',
    'input-bg': '#161b40',
    'font-display': "'Pixelify Sans', ui-monospace, monospace",
    'font-body': "'Pixelify Sans', ui-monospace, monospace",
    'text-size': '17px',
    'display-size': '1.1',
    radius: '6px',
    glow: 'none',
  },
};
