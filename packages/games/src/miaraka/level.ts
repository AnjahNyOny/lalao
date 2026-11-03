/**
 * Miaraka's levels, drawn as text: one character per cell, rows going south.
 *
 *   .  floor            ^  ledge (1.5 high: only the maki jumps up)
 *   #  tsingy wall      I  high rock (2.6: the maki needs the zebu's back)
 *   ~  water            x  cracked wall (the zebu breaks it)
 *   -  shallows: water where a pushed crate sinks and makes a ford (deep water carries it away)
 *   %  rotten planks (hold the maki, give way under the zebu)
 *   &  crate (the zebu pushes it; when it can't go, it goes back where it started)
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
  /** The switch stands on a ledge, or on a high rock. */
  ledge?: boolean;
  high?: boolean;
  /** Plates: every one of them pressed at the same moment, and then it stays open. */
  all?: boolean;
  /** Lever: springs back after this many ms. */
  timer?: number;
}

export type FoeKind = 'croc' | 'bat' | 'fosa';

export interface FoeDef {
  /** Croc: swims, bites at water level. Bat: flies, hits whoever is up high. Fosa: prowls, runs at whoever is on the ground nearby. */
  kind: FoeKind;
  /** Goes back and forth between two cell centres. */
  from: [number, number];
  to: [number, number];
}

export interface LevelDef {
  name: string;
  /** The real place, short enough for a lobby button. */
  place: string;
  /** One line for the lobby: what's new there. */
  blurb: string;
  /** Colours and set dressing, chosen by the client. */
  look: 'tsingy' | 'cave' | 'gorge' | 'forest';
  /** Underground: only the maki's lantern lights the way. */
  dark?: boolean;
  rows: string[];
  groups: Record<string, Group>;
  foes: FoeDef[];
  /** Where the treasure chest stands (a cell centre), between the pads. */
  chest: [number, number];
}

export const LEVELS: LevelDef[] = [
  {
    name: 'Le trésor des Tsingy',
    place: 'Bemaraha',
    blurb: 'La première aventure, pour apprendre à jouer ensemble.',
    look: 'tsingy',
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
    foes: [{ kind: 'croc', from: [21.5, 1.5], to: [21.5, 12.5] }],
    chest: [32.5, 7.5],
  },
  {
    name: 'La grotte de l’Ankarana',
    place: 'Ankarana',
    blurb: 'Dans le noir, seul le maki a une lanterne. Chauve-souris, levier minuté, planches pourries.',
    look: 'cave',
    dark: true,
    // prettier-ignore
    rows: [
      '################################',
      '#+^......#b.#~~~~#.%%k#........#',
      '#.....a..#..#~~~~#.~~~#........#',
      '#........#..^^+^^E!...#....T...#',
      '#........#..#~~~~#....#........#',
      '#..&.a...#..#~~~~#c..*#........#',
      '#.m......#..#########.#........#',
      '#........A!.#*..~~.#..#........#',
      '#.z......#..#.e.~~.#..#........#',
      '#........#..#...~~.#..#........#',
      '#........#..#...CC!x..|!.......#',
      '#........#..#...~~.#..#....T...#',
      '#.....a..#..B!..~~.#..#........#',
      '#*.......#.*#...~~.#*.#.......*#',
      '################################',
    ],
    groups: {
      a: { switch: 'plate', target: 'gate', all: true },
      b: { switch: 'lever', target: 'gate', timer: 4500 },
      c: { switch: 'plate', target: 'bridge' },
      e: { switch: 'heavy', target: 'gate' },
    },
    foes: [{ kind: 'bat', from: [15.5, 1.5], to: [15.5, 5.5] }],
    chest: [29.5, 7.5],
  },
  {
    name: 'Les gorges du Manambolo',
    place: 'Manambolo',
    blurb: 'Deux rivières et leurs crocodiles : courte échelle, gué de caisses, île au trésor.',
    look: 'gorge',
    // prettier-ignore
    rows: [
      '##################################',
      '#...Ia..*#..~~..*.~~~....#.......#',
      '#........#..~~....~~~....#.......#',
      '#........#..~~....~k~....#.....T.#',
      '#........#..~~....~~~....#.......#',
      '#........#..~~....~~~....#.......#',
      '#.m......#..~~....~~~....#.......#',
      '#........A!&--.!..~~~.!..|!......#',
      '#.z......#..~~....~+~....#.......#',
      '#........#.&~~....~~~....#.......#',
      '#........#..~~....~~~.d..#.......#',
      '#........#..~~....DDD....#.....T.#',
      '#......+.#..~~....~~~....#.......#',
      '#*.......#..~~..*.~~~...*#.......#',
      '##################################',
    ],
    groups: {
      a: { switch: 'lever', target: 'gate', high: true },
      d: { switch: 'plate', target: 'bridge' },
    },
    foes: [
      { kind: 'croc', from: [12.5, 1.5], to: [12.5, 13.5] },
      { kind: 'croc', from: [18.5, 13.5], to: [18.5, 1.5] },
    ],
    chest: [32.5, 7.5],
  },
  {
    name: 'La forêt de Kirindy',
    place: 'Kirindy',
    blurb: 'Un fosa rôde dans la forêt sèche. Deux clés, deux portes, un pont de planches.',
    look: 'forest',
    // prettier-ignore
    rows: [
      '##################################',
      '#*........#.*...^K+...#.~~..*#...#',
      '#.........#.....^^^...#.~~.d.#...#',
      '#.........#.#.......#.#.~~...|.T.#',
      '#...&.a...#...........#.%%...#...#',
      '#.........#...........#.~~...#...#',
      '#.m.......#...#.......#.~~...#...#',
      '#.........A!.........!B!~~!..##.##',
      '#.z.......#...........#.~~...#####',
      '#.........#.........#.#.~~...#...#',
      '#.........#..#........#.~~...#...#',
      '#.........#...........#.DD...#...#',
      '#.........#..b.....b..#.~~...|.T.#',
      '#.......+.#.....#.....#.~~.x.#...#',
      '#*........#..........*#.~~#k##...#',
      '##################################',
    ],
    groups: {
      a: { switch: 'heavy', target: 'gate' },
      b: { switch: 'plate', target: 'gate', all: true },
      d: { switch: 'lever', target: 'bridge' },
    },
    foes: [
      { kind: 'fosa', from: [15.5, 9.5], to: [19.5, 5.5] },
      { kind: 'croc', from: [24.5, 1.5], to: [24.5, 14.5] },
    ],
    chest: [31.5, 7.5],
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
