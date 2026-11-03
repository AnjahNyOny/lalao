/**
 * Tsena: a road trip round Madagascar, buying the island's famous places.
 * A loop of 48 cells from Antananarivo: south down the RN7 through the
 * highlands, across the deep south, up the west coast, round the north and
 * down the east coast, back to Tana.
 */

export type CellKind =
  | 'start'
  | 'site'
  | 'taxi'
  | 'vintana'
  | 'fihavanana'
  | 'tax'
  | 'landtax'
  | 'festival'
  | 'cyclone'
  | 'jail'
  | 'roadblock';

export interface Cell {
  kind: CellKind;
  name: string;
  /** Sites only. */
  region?: number;
  price?: number;
}

export const REGIONS = [
  'Hautes Terres',
  'Pays betsileo',
  'Ihorombe',
  'Anosy',
  'Sud-Ouest',
  'Côte Ouest',
  'Nord-Ouest',
  'Grand Nord',
  'Sava',
  'Côte Est',
  'Analamanga',
] as const;

const site = (name: string, region: number, price: number): Cell => ({ kind: 'site', name, region, price });
const special = (kind: Exclude<CellKind, 'site'>, name: string): Cell => ({ kind, name });

export const CELLS: Cell[] = [
  special('start', 'Antananarivo'),
  // RN7, south through the highlands.
  site('Antsirabe', 0, 80),
  site('Lac Tritriva', 0, 80),
  special('fihavanana', 'Fihavanana'),
  site('Ambositra', 0, 100),
  site('Ranomafana', 1, 120),
  site('Fianarantsoa', 1, 120),
  site('Ambalavao', 1, 140),
  special('taxi', 'Taxi-brousse'),
  site('Isalo', 2, 160),
  site('Ilakaka', 2, 180),
  special('vintana', 'Vintana'),
  // Across the deep south.
  special('jail', 'Fonja'),
  site('Taolagnaro', 3, 180),
  special('tax', 'Hetra'),
  site('Berenty', 3, 200),
  special('fihavanana', 'Fihavanana'),
  site('Anakao', 4, 200),
  site('Toliara', 4, 200),
  site('Ifaty', 4, 220),
  special('taxi', 'Taxi-brousse'),
  // Up the west coast.
  site('Morondava', 5, 240),
  special('cyclone', 'Cyclone'),
  site('Kirindy', 5, 240),
  site('Tsingy de Bemaraha', 5, 260),
  special('vintana', 'Vintana'),
  special('fihavanana', 'Fihavanana'),
  site('Mahajanga', 6, 260),
  special('festival', 'Hira gasy'),
  special('taxi', 'Taxi-brousse'),
  site('Nosy Be', 6, 280),
  site('Ambanja', 6, 280),
  // Round the north.
  site("Montagne d'Ambre", 7, 300),
  site('Antsiranana', 7, 300),
  site("Mer d'Émeraude", 7, 320),
  site('Sambava', 8, 320),
  special('landtax', 'Taxe foncière'),
  special('roadblock', 'Barrage'),
  site('Marojejy', 8, 320),
  site('Masoala', 8, 340),
  special('vintana', 'Vintana'),
  // Down the east coast and back up to Tana.
  site('Nosy Boraha', 9, 340),
  site('Toamasina', 9, 360),
  special('taxi', 'Taxi-brousse'),
  site('Andasibe', 9, 360),
  site('Lac Anosy', 10, 380),
  site('Ambohimanga', 10, 400),
  site('Rova', 10, 440),
];

export const CELL_COUNT = CELLS.length;
export const cellNamed = (name: string) => CELLS.findIndex((c) => c.name === name);
export const JAIL = CELLS.findIndex((c) => c.kind === 'jail');

export const START_MONEY = 2000;
/** Paid each time a pawn passes (or stops on) Antananarivo. */
export const SALARY = 250;
/** The game lasts about this many turns in all: more rounds with fewer players. */
export const TOTAL_TURNS = 64;
export const roundsFor = (players: number) => Math.ceil(TOTAL_TURNS / players);
/** A taxi-brousse ride costs this much and goes up to TAXI_RANGE cells ahead. */
export const TAXI_FARE = 50;
export const TAXI_RANGE = 6;
/** Hetra: this share of the player's cash. */
export const TAX_RATE = 0.1;
/** Taxe foncière, for each site, house and hotel owned. */
export const LAND_TAX = { site: 20, house: 40, hotel: 150 } as const;
/** Hira gasy: every other player gives this much (or what they have). */
export const FESTIVAL_GIFT = 30;
/** Fonja: the bail, and how many tries at a double before it must be paid. */
export const BAIL = 80;
export const JAIL_TRIES = 2;
/** A double plays again, at most this many times in a turn. */
export const MAX_DOUBLES = 2;
/** Offers to buy another player's site, per turn. */
export const MAX_OFFERS = 3;

/** 0 = bare site, 1 to 3 = houses, 4 = hotel. */
export const MAX_LEVEL = 4;
export const LEVEL_NAMES = ['terrain nu', '1 maison', '2 maisons', '3 maisons', 'hôtel'] as const;
const RENT_FACTOR = [0.12, 0.5, 1.4, 3, 4.2];

const round10 = (n: number) => Math.round(n / 10) * 10;

export const priceOf = (cell: number) => CELLS[cell].price!;
/** A house (or the hotel, which replaces three houses). */
export const houseCost = (cell: number) => round10(priceOf(cell) * 0.5);
export const mortgageValue = (cell: number) => round10(priceOf(cell) / 2);
export const redeemCost = (cell: number) => round10(mortgageValue(cell) * 1.1);

export const regionCells = (region: number) => CELLS.flatMap((c, i) => (c.region === region ? [i] : []));
export const regionOf = (cell: number) => regionCells(CELLS[cell].region!);

/** Sites of the cell's region held by the cell's owner. */
const held = (owner: (number | null)[], cell: number) => regionOf(cell).filter((i) => owner[i] === owner[cell]).length;

/** Houses need most of the region (all of a two-site region). */
export function majority(owner: (number | null)[], cell: number): boolean {
  const n = regionOf(cell).length;
  return owner[cell] !== null && (held(owner, cell) === n || held(owner, cell) * 2 > n);
}

/** True when the cell's owner holds every site of its region: double bare rent, and the hotel. */
export function fullRegion(owner: (number | null)[], cell: number): boolean {
  return owner[cell] !== null && held(owner, cell) === regionOf(cell).length;
}

/** Rent at a given level: a bare site's rent doubles when its owner holds the whole region. */
export function rentAt(cell: number, level: number, full: boolean): number {
  const rent = round10(priceOf(cell) * RENT_FACTOR[level]);
  return level === 0 && full ? rent * 2 : rent;
}

export type Deck = 'vintana' | 'fihavanana';

export type CardId =
  // Vintana (fate): mostly moves.
  | 'wind'
  | 'flood'
  | 'tana'
  | 'taxi'
  | 'rova'
  | 'whales'
  | 'tsingy'
  | 'roadblock'
  | 'pass'
  | 'pothole'
  | 'rains'
  | 'savika'
  // Fihavanana (kinship): money, given and shared.
  | 'vanilla'
  | 'wedding'
  | 'lemur'
  | 'doctor'
  | 'school'
  | 'inheritance'
  | 'kabary'
  | 'independence'
  | 'lawyer'
  | 'rice'
  | 'market'
  | 'solidarity'
  | 'family';

export const DECKS: Record<Deck, { id: CardId; weight: number }[]> = {
  vintana: [
    { id: 'wind', weight: 2 },
    { id: 'flood', weight: 2 },
    { id: 'tana', weight: 1 },
    { id: 'taxi', weight: 2 },
    { id: 'rova', weight: 1 },
    { id: 'whales', weight: 1 },
    { id: 'tsingy', weight: 1 },
    { id: 'roadblock', weight: 1 },
    { id: 'pass', weight: 1 },
    { id: 'pothole', weight: 1 },
    { id: 'rains', weight: 1 },
    { id: 'savika', weight: 1 },
  ],
  fihavanana: [
    { id: 'vanilla', weight: 2 },
    { id: 'wedding', weight: 1 },
    { id: 'lemur', weight: 1 },
    { id: 'doctor', weight: 1 },
    { id: 'school', weight: 1 },
    { id: 'inheritance', weight: 1 },
    { id: 'kabary', weight: 1 },
    { id: 'independence', weight: 1 },
    { id: 'lawyer', weight: 1 },
    { id: 'rice', weight: 1 },
    { id: 'market', weight: 1 },
    { id: 'solidarity', weight: 1 },
    { id: 'family', weight: 1 },
  ],
};

/** Money from (> 0) or to (< 0) the bank. */
export const CARD_CASH: Partial<Record<CardId, number>> = {
  savika: 100,
  pothole: -80,
  vanilla: 150,
  doctor: -60,
  school: -50,
  inheritance: 100,
  kabary: 50,
  rice: -40,
  market: 80,
};
export const CARD_STEPS = 3;
/** Wedding: each player gives this; lemur: the player gives this to each. */
export const CARD_GIFT = 20;
/** Independence day: the bank gives everyone this. */
export const CARD_BONUS = 50;
/** Solidarity: to the poorest player; family: from the richest. */
export const CARD_HELP = 50;
/** Rains: per house and per hotel. */
export const CARD_REPAIRS = { house: 25, hotel: 100 } as const;
/** Where the travel cards send the pawn. */
export const CARD_GOTO: Partial<Record<CardId, number>> = {
  tana: 0,
  rova: cellNamed('Rova'),
  whales: cellNamed('Nosy Boraha'),
  tsingy: cellNamed('Tsingy de Bemaraha'),
};

/**
 * Replay pace shared by the view (animations) and the bots (how long they
 * wait), so a bot never acts while the previous move is still on screen.
 */
export const PACE = { dice: 1200, step: 430, jump: 1600, event: 1050, card: 2800, settle: 1100 } as const;
