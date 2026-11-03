import { BOT_LEVELS, mulberry32, mulberryStep, type BotLevel } from '@game/core';
import { describe, expect, it } from 'vitest';
import {
  BAIL,
  canBuild,
  CARD_BONUS,
  CARD_CASH,
  CARD_GIFT,
  CARD_HELP,
  cellNamed,
  CELLS,
  DECKS,
  FESTIVAL_GIFT,
  houseCost,
  JAIL,
  JAIL_TRIES,
  LAND_TAX,
  MAX_OFFERS,
  MAX_ROUNDS,
  mortgageValue,
  REGIONS,
  redeemCost,
  rentAt,
  replayMs,
  SALARY,
  START_MONEY,
  TAXI_FARE,
  tsena,
  worthOf,
  type CardId,
  type Deck,
  type TsenaAction,
  type TsenaState,
  type TsenaView,
} from '.';

const P = ['a', 'b', 'c'];
type Draw = (x: number) => boolean;

const die = (d: number): Draw => (x) => 1 + Math.floor(x * 6) === d;
const card = (deck: Deck, id: CardId): Draw => (x) => {
  const cards = DECKS[deck];
  let y = x * cards.reduce((sum, c) => sum + c.weight, 0);
  return cards.find((c) => (y -= c.weight) < 0)?.id === id;
};

/** An rng state whose next draws pass these checks, in order. */
function rngWith(...draws: Draw[]): number {
  for (let seed = 0; seed < 5_000_000; seed++) {
    let state = seed;
    let ok = true;
    for (const draw of draws) {
      const [x, next] = mulberryStep(state);
      if (!draw(x)) {
        ok = false;
        break;
      }
      state = next;
    }
    if (ok) return seed;
  }
  throw new Error('no seed');
}

/** Player 0 to play from `pos`; the dice (then any card) are rigged. */
function at(pos: number, dice: [number, number], extra: Partial<TsenaState> = {}, ...more: Draw[]): TsenaState {
  const s = tsena.setup(P, 0);
  s.pos[0] = pos;
  return { ...s, turn: 0, first: 0, rng: rngWith(die(dice[0]), die(dice[1]), ...more), ...extra };
}

/** Gives `cells` to `seat`, built to `level`. */
function own(s: TsenaState, seat: number, cells: number[], level = 0): TsenaState {
  for (const cell of cells) {
    s.owner[cell] = seat;
    s.level[cell] = level;
  }
  return s;
}

const act = (s: TsenaState, action: TsenaAction, by = s.players[s.turn]) => {
  expect(tsena.validate(s, action, by)).toBe(true);
  return tsena.apply(s, action, by);
};
const roll = (s: TsenaState) => act(s, { type: 'roll' });
const kinds = (s: TsenaState) => s.last!.events.map((e) => e.t);
const view = (s: TsenaState): TsenaView => tsena.viewFor!(s, s.players[0]);

const ANTSIRABE = cellNamed('Antsirabe');
const TRITRIVA = cellNamed('Lac Tritriva');
const AMBOSITRA = cellNamed('Ambositra');
const ISALO = cellNamed('Isalo');
const ILAKAKA = cellNamed('Ilakaka');
const TOLIARA = cellNamed('Toliara');
const ROVA = cellNamed('Rova');

describe('tsena board', () => {
  it('runs 48 cells round the island, 31 sites in 11 regions of two or three', () => {
    expect(CELLS).toHaveLength(48);
    const sites = CELLS.filter((c) => c.kind === 'site');
    expect(sites).toHaveLength(31);
    REGIONS.forEach((_, r) => {
      const n = sites.filter((c) => c.region === r).length;
      expect(n === 2 || n === 3).toBe(true);
    });
    expect(CELLS.filter((c) => c.kind === 'taxi')).toHaveLength(4);
    expect(CELLS[JAIL].kind).toBe('jail');
    expect(new Set(sites.map((c) => c.name)).size).toBe(31);
  });

  it('starts everyone in Antananarivo with the same cash, and hides the dice', () => {
    const s = tsena.setup(P, 4);
    expect(s.money).toEqual([START_MONEY, START_MONEY, START_MONEY]);
    expect(s.pos).toEqual([0, 0, 0]);
    expect(s.turn).toBe(1);
    expect('rng' in tsena.viewFor!(s, 'a')).toBe(false);
  });
});

describe('tsena moves and sites', () => {
  it('walks the sum of two dice and offers a free site', () => {
    const s = roll(at(0, [1, 3]));
    expect(s.pos[0]).toBe(AMBOSITRA);
    expect(s.last!.events).toEqual([
      { t: 'dice', dice: [1, 3] },
      { t: 'move', path: [1, 2, 3, 4], via: 'walk' },
    ]);
    expect(s.pending).toEqual({ kind: 'buy', cell: AMBOSITRA });
    expect(s.turn).toBe(0);
  });

  it('buys, or passes and hands the dice on', () => {
    const bought = act(roll(at(0, [1, 3])), { type: 'buy' });
    expect(bought.owner[AMBOSITRA]).toBe(0);
    expect(bought.money[0]).toBe(START_MONEY - CELLS[AMBOSITRA].price!);
    expect(bought.turn).toBe(1);
    const passed = act(roll(at(0, [1, 3])), { type: 'pass' });
    expect(passed.owner[AMBOSITRA]).toBe(null);
    expect(passed.turn).toBe(1);
  });

  it('charges rent: doubled for a whole region, much more with houses, none when mortgaged', () => {
    const bare = roll(own(at(0, [1, 3]), 1, [AMBOSITRA]));
    const rent = rentAt(AMBOSITRA, 0, false);
    expect(bare.last!.events.at(-1)).toEqual({ t: 'rent', cell: AMBOSITRA, to: 1, amount: rent });
    expect(bare.money[0]).toBe(START_MONEY - rent);
    expect(bare.money[1]).toBe(START_MONEY + rent);

    const full = roll(own(at(0, [1, 3]), 1, [ANTSIRABE, TRITRIVA, AMBOSITRA]));
    expect(full.money[1]).toBe(START_MONEY + rent * 2);
    const built = roll(own(at(0, [1, 3]), 1, [AMBOSITRA], 2));
    expect(built.money[1]).toBe(START_MONEY + rentAt(AMBOSITRA, 2, false));
    expect(rentAt(AMBOSITRA, 2, false)).toBeGreaterThan(rent * 5);

    const s = own(at(0, [1, 3]), 1, [AMBOSITRA]);
    s.mortgaged[AMBOSITRA] = true;
    const free = roll(s);
    expect(free.money).toEqual([START_MONEY, START_MONEY, START_MONEY]);
    expect(kinds(free)).toEqual(['dice', 'move']);
  });

  it('pays the salary when passing Antananarivo', () => {
    const s = roll(at(45, [2, 3]));
    expect(s.pos[0]).toBe(TRITRIVA);
    expect(s.last!.events).toEqual([
      { t: 'dice', dice: [2, 3] },
      { t: 'move', path: [46, 47, 0], via: 'walk' },
      { t: 'salary', amount: SALARY },
      { t: 'move', path: [1, 2], via: 'walk' },
    ]);
    expect(s.money[0]).toBe(START_MONEY + SALARY);
  });

  it('plays again after a double, but not forever', () => {
    const s = act(roll(at(0, [2, 2])), { type: 'buy' });
    expect(s.turn).toBe(0);
    expect(kinds(s).at(-1)).toBe('again');
    expect(tsena.validate(s, { type: 'roll' }, 'a')).toBe(true);
    const third = act(roll(at(0, [2, 2], { doubles: 2 })), { type: 'buy' });
    expect(third.turn).toBe(1);
  });

  it('rides the taxi-brousse for a fare, up to six cells', () => {
    const s = roll(at(4, [1, 3]));
    expect(s.pending).toEqual({ kind: 'taxi', fare: TAXI_FARE });
    const rode = act(s, { type: 'ride', steps: 1 });
    expect(rode.pos[0]).toBe(ISALO);
    expect(rode.money[0]).toBe(START_MONEY - TAXI_FARE);
    expect(rode.pending).toEqual({ kind: 'buy', cell: ISALO });
    expect(act(s, { type: 'pass' }).pos[0]).toBe(8);
  });
});

describe('tsena buildings', () => {
  it('builds houses on most of a region, the hotel on all of it', () => {
    const s = own(at(0, [1, 3]), 0, [ANTSIRABE, TRITRIVA]);
    expect(canBuild(view(s), 0, ANTSIRABE)).toBe(true);
    expect(canBuild(view(own(at(0, [1, 3]), 0, [ANTSIRABE])), 0, ANTSIRABE)).toBe(false);
    // A two-site region needs both.
    expect(canBuild(view(own(at(0, [1, 3]), 0, [ISALO])), 0, ISALO)).toBe(false);
    expect(canBuild(view(own(at(0, [1, 3]), 0, [ISALO, ILAKAKA])), 0, ISALO)).toBe(true);

    const built = act(s, { type: 'build', cell: ANTSIRABE });
    expect(built.level[ANTSIRABE]).toBe(1);
    expect(built.money[0]).toBe(START_MONEY - houseCost(ANTSIRABE));
    expect(built.turn).toBe(0);
    expect(built.pending).toBe(null);

    const three = own(at(0, [1, 3]), 0, [ANTSIRABE, TRITRIVA], 3);
    expect(tsena.validate(three, { type: 'build', cell: ANTSIRABE }, 'a')).toBe(false);
    const hotel = act(own(three, 0, [AMBOSITRA]), { type: 'build', cell: ANTSIRABE });
    expect(hotel.level[ANTSIRABE]).toBe(4);
    expect(tsena.validate(hotel, { type: 'build', cell: ANTSIRABE }, 'a')).toBe(false);
  });

  it('sells houses back at half price, mortgages bare sites and redeems them', () => {
    const s = own(at(0, [1, 3]), 0, [ANTSIRABE, TRITRIVA], 1);
    const sold = act(s, { type: 'sell', cell: ANTSIRABE });
    expect(sold.level[ANTSIRABE]).toBe(0);
    expect(sold.money[0]).toBe(START_MONEY + houseCost(ANTSIRABE) / 2);
    expect(tsena.validate(s, { type: 'mortgage', cell: ANTSIRABE }, 'a')).toBe(false);

    const mortgaged = act(sold, { type: 'mortgage', cell: ANTSIRABE });
    expect(mortgaged.mortgaged[ANTSIRABE]).toBe(true);
    expect(mortgaged.money[0]).toBe(sold.money[0] + mortgageValue(ANTSIRABE));
    expect(tsena.validate(mortgaged, { type: 'build', cell: ANTSIRABE }, 'a')).toBe(false);
    const redeemed = act(mortgaged, { type: 'redeem', cell: ANTSIRABE });
    expect(redeemed.mortgaged[ANTSIRABE]).toBe(false);
    expect(redeemed.money[0]).toBe(mortgaged.money[0] - redeemCost(ANTSIRABE));
  });

  it('lets a player mortgage to afford a purchase', () => {
    const s = roll(own(at(0, [1, 3], { money: [50, START_MONEY, START_MONEY] }), 0, [ROVA]));
    expect(s.pending).toEqual({ kind: 'buy', cell: AMBOSITRA });
    expect(tsena.validate(s, { type: 'buy' }, 'a')).toBe(false);
    const raised = act(s, { type: 'mortgage', cell: ROVA });
    expect(raised.pending).toEqual({ kind: 'buy', cell: AMBOSITRA });
    expect(act(raised, { type: 'buy' }).owner[AMBOSITRA]).toBe(0);
  });

  it('the cyclone knocks a level off the tallest building', () => {
    const s = roll(own(own(at(19, [1, 2]), 0, [ANTSIRABE, TRITRIVA], 1), 0, [ROVA], 3));
    expect(s.last!.events.at(-1)).toEqual({ t: 'cyclone', cell: ROVA, level: 2 });
    expect(roll(at(19, [1, 2])).last!.events.at(-1)).toEqual({ t: 'cyclone', cell: null, level: 0 });
  });
});

describe('tsena fonja', () => {
  it('the roadblock sends a pawn to the fonja, with no salary and no replay', () => {
    const s = roll(at(35, [1, 1]));
    expect(s.pos[0]).toBe(JAIL);
    expect(s.jail[0]).toBe(JAIL_TRIES);
    expect(s.last!.events.slice(-2)).toEqual([{ t: 'move', path: [JAIL], via: 'jail' }, { t: 'jail' }]);
    expect(s.money[0]).toBe(START_MONEY);
    expect(s.turn).toBe(1);
  });

  it('a double gets out; otherwise the pawn stays, then pays the bail', () => {
    const stay = roll(at(JAIL, [1, 2], { jail: [2, 0, 0] }));
    expect(stay.pos[0]).toBe(JAIL);
    expect(stay.last!.events.at(-1)).toEqual({ t: 'stay', tries: 1 });
    expect(stay.turn).toBe(1);

    const out = roll(at(JAIL, [3, 3], { jail: [2, 0, 0] }));
    expect(out.jail[0]).toBe(0);
    expect(out.pos[0]).toBe(TOLIARA);
    expect(out.last!.events[1]).toEqual({ t: 'free', how: 'doubles', amount: 0 });
    expect(out.again).toBe(false);

    const forced = roll(at(JAIL, [1, 2], { jail: [1, 0, 0] }));
    expect(forced.jail[0]).toBe(0);
    expect(forced.pos[0]).toBe(JAIL + 3);
    expect(forced.money[0]).toBe(START_MONEY - BAIL);
  });

  it('pays the bail or plays a laissez-passer, then rolls', () => {
    const s = at(JAIL, [1, 2], { jail: [2, 0, 0], passes: [1, 0, 0] });
    const bailed = act(s, { type: 'bail' });
    expect(bailed.jail[0]).toBe(0);
    expect(bailed.money[0]).toBe(START_MONEY - BAIL);
    expect(roll(bailed).pos[0]).toBe(JAIL + 3);
    const pardoned = act(s, { type: 'pardon' });
    expect(pardoned.passes[0]).toBe(0);
    expect(pardoned.money[0]).toBe(START_MONEY);
    expect(tsena.validate(at(JAIL, [1, 2]), { type: 'bail' }, 'a')).toBe(false);
    expect(tsena.validate(at(JAIL, [1, 2], { jail: [2, 0, 0] }), { type: 'pardon' }, 'a')).toBe(false);
  });
});

describe('tsena taxes and cards', () => {
  it('Hetra takes a tenth of the cash, the land tax counts sites and buildings', () => {
    const tax = roll(at(11, [1, 2]));
    expect(tax.last!.events.at(-1)).toEqual({ t: 'tax', kind: 'tax', amount: START_MONEY / 10 });
    const s = own(own(own(at(33, [1, 2]), 0, [ANTSIRABE]), 0, [TRITRIVA], 2), 0, [AMBOSITRA], 4);
    const land = roll(s);
    expect(land.last!.events.at(-1)).toEqual({ t: 'tax', kind: 'landtax', amount: 3 * LAND_TAX.site + 2 * LAND_TAX.house + LAND_TAX.hotel });
  });

  it('the hira gasy collects from every other player', () => {
    const s = roll(at(25, [1, 2]));
    expect(s.money).toEqual([START_MONEY + 2 * FESTIVAL_GIFT, START_MONEY - FESTIVAL_GIFT, START_MONEY - FESTIVAL_GIFT]);
  });

  /** Player 0 on a card cell, having drawn `id`. */
  const draw = (deck: Deck, id: CardId, extra: Partial<TsenaState> = {}) =>
    roll(deck === 'vintana' ? at(8, [1, 2], extra, card(deck, id)) : at(0, [1, 2], extra, card(deck, id)));

  it('plays every Vintana card', () => {
    const from = 11;
    const end = (id: CardId, extra?: Partial<TsenaState>) => draw('vintana', id, extra);
    expect(end('wind').pos[0]).toBe(from + 3);
    expect(end('flood').pos[0]).toBe(from - 3);
    expect(end('flood').pending).toBe(null);
    const tana = end('tana');
    expect(tana.pos[0]).toBe(0);
    expect(tana.money[0]).toBe(START_MONEY + SALARY);
    expect(end('taxi').pending).toEqual({ kind: 'taxi', fare: 0 });
    expect(end('taxi').pos[0]).toBe(20);
    expect(end('rova').pending).toEqual({ kind: 'buy', cell: ROVA });
    expect(end('whales').pos[0]).toBe(cellNamed('Nosy Boraha'));
    expect(end('tsingy').pos[0]).toBe(cellNamed('Tsingy de Bemaraha'));
    expect(end('roadblock').pos[0]).toBe(JAIL);
    expect(end('roadblock').jail[0]).toBe(JAIL_TRIES);
    expect(end('pass').passes[0]).toBe(1);
    expect(end('pothole').money[0]).toBe(START_MONEY + CARD_CASH.pothole!);
    expect(end('savika').money[0]).toBe(START_MONEY + CARD_CASH.savika!);
    const rains = own(own(at(8, [1, 2], {}, card('vintana', 'rains')), 0, [ANTSIRABE], 2), 0, [ROVA], 4);
    expect(roll(rains).money[0]).toBe(START_MONEY - 2 * 25 - 100);
  });

  it('plays every Fihavanana card', () => {
    const cash = (id: CardId) => draw('fihavanana', id).money;
    for (const id of ['vanilla', 'doctor', 'school', 'inheritance', 'kabary', 'rice', 'market'] as CardId[]) {
      expect(cash(id)[0]).toBe(START_MONEY + CARD_CASH[id]!);
    }
    expect(cash('wedding')).toEqual([START_MONEY + 2 * CARD_GIFT, START_MONEY - CARD_GIFT, START_MONEY - CARD_GIFT]);
    expect(cash('lemur')).toEqual([START_MONEY - 2 * CARD_GIFT, START_MONEY + CARD_GIFT, START_MONEY + CARD_GIFT]);
    expect(cash('independence')).toEqual(P.map(() => START_MONEY + CARD_BONUS));
    expect(draw('fihavanana', 'lawyer').passes[0]).toBe(1);
    const unequal = { money: [START_MONEY, 500, 3000] };
    expect(draw('fihavanana', 'solidarity', unequal).money).toEqual([START_MONEY - CARD_HELP, 500 + CARD_HELP, 3000]);
    expect(draw('fihavanana', 'family', unequal).money).toEqual([START_MONEY + CARD_HELP, 500, 3000 - CARD_HELP]);
  });
});

describe('tsena offers', () => {
  const offering = () => own(at(0, [1, 3]), 1, [TOLIARA]);

  it('asks the owner, who accepts or refuses', () => {
    const s = act(offering(), { type: 'offer', cell: TOLIARA, price: 300 });
    expect(s.pending).toEqual({ kind: 'offer', cell: TOLIARA, price: 300, from: 0, to: 1 });
    expect(tsena.validate(s, { type: 'roll' }, 'a')).toBe(false);
    expect(tsena.validate(s, { type: 'accept' }, 'a')).toBe(false);
    expect(tsena.validate(s, { type: 'accept' }, 'c')).toBe(false);

    const deal = act(s, { type: 'accept' }, 'b');
    expect(deal.owner[TOLIARA]).toBe(0);
    expect(deal.money).toEqual([START_MONEY - 300, START_MONEY + 300, START_MONEY]);
    expect(deal.last).toMatchObject({ player: 1, events: [{ t: 'deal', cell: TOLIARA, price: 300, from: 1, to: 0 }] });
    expect(deal.turn).toBe(0);
    expect(tsena.validate(deal, { type: 'roll' }, 'a')).toBe(true);

    const refused = act(s, { type: 'refuse' }, 'b');
    expect(refused.owner[TOLIARA]).toBe(1);
    expect(refused.pending).toBe(null);
    expect(act(s, { type: 'cancel' }, 'a').pending).toBe(null);
  });

  it('only for bare sites of others, within the cash, a few times a turn', () => {
    const s = offering();
    expect(tsena.validate(s, { type: 'offer', cell: TOLIARA, price: START_MONEY + 10 }, 'a')).toBe(false);
    expect(tsena.validate(s, { type: 'offer', cell: TOLIARA, price: 305 }, 'a')).toBe(false);
    expect(tsena.validate(s, { type: 'offer', cell: AMBOSITRA, price: 300 }, 'a')).toBe(false);
    expect(tsena.validate(own(offering(), 1, [TOLIARA], 1), { type: 'offer', cell: TOLIARA, price: 300 }, 'a')).toBe(false);
    expect(tsena.validate({ ...s, offers: MAX_OFFERS }, { type: 'offer', cell: TOLIARA, price: 300 }, 'a')).toBe(false);
    expect(tsena.validate(s, { type: 'offer', cell: TOLIARA, price: 300 }, 'b')).toBe(false);
  });
});

describe('tsena end', () => {
  it('raises money by selling houses then mortgaging; short even then, the player is out', () => {
    const s = own(own(at(44, [1, 2], { money: [10, START_MONEY, START_MONEY] }), 0, [ANTSIRABE, TRITRIVA], 1), 1, [ROVA], 4);
    const after = roll(s);
    expect(kinds(after)).toEqual(['dice', 'move', 'sell', 'sell', 'mortgage', 'mortgage', 'rent', 'bankrupt']);
    expect(after.out[0]).toBe(true);
    expect(after.owner[ANTSIRABE]).toBe(null);
    expect(after.level[ANTSIRABE]).toBe(0);
    expect(after.mortgaged[ANTSIRABE]).toBe(false);
    const raised = 10 + houseCost(ANTSIRABE) / 2 + houseCost(TRITRIVA) / 2 + mortgageValue(ANTSIRABE) + mortgageValue(TRITRIVA);
    expect(after.money[1]).toBe(START_MONEY + raised);
    // Three players: the game goes on without them.
    expect(after.over).toBe(false);
    expect(after.turn).toBe(1);
    expect(tsena.validate(after, { type: 'roll' }, 'a')).toBe(false);
  });

  it('ends when one player is left', () => {
    const s = tsena.setup(['a', 'b'], 0);
    const last = roll({ ...own(s, 1, [ROVA], 4), pos: [44, 0], money: [10, START_MONEY], turn: 0, rng: rngWith(die(1), die(2)) });
    expect(last.over).toBe(true);
    expect(tsena.result(last)).toEqual({ kind: 'win', winners: ['b'] });
  });

  it('ends after the last round: the richest wins, a tie is a draw', () => {
    const s = at(0, [1, 3], { round: 3, rounds: 3, first: 1 });
    const end = act(roll(s), { type: 'pass' });
    expect(end.over).toBe(true);
    expect(tsena.result(end)).toEqual({ kind: 'draw' });
    const richer = own({ ...end, owner: end.owner.slice(), level: end.level.slice() }, 2, [ROVA], 1);
    expect(worthOf(richer, 2)).toBe(START_MONEY + CELLS[ROVA].price! + houseCost(ROVA));
    expect(tsena.result(richer)).toEqual({ kind: 'win', winners: ['c'] });
  });

  it('refuses moves out of turn, malformed, out of phase or after the end', () => {
    const s = at(0, [1, 2]);
    expect(tsena.validate(s, { type: 'roll' }, 'b')).toBe(false);
    expect(tsena.validate(s, { type: 'buy' }, 'a')).toBe(false);
    expect(tsena.validate(s, { type: 'pass' }, 'a')).toBe(false);
    expect(tsena.validate(s, { type: 'dance' }, 'a')).toBe(false);
    expect(tsena.validate(s, null, 'a')).toBe(false);
    expect(tsena.validate(s, { type: 'build', cell: 99 }, 'a')).toBe(false);
    expect(tsena.validate(s, { type: 'offer', cell: TOLIARA, price: '300' }, 'a')).toBe(false);
    const taxi = roll(at(4, [1, 3]));
    expect(tsena.validate(taxi, { type: 'roll' }, 'a')).toBe(false);
    expect(tsena.validate(taxi, { type: 'build', cell: ANTSIRABE }, 'a')).toBe(false);
    for (const steps of [0, 7, 1.5, '2', undefined]) expect(tsena.validate(taxi, { type: 'ride', steps }, 'a')).toBe(false);
    expect(tsena.validate({ ...s, over: true }, { type: 'roll' }, 'a')).toBe(false);
  });

  it('never mutates the state it is given', () => {
    const s = own(at(0, [1, 3]), 1, [AMBOSITRA], 1);
    const copy = structuredClone(s);
    roll(s);
    act(own(at(0, [1, 3]), 0, [ANTSIRABE, TRITRIVA]), { type: 'build', cell: ANTSIRABE });
    expect(s).toEqual(copy);
  });

  it('paces bots on the length of the last replay', () => {
    const s = roll(at(0, [3, 4]));
    const delay = (tsena.botDelayMs as (s: TsenaState) => [number, number])(s);
    expect(delay[0]).toBeGreaterThan(replayMs(s.last));
  });
});

describe('tsena end modes', () => {
  it('defaults to a round limit, scaled to the number of players', () => {
    expect(tsena.setup(['a', 'b'], 0).rounds).toBe(32);
    expect(tsena.setup(['a', 'b', 'c', 'd'], 0, { mode: 'turns', turns: '20' }).rounds).toBe(5);
    expect(tsena.setup(['a', 'b'], 0, { mode: 'turns', turns: '20' }).rounds).toBe(10);
    // Unknown values fall back to the defaults.
    expect(tsena.setup(['a', 'b'], 0, { mode: 'chess', turns: '7' })).toMatchObject({ ending: { mode: 'turns' }, rounds: 32 });
  });

  it('time: the clock marks the limit, the game ends with the round in progress', () => {
    const s = { ...at(0, [1, 3]), ...tsena.setup(P, 0, { mode: 'time', minutes: '15' }), pos: [0, 0, 0], turn: 0, first: 0, rng: at(0, [1, 3]).rng };
    expect(s.rounds).toBe(MAX_ROUNDS);
    expect(tsena.clock!(s, 59_000)).toBe(s);
    expect(tsena.clock!(s, 61_000)).toMatchObject({ minutes: 1, timeUp: false });
    const late = tsena.clock!(s, 15 * 60_000);
    expect(late.timeUp).toBe(true);
    // Player 0 opens the round: it goes on…
    const after = act(roll(late), { type: 'pass' });
    expect(after.over).toBe(false);
    // …until the dice come back to the first seat.
    const last = { ...after, turn: 2, rng: rngWith(die(1), die(3)) };
    expect(act(roll(last), { type: 'pass' }).over).toBe(true);
  });

  it('bankruptcy: no round limit but the safety cap', () => {
    expect(tsena.setup(P, 0, { mode: 'bankrupt' }).rounds).toBe(MAX_ROUNDS);
  });

  it('target: the first fortune to reach the sum wins at once', () => {
    const s = { ...tsena.setup(P, 0, { mode: 'target', target: 'small' }), turn: 0, first: 0, rng: rngWith(die(1), die(3)) };
    expect(s.ending.target).toBe(3500);
    expect(tsena.setup(['a', 'b'], 0, { mode: 'target', target: 'large' }).ending.target).toBe(3600);
    // Player 1's fortune: 3 390 Ar and Ambositra (100 Ar), 10 Ar short.
    s.money = [START_MONEY, 3390, START_MONEY];
    own(s, 1, [AMBOSITRA]);
    // Player 0 pays rent to player 1, whose fortune crosses the target.
    const end = roll(s);
    expect(end.over).toBe(true);
    expect(tsena.result(end)).toEqual({ kind: 'win', winners: ['b'] });
  });
});

describe('tsena bots', () => {
  /** Whoever has to act: the offer's addressee, else the current player. */
  const actor = (s: TsenaState) => (s.pending?.kind === 'offer' ? s.players[s.pending.to] : s.players[s.turn]);
  const bot = (s: TsenaState, level: BotLevel, by = actor(s)) => tsena.bot!(tsena.viewFor!(s, by), by, level, mulberry32(1));

  /** A whole game between the given levels; returns the final state. */
  function play(levels: BotLevel[], seed: number, options = {}): TsenaState {
    const rand = mulberry32(seed);
    const players = levels.map((_, i) => `p${i}`);
    let s = tsena.setup(players, seed, options);
    for (let n = 0; !tsena.result(s); n++) {
      if (n > 3000) throw new Error('game never ends');
      const by = actor(s);
      for (const other of players) if (other !== by) expect(tsena.bot!(tsena.viewFor!(s, other), other, 'hard', rand)).toBeNull();
      const action = tsena.bot!(tsena.viewFor!(s, by), by, levels[players.indexOf(by)], rand)!;
      expect(tsena.validate(s, action, by)).toBe(true);
      s = tsena.apply(s, action, by);
    }
    return s;
  }

  it('plays legal moves to the end at every level', () => {
    for (const level of BOT_LEVELS) for (let seed = 0; seed < 3; seed++) play([level, level], seed);
    for (let seed = 0; seed < 3; seed++) play(['hard', 'medium', 'easy', 'hard'], seed);
  });

  it('finishes a game in every end mode', () => {
    for (const options of [{ mode: 'bankrupt' }, { mode: 'target', target: 'medium' }, { mode: 'turns', turns: '20' }]) {
      for (let seed = 0; seed < 3; seed++) expect(tsena.result(play(['hard', 'medium'], seed, options))).not.toBeNull();
    }
  });

  it('hard grabs the site that lets it build, even short of cash', () => {
    const s = roll(own(at(0, [1, 3], { money: [200, START_MONEY, START_MONEY] }), 0, [ANTSIRABE]));
    expect(s.pending).toEqual({ kind: 'buy', cell: AMBOSITRA });
    expect(bot(s, 'hard')).toEqual({ type: 'buy' });
    expect(bot(s, 'medium')).toEqual({ type: 'pass' });
  });

  it('hard builds once it holds a region', () => {
    const s = own(at(0, [1, 3]), 0, [ANTSIRABE, TRITRIVA]);
    expect(bot(s, 'hard')).toMatchObject({ type: 'build' });
  });

  it('hard won’t sell the site that completes a rival’s region on the cheap', () => {
    const s = act(own(own(at(0, [1, 3]), 0, [ANTSIRABE, TRITRIVA]), 1, [AMBOSITRA]), { type: 'offer', cell: AMBOSITRA, price: 150 });
    expect(bot(s, 'hard')).toEqual({ type: 'refuse' });
    const rich = act(own(own(at(0, [1, 3]), 0, [ANTSIRABE, TRITRIVA]), 1, [AMBOSITRA]), { type: 'offer', cell: AMBOSITRA, price: 300 });
    expect(bot(rich, 'hard')).toEqual({ type: 'accept' });
  });

  it('medium and hard ride the taxi away from a big rent', () => {
    const s = own(roll(at(4, [1, 3])), 1, [ISALO, ILAKAKA], 3);
    expect(s.pending?.kind).toBe('taxi');
    expect(bot(s, 'medium')).not.toEqual({ type: 'ride', steps: 1 });
    expect(bot(s, 'hard')).not.toEqual({ type: 'ride', steps: 1 });
  });

  it('hard beats easy more often than not', () => {
    let hard = 0;
    const games = 400;
    for (let seed = 0; seed < games; seed++) {
      const levels: BotLevel[] = seed % 2 ? ['hard', 'easy'] : ['easy', 'hard'];
      const r = tsena.result(play(levels, seed))!;
      if (r.kind === 'win' && r.winners.length === 1 && levels[Number(r.winners[0].slice(1))] === 'hard') hard++;
    }
    expect(hard / games).toBeGreaterThan(0.55);
  });
});
