import { mulberryStep, type GameDefinition, type PlayerId } from '@game/core';
import {
  BAIL,
  CARD_BONUS,
  CARD_CASH,
  CARD_GIFT,
  CARD_GOTO,
  CARD_HELP,
  CARD_REPAIRS,
  CARD_STEPS,
  CELL_COUNT,
  CELLS,
  DECKS,
  FESTIVAL_GIFT,
  fullRegion,
  houseCost,
  JAIL,
  JAIL_TRIES,
  LAND_TAX,
  MAX_DOUBLES,
  MAX_LEVEL,
  majority,
  MAX_OFFERS,
  mortgageValue,
  PACE,
  priceOf,
  redeemCost,
  rentAt,
  roundsFor,
  SALARY,
  START_MONEY,
  TAX_RATE,
  TAXI_FARE,
  TAXI_RANGE,
  type CardId,
  type Deck,
} from './board';
import { tsenaBot } from './bot';

export * from './board';

export type MoveVia = 'walk' | 'back' | 'card' | 'taxi' | 'jail';

/** One step of an action, in order, so every screen can replay it. Amounts are in ariary. */
export type TsenaEvent =
  | { t: 'dice'; dice: [number, number] }
  /** Cells entered one after the other (a single cell for a jump to the fonja). */
  | { t: 'move'; path: number[]; via: MoveVia }
  | { t: 'salary'; amount: number }
  /** A double: the same player rolls again. */
  | { t: 'again' }
  | { t: 'buy'; cell: number; price: number }
  | { t: 'rent'; cell: number; to: number; amount: number }
  | { t: 'card'; deck: Deck; card: CardId }
  /** Bank money: card bonus (> 0) or fine (< 0). */
  | { t: 'cash'; amount: number }
  | { t: 'tax'; kind: 'tax' | 'landtax' | 'rains'; amount: number }
  | { t: 'fare'; amount: number }
  | { t: 'gift'; from: number; to: number; amount: number }
  /** The bank pays every player still in the game. */
  | { t: 'bonus'; amount: number }
  /** A laissez-passer to keep. */
  | { t: 'keep' }
  /** The player's tallest building loses a level; null if they had none. */
  | { t: 'cyclone'; cell: number | null; level: number }
  | { t: 'jail' }
  /** Out of the fonja; `amount` is the bail paid, if any. */
  | { t: 'free'; how: 'doubles' | 'bail' | 'pass' | 'forced'; amount: number }
  /** No double: still in the fonja, `tries` left. */
  | { t: 'stay'; tries: number }
  | { t: 'build'; cell: number; level: number; cost: number }
  /** A house sold back to the bank; `forced` when raising money for a debt. */
  | { t: 'sell'; cell: number; level: number; amount: number; forced: boolean }
  | { t: 'mortgage'; cell: number; amount: number; forced: boolean }
  | { t: 'redeem'; cell: number; amount: number }
  | { t: 'offer'; cell: number; price: number; to: number }
  /** `from` sold `cell` to `to`. */
  | { t: 'deal'; cell: number; price: number; from: number; to: number }
  | { t: 'refuse'; cell: number; by: number }
  | { t: 'cancel'; cell: number }
  /** Out of the game; their sites go back to the bank. */
  | { t: 'bankrupt'; seat: number; to: number | null }
  | { t: 'pass'; what: 'buy' | 'taxi' };

export interface TurnLog {
  /** Increases with every action: lets the view spot a new move. */
  seq: number;
  /** Seat that acted (the one answering an offer, for an answer). */
  player: number;
  events: TsenaEvent[];
}

/** A choice to make before the game moves on. */
export type Pending =
  | { kind: 'buy'; cell: number }
  | { kind: 'taxi'; fare: number }
  /** `from` offers `price` for `to`'s site: `to` answers. */
  | { kind: 'offer'; cell: number; price: number; from: number; to: number };

export interface TsenaState {
  players: PlayerId[];
  money: number[];
  pos: number[];
  /** Per cell: owning seat, or null. */
  owner: (number | null)[];
  /** Per cell: 0 = bare, 1 to 3 houses, 4 = hotel. */
  level: number[];
  mortgaged: boolean[];
  /** Per seat: tries at a double left in the fonja, 0 when free. */
  jail: number[];
  /** Per seat: laissez-passer cards held. */
  passes: number[];
  /** Per seat: bankrupt, out of the game. */
  out: boolean[];
  turn: number;
  /** Seat that played first: a round ends when the dice come back to it. */
  first: number;
  round: number;
  rounds: number;
  /** Doubles rolled this turn, and whether the next roll is a replay. */
  doubles: number;
  again: boolean;
  /** Offers made this turn. */
  offers: number;
  pending: Pending | null;
  /** mulberry32 state for the dice and cards. Never sent to players. */
  rng: number;
  last: TurnLog | null;
  over: boolean;
}

/** What players see: everything but the dice to come. */
export type TsenaView = Omit<TsenaState, 'rng'>;

export type TsenaAction =
  | { type: 'roll' }
  | { type: 'buy' }
  /** Taxi-brousse: go `steps` cells ahead. */
  | { type: 'ride'; steps: number }
  /** Decline a purchase, or stay at the taxi stop. */
  | { type: 'pass' }
  | { type: 'bail' }
  | { type: 'pardon' }
  | { type: 'build'; cell: number }
  | { type: 'sell'; cell: number }
  | { type: 'mortgage'; cell: number }
  | { type: 'redeem'; cell: number }
  | { type: 'offer'; cell: number; price: number }
  | { type: 'accept' }
  | { type: 'refuse' }
  | { type: 'cancel' };

export const alive = (s: Pick<TsenaView, 'out'>) => s.out.flatMap((out, seat) => (out ? [] : [seat]));

/** Cash, plus sites (half when mortgaged) and buildings at cost. */
export function worthOf(s: Pick<TsenaView, 'money' | 'owner' | 'level' | 'mortgaged'>, seat: number): number {
  return s.owner.reduce<number>((sum, o, cell) => {
    if (o !== seat) return sum;
    return sum + (s.mortgaged[cell] ? mortgageValue(cell) : priceOf(cell)) + s.level[cell] * houseCost(cell);
  }, s.money[seat]);
}

/** What landing on the site costs its visitors right now. */
export function rentOf(s: Pick<TsenaView, 'owner' | 'level' | 'mortgaged'>, cell: number): number {
  if (s.owner[cell] === null || s.mortgaged[cell]) return 0;
  return rentAt(cell, s.level[cell], fullRegion(s.owner, cell));
}

/**
 * The seat can add a house here: most of the region is theirs (all of it for
 * the hotel, which replaces three houses), and the site isn't mortgaged.
 */
export const canBuild = (s: TsenaView, seat: number, cell: number) =>
  CELLS[cell].kind === 'site' &&
  s.owner[cell] === seat &&
  !s.mortgaged[cell] &&
  s.level[cell] < MAX_LEVEL &&
  majority(s.owner, cell) &&
  (s.level[cell] < MAX_LEVEL - 1 || fullRegion(s.owner, cell)) &&
  s.money[seat] >= houseCost(cell);

/** Only bare sites can be mortgaged or change hands. */
export const canMortgage = (s: TsenaView, seat: number, cell: number) =>
  CELLS[cell].kind === 'site' && s.owner[cell] === seat && !s.mortgaged[cell] && s.level[cell] === 0;

export const canOffer = (s: TsenaView, seat: number, cell: number) => {
  const owner = s.owner[cell];
  return CELLS[cell].kind === 'site' && owner !== null && owner !== seat && !s.out[owner] && s.level[cell] === 0 && s.offers < MAX_OFFERS;
};

/** Building, selling and mortgaging are allowed before rolling, and while deciding on a purchase. */
export const canManage = (s: TsenaView) => s.pending === null || s.pending.kind === 'buy';

/** Walking takes a beat per cell; a taxi ride or a card's jump goes faster, and never drags on. */
export function moveMs(e: { path: number[]; via: MoveVia }): number {
  if (e.via === 'jail') return PACE.jump;
  const ms = e.path.length * PACE.step;
  return e.via === 'walk' || e.via === 'back' ? ms : Math.min(ms * 0.6, 3600);
}

/** How long one event stays on screen; a card gets time to be read. */
export const eventMs = (e: TsenaEvent) =>
  e.t === 'dice' ? PACE.dice : e.t === 'move' ? moveMs(e) : e.t === 'card' ? PACE.card : PACE.event;

/** How long an action's replay lasts on screen (the view follows the same pace). */
export const replayMs = (log: TurnLog | null) => (log ? log.events.reduce((ms, e) => ms + eventMs(e), 0) : 0);

const nextTaxi = (from: number) => {
  for (let i = 1; i <= CELL_COUNT; i++) if (CELLS[(from + i) % CELL_COUNT].kind === 'taxi') return (from + i) % CELL_COUNT;
  return from;
};

/** Mutable working copy for one action; `apply` never touches its input. */
class Turn {
  readonly s: TsenaState;
  readonly log: TurnLog;

  constructor(state: TsenaState, actor = state.turn) {
    this.s = {
      ...state,
      money: state.money.slice(),
      pos: state.pos.slice(),
      owner: state.owner.slice(),
      level: state.level.slice(),
      mortgaged: state.mortgaged.slice(),
      jail: state.jail.slice(),
      passes: state.passes.slice(),
      out: state.out.slice(),
      pending: null,
    };
    this.log = { seq: (state.last?.seq ?? 0) + 1, player: actor, events: [] };
  }

  get me(): number {
    return this.s.turn;
  }

  event(e: TsenaEvent): void {
    this.log.events.push(e);
  }

  rand(): number {
    const [value, next] = mulberryStep(this.s.rng);
    this.s.rng = next;
    return value;
  }

  dice(): [number, number] {
    const dice: [number, number] = [1 + Math.floor(this.rand() * 6), 1 + Math.floor(this.rand() * 6)];
    this.event({ t: 'dice', dice });
    return dice;
  }

  /** Forward, paying the salary when passing Antananarivo, then resolves the cell reached. */
  go(steps: number, via: MoveVia): void {
    const path: number[] = [];
    for (let i = 0; i < steps; i++) {
      const cell = (this.s.pos[this.me] + 1) % CELL_COUNT;
      this.s.pos[this.me] = cell;
      path.push(cell);
      if (cell !== 0) continue;
      this.event({ t: 'move', path: path.splice(0), via });
      this.s.money[this.me] += SALARY;
      this.event({ t: 'salary', amount: SALARY });
    }
    if (path.length) this.event({ t: 'move', path, via });
    this.land(via);
  }

  goTo(cell: number, via: MoveVia): void {
    this.go((cell - this.s.pos[this.me] + CELL_COUNT) % CELL_COUNT || CELL_COUNT, via);
  }

  back(steps: number): void {
    const path: number[] = [];
    for (let i = 0; i < steps; i++) {
      this.s.pos[this.me] = (this.s.pos[this.me] - 1 + CELL_COUNT) % CELL_COUNT;
      path.push(this.s.pos[this.me]);
    }
    this.event({ t: 'move', path, via: 'back' });
    this.land('back');
  }

  /** Straight to the fonja: no salary, and no replay for a double. */
  toJail(): void {
    this.s.pos[this.me] = JAIL;
    this.s.jail[this.me] = JAIL_TRIES;
    this.s.again = false;
    this.event({ t: 'move', path: [JAIL], via: 'jail' });
    this.event({ t: 'jail' });
  }

  /**
   * The current player pays `amount` to a seat (or the bank). Short of cash,
   * they sell houses then mortgage sites; short even then, they are bankrupt.
   * Returns false on bankruptcy.
   */
  pay(amount: number, to: number | null, record: (paid: number) => TsenaEvent): boolean {
    const { money, owner, level, mortgaged } = this.s;
    const me = this.me;
    const mine = () => owner.flatMap((o, cell) => (o === me ? [cell] : []));
    while (money[me] < amount) {
      const built = mine().filter((c) => level[c] > 0);
      if (built.length) {
        // Tallest first, so a region comes down evenly.
        const cell = built.sort((a, b) => level[b] - level[a] || houseCost(b) - houseCost(a))[0];
        const value = Math.floor(houseCost(cell) / 2);
        money[me] += value;
        this.event({ t: 'sell', cell, level: --level[cell], amount: value, forced: true });
        continue;
      }
      const cell = mine()
        .filter((c) => !mortgaged[c])
        .sort((a, b) => priceOf(a) - priceOf(b))[0];
      if (cell === undefined) break;
      mortgaged[cell] = true;
      money[me] += mortgageValue(cell);
      this.event({ t: 'mortgage', cell, amount: mortgageValue(cell), forced: true });
    }
    const paid = Math.min(amount, money[me]);
    money[me] -= paid;
    if (to !== null) money[to] += paid;
    this.event(record(paid));
    if (paid < amount) {
      this.bankrupt(to);
      return false;
    }
    return true;
  }

  /** Out of the game: sites go back to the bank, free and bare. */
  bankrupt(to: number | null): void {
    const s = this.s;
    const me = this.me;
    s.out[me] = true;
    s.passes[me] = 0;
    s.jail[me] = 0;
    s.again = false;
    s.owner.forEach((o, cell) => {
      if (o !== me) return;
      s.owner[cell] = null;
      s.level[cell] = 0;
      s.mortgaged[cell] = false;
    });
    this.event({ t: 'bankrupt', seat: me, to });
    if (alive(s).length <= 1) s.over = true;
  }

  /** Resolves the cell the pawn stopped on. */
  land(via: MoveVia): void {
    const s = this.s;
    const me = this.me;
    const cell = s.pos[me];
    const c = CELLS[cell];
    switch (c.kind) {
      case 'site': {
        const owner = s.owner[cell];
        if (owner === null) s.pending = { kind: 'buy', cell };
        else if (owner !== me) {
          const rent = rentOf(s, cell);
          if (rent > 0) this.pay(rent, owner, (amount) => ({ t: 'rent', cell, to: owner, amount }));
        }
        return;
      }
      case 'taxi':
        // Sent here by a card: the ride is free. A ride never chains into another.
        if (via === 'card') s.pending = { kind: 'taxi', fare: 0 };
        else if (via === 'walk' && s.money[me] >= TAXI_FARE) s.pending = { kind: 'taxi', fare: TAXI_FARE };
        return;
      case 'vintana':
      case 'fihavanana':
        // A card that moves the pawn never draws another one.
        if (via !== 'card' && via !== 'back') this.card(c.kind);
        return;
      case 'tax': {
        const tax = Math.floor((s.money[me] * TAX_RATE) / 10) * 10;
        if (tax > 0) this.pay(tax, null, (amount) => ({ t: 'tax', kind: 'tax', amount }));
        return;
      }
      case 'landtax': {
        const tax = s.owner.reduce<number>((sum, o, i) => {
          if (o !== me) return sum;
          const l = s.level[i];
          return sum + LAND_TAX.site + (l === MAX_LEVEL ? LAND_TAX.hotel : l * LAND_TAX.house);
        }, 0);
        if (tax > 0) this.pay(tax, null, (amount) => ({ t: 'tax', kind: 'landtax', amount }));
        else this.event({ t: 'tax', kind: 'landtax', amount: 0 });
        return;
      }
      case 'festival':
        for (const from of alive(s)) {
          if (from === me) continue;
          const amount = Math.min(FESTIVAL_GIFT, s.money[from]);
          s.money[from] -= amount;
          s.money[me] += amount;
          this.event({ t: 'gift', from, to: me, amount });
        }
        return;
      case 'cyclone': {
        const hit = s.owner
          .flatMap((o, i) => (o === me && s.level[i] > 0 ? [i] : []))
          .sort((a, b) => s.level[b] - s.level[a] || houseCost(b) - houseCost(a))[0];
        if (hit === undefined) this.event({ t: 'cyclone', cell: null, level: 0 });
        else this.event({ t: 'cyclone', cell: hit, level: --s.level[hit] });
        return;
      }
      case 'roadblock':
        return this.toJail();
      case 'start':
      case 'jail':
        return;
    }
  }

  /** Draws from a deck, at random (weighted), and plays the card. */
  card(deck: Deck): void {
    const s = this.s;
    const me = this.me;
    const cards = DECKS[deck];
    const total = cards.reduce((sum, c) => sum + c.weight, 0);
    let x = this.rand() * total;
    const card = cards.find((c) => (x -= c.weight) < 0)?.id ?? cards[0].id;
    this.event({ t: 'card', deck, card });

    const cash = CARD_CASH[card];
    if (cash !== undefined) {
      if (cash >= 0) {
        s.money[me] += cash;
        this.event({ t: 'cash', amount: cash });
      } else this.pay(-cash, null, (paid) => ({ t: 'cash', amount: -paid }));
      return;
    }
    const goto = CARD_GOTO[card];
    if (goto !== undefined) return this.goTo(goto, 'card');

    const others = alive(s).filter((seat) => seat !== me);
    switch (card) {
      case 'wind':
        return this.go(CARD_STEPS, 'card');
      case 'flood':
        return this.back(CARD_STEPS);
      case 'taxi':
        return this.goTo(nextTaxi(s.pos[me]), 'card');
      case 'roadblock':
        return this.toJail();
      case 'pass':
      case 'lawyer':
        s.passes[me]++;
        this.event({ t: 'keep' });
        return;
      case 'rains': {
        const repairs = s.owner.reduce<number>((sum, o, i) => {
          if (o !== me) return sum;
          return sum + (s.level[i] === MAX_LEVEL ? CARD_REPAIRS.hotel : s.level[i] * CARD_REPAIRS.house);
        }, 0);
        if (repairs > 0) this.pay(repairs, null, (amount) => ({ t: 'tax', kind: 'rains', amount }));
        else this.event({ t: 'tax', kind: 'rains', amount: 0 });
        return;
      }
      case 'wedding':
        for (const from of others) {
          const amount = Math.min(CARD_GIFT, s.money[from]);
          s.money[from] -= amount;
          s.money[me] += amount;
          this.event({ t: 'gift', from, to: me, amount });
        }
        return;
      case 'lemur':
        for (const to of others) if (!this.pay(CARD_GIFT, to, (amount) => ({ t: 'gift', from: me, to, amount }))) return;
        return;
      case 'independence':
        for (const seat of alive(s)) s.money[seat] += CARD_BONUS;
        this.event({ t: 'bonus', amount: CARD_BONUS });
        return;
      case 'solidarity': {
        const poorest = others.sort((a, b) => s.money[a] - s.money[b])[0];
        if (poorest !== undefined) this.pay(CARD_HELP, poorest, (amount) => ({ t: 'gift', from: me, to: poorest, amount }));
        return;
      }
      case 'family': {
        const richest = others.sort((a, b) => s.money[b] - s.money[a])[0];
        if (richest === undefined || s.money[richest] <= s.money[me]) return;
        const amount = Math.min(CARD_HELP, s.money[richest]);
        s.money[richest] -= amount;
        s.money[me] += amount;
        this.event({ t: 'gift', from: richest, to: me, amount });
        return;
      }
    }
  }

  /**
   * After a move is fully resolved (`end`): plays again on a double, or hands
   * the dice on. Building, mortgaging and offers never end the turn.
   */
  finish(end: boolean): TsenaState {
    const s = this.s;
    s.last = this.log;
    if (s.over || s.pending || !end) return s;
    if (s.again && !s.out[this.me]) {
      s.again = false;
      this.event({ t: 'again' });
      return s;
    }
    s.again = false;
    s.doubles = 0;
    s.offers = 0;
    // A new round starts when the dice come back to the first player's seat.
    let next = this.me;
    do {
      next = (next + 1) % s.players.length;
      if (next === s.first) s.round++;
    } while (s.out[next] && next !== this.me);
    if (s.round > s.rounds) s.over = true;
    else s.turn = next;
    return s;
  }
}

const isCell = (cell: unknown) => Number.isInteger(cell) && (cell as number) >= 0 && (cell as number) < CELL_COUNT;

function isAction(a: unknown): a is TsenaAction {
  if (typeof a !== 'object' || a === null) return false;
  const { type, steps, cell, price } = a as Record<string, unknown>;
  switch (type) {
    case 'ride':
      return Number.isInteger(steps) && (steps as number) >= 1 && (steps as number) <= TAXI_RANGE;
    case 'build':
    case 'sell':
    case 'mortgage':
    case 'redeem':
      return isCell(cell);
    case 'offer':
      return isCell(cell) && Number.isInteger(price) && (price as number) >= 10 && (price as number) % 10 === 0;
    case 'roll':
    case 'buy':
    case 'pass':
    case 'bail':
    case 'pardon':
    case 'accept':
    case 'refuse':
    case 'cancel':
      return true;
    default:
      return false;
  }
}

export const tsena: GameDefinition<TsenaState, TsenaAction, TsenaView> = {
  id: 'tsena',
  name: 'Tsena',
  minPlayers: 2,
  maxPlayers: 4,
  // Wait for the last action to finish playing on screen, then a beat.
  botDelayMs: (state) => {
    const busy = replayMs(state.last) + PACE.settle;
    return [busy, busy + 500];
  },

  setup(players, seed) {
    return {
      players,
      money: players.map(() => START_MONEY),
      pos: players.map(() => 0),
      owner: CELLS.map(() => null),
      level: CELLS.map(() => 0),
      mortgaged: CELLS.map(() => false),
      jail: players.map(() => 0),
      passes: players.map(() => 0),
      out: players.map(() => false),
      turn: seed % players.length,
      first: seed % players.length,
      round: 1,
      rounds: roundsFor(players.length),
      doubles: 0,
      again: false,
      offers: 0,
      pending: null,
      rng: (seed ^ 0x5bd1e995) >>> 0,
      last: null,
      over: false,
    };
  },

  validate(s, action, by): action is TsenaAction {
    if (s.over || !isAction(action)) return false;
    const seat = s.players.indexOf(by);
    if (seat < 0 || s.out[seat]) return false;
    const p = s.pending;
    if (p?.kind === 'offer') {
      if (action.type === 'cancel') return seat === p.from;
      if (action.type === 'refuse') return seat === p.to;
      if (action.type === 'accept') return seat === p.to && s.owner[p.cell] === seat && s.money[p.from] >= p.price;
      return false;
    }
    if (seat !== s.turn) return false;
    const money = s.money[seat];
    switch (action.type) {
      case 'roll':
        return p === null;
      case 'buy':
        return p?.kind === 'buy' && money >= priceOf(p.cell);
      case 'ride':
        return p?.kind === 'taxi' && money >= p.fare;
      case 'pass':
        return p !== null;
      case 'bail':
        return p === null && s.jail[seat] > 0 && money >= BAIL;
      case 'pardon':
        return p === null && s.jail[seat] > 0 && s.passes[seat] > 0;
      case 'build':
        return canManage(s) && canBuild(s, seat, action.cell);
      case 'sell':
        return canManage(s) && s.owner[action.cell] === seat && s.level[action.cell] > 0;
      case 'mortgage':
        return canManage(s) && canMortgage(s, seat, action.cell);
      case 'redeem':
        return canManage(s) && s.owner[action.cell] === seat && s.mortgaged[action.cell] && money >= redeemCost(action.cell);
      case 'offer':
        return p === null && canOffer(s, seat, action.cell) && money >= action.price;
      default:
        return false;
    }
  },

  apply(state, action, by) {
    const t = new Turn(state, state.players.indexOf(by));
    const s = t.s;
    const me = t.me;
    const pending = state.pending;
    switch (action.type) {
      case 'roll': {
        const [d1, d2] = t.dice();
        const sum = d1 + d2;
        if (s.jail[me] > 0) {
          if (d1 === d2) {
            s.jail[me] = 0;
            t.event({ t: 'free', how: 'doubles', amount: 0 });
          } else if (--s.jail[me] > 0) {
            t.event({ t: 'stay', tries: s.jail[me] });
            return t.finish(true);
          } else if (!t.pay(BAIL, null, (amount) => ({ t: 'free', how: 'forced', amount }))) {
            return t.finish(true);
          }
          t.go(sum, 'walk');
          return t.finish(true);
        }
        if (d1 === d2 && s.doubles < MAX_DOUBLES) {
          s.doubles++;
          s.again = true;
        }
        t.go(sum, 'walk');
        return t.finish(true);
      }
      case 'buy': {
        const { cell } = pending as { cell: number };
        s.money[me] -= priceOf(cell);
        s.owner[cell] = me;
        t.event({ t: 'buy', cell, price: priceOf(cell) });
        return t.finish(true);
      }
      case 'ride': {
        const { fare } = pending as { fare: number };
        if (fare > 0) {
          s.money[me] -= fare;
          t.event({ t: 'fare', amount: fare });
        }
        t.go(action.steps, 'taxi');
        return t.finish(true);
      }
      case 'pass':
        t.event({ t: 'pass', what: pending!.kind as 'buy' | 'taxi' });
        return t.finish(true);
      case 'bail':
        s.money[me] -= BAIL;
        s.jail[me] = 0;
        t.event({ t: 'free', how: 'bail', amount: BAIL });
        return t.finish(false);
      case 'pardon':
        s.passes[me]--;
        s.jail[me] = 0;
        t.event({ t: 'free', how: 'pass', amount: 0 });
        return t.finish(false);
      case 'build': {
        const cost = houseCost(action.cell);
        s.money[me] -= cost;
        t.event({ t: 'build', cell: action.cell, level: ++s.level[action.cell], cost });
        break;
      }
      case 'sell': {
        const amount = Math.floor(houseCost(action.cell) / 2);
        s.money[me] += amount;
        t.event({ t: 'sell', cell: action.cell, level: --s.level[action.cell], amount, forced: false });
        break;
      }
      case 'mortgage':
        s.mortgaged[action.cell] = true;
        s.money[me] += mortgageValue(action.cell);
        t.event({ t: 'mortgage', cell: action.cell, amount: mortgageValue(action.cell), forced: false });
        break;
      case 'redeem':
        s.mortgaged[action.cell] = false;
        s.money[me] -= redeemCost(action.cell);
        t.event({ t: 'redeem', cell: action.cell, amount: redeemCost(action.cell) });
        break;
      case 'offer': {
        const to = s.owner[action.cell]!;
        s.offers++;
        s.pending = { kind: 'offer', cell: action.cell, price: action.price, from: me, to };
        t.event({ t: 'offer', cell: action.cell, price: action.price, to });
        break;
      }
      case 'accept': {
        const { cell, price, from, to } = pending as Extract<Pending, { kind: 'offer' }>;
        s.money[from] -= price;
        s.money[to] += price;
        s.owner[cell] = from;
        t.event({ t: 'deal', cell, price, from: to, to: from });
        break;
      }
      case 'refuse':
        t.event({ t: 'refuse', cell: (pending as { cell: number }).cell, by: t.log.player });
        break;
      case 'cancel':
        t.event({ t: 'cancel', cell: (pending as { cell: number }).cell });
        break;
    }
    // Managing and trading leave a pending purchase where it was.
    if (pending?.kind === 'buy') s.pending = pending;
    return t.finish(false);
  },

  viewFor(state) {
    const { rng: _hidden, ...view } = state;
    return view;
  },

  bot: tsenaBot,

  result(state) {
    if (!state.over) return null;
    const left = alive(state);
    const worth = left.map((seat) => worthOf(state, seat));
    const best = Math.max(...worth);
    const winners = left.filter((_, i) => worth[i] === best).map((seat) => state.players[seat]);
    return winners.length === state.players.length ? { kind: 'draw' } : { kind: 'win', winners };
  },
};
