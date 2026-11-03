/**
 * Miaraka's levels, drawn as text: one character per cell, rows going south.
 *
 *   .  floor            ^  ledge (1.5 high: only the maki jumps up)
 *   #  tsingy wall      x  cracked wall (the zebu breaks it)
 *   ~  water            &  crate (the zebu pushes it; the maki can stand on it)
 *   k  key              K  key on a ledge
 *   |  locked door      *  vanilla pod   +  vanilla pod on a ledge
 *   !  checkpoint       T  treasure pad (one each, both at once)
 *   m  maki's start     z  zebu's start
 *   a–h  a group's switch (plate, heavy plate or lever, see `groups`)
 *   A–H  what the group's switch works (a gate, or a bridge over water)
 */

export type SwitchKind = 'plate' | 'heavy' | 'lever';

export interface Group {
  switch: SwitchKind;
  target: 'gate' | 'bridge';
  /** The switch stands on a ledge. */
  ledge?: boolean;
}

export interface LevelDef {
  name: string;
  rows: string[];
  groups: Record<string, Group>;
  /** Crocodiles swim back and forth between two cell centres. */
  crocs: { from: [number, number]; to: [number, number] }[];
  /** Where the treasure chest stands (a cell centre), between the pads. */
  chest: [number, number];
}

export const LEVELS: LevelDef[] = [
  {
    name: 'Le trésor des Tsingy',
    // prettier-ignore
    rows: [
      '##################################',
      '#......#.......#.....~~..^K^.#...#',
      '#...^+.#.......#..^b.~~..^^^.#...#',
      '#...^^.#...a...#..+^.~~......#.T.#',
      '#......#.......#.....~~.....*#...#',
      '#......#.......A.....~~......#...#',
      '#.m....#.......#.....~~......#...#',
      '#......x.!.....#.!...CC.!....|!..#',
      '#.z....#.......#.....~~......#...#',
      '#......#.......B.....~~......#...#',
      '#......#.......#.&.c.~~......#...#',
      '#......#.*.....#.....~~....x.#.T.#',
      '#*.....#.......#.....~~...#*##...#',
      '##################################',
    ],
    groups: {
      a: { switch: 'heavy', target: 'gate' },
      b: { switch: 'lever', target: 'gate', ledge: true },
      c: { switch: 'plate', target: 'bridge' },
    },
    crocs: [{ from: [21.5, 1.5], to: [21.5, 12.5] }],
    chest: [32.5, 7.5],
  },
];

export const levelSize = (l: LevelDef) => ({ w: l.rows[0].length, h: l.rows.length });

/** The character at a cell; outside the map is wall. */
export function charAt(l: LevelDef, cx: number, cz: number): string {
  return l.rows[cz]?.[cx] ?? '#';
}

export const cellIndex = (l: LevelDef, cx: number, cz: number) => cz * l.rows[0].length + cx;
export const cellOf = (l: LevelDef, index: number): [number, number] => [index % l.rows[0].length, Math.floor(index / l.rows[0].length)];

/** Every cell holding one of these characters. */
export function cellsWith(l: LevelDef, chars: string): [number, number][] {
  const out: [number, number][] = [];
  l.rows.forEach((row, cz) => [...row].forEach((c, cx) => chars.includes(c) && out.push([cx, cz])));
  return out;
}

export const isSwitch = (c: string) => c >= 'a' && c <= 'h';
export const isTarget = (c: string) => c >= 'A' && c <= 'H';
