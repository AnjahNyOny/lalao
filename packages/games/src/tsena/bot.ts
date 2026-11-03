import type { BotLevel, PlayerId } from '@game/core';
import { alive, canBuild, canOffer, progressOf, rentOf, type Pending, type TsenaAction, type TsenaView } from '.';
import {
  BAIL,
  CELL_COUNT,
  CELLS,
  FESTIVAL_GIFT,
  fullRegion,
  houseCost,
  majority,
  MAX_LEVEL,
  priceOf,
  redeemCost,
  regionOf,
  SALARY,
  TAX_RATE,
  TAXI_RANGE,
} from './board';

/** Medium keeps this much cash in hand, whatever lies ahead. */
const MEDIUM_RESERVE = 150;

/** Worst rent waiting on the cells one roll ahead (2 to 12). */
function dangerAhead(s: TsenaView, seat: number, from = s.pos[seat]): number {
  let worst = 0;
  for (let d = 2; d <= 12; d++) {
    const cell = (from + d) % CELL_COUNT;
    const owner = s.owner[cell];
    if (owner !== null && owner !== seat) worst = Math.max(worst, rentOf(s, cell));
  }
  return worst;
}

/** Cash hard keeps in hand: enough for the worst rent ahead, more as the board fills up. */
const hardReserve = (s: TsenaView, seat: number) => Math.max(120, dangerAhead(s, seat) * 0.8);

/** Share of the game still to play, from 1 down to 0. */
const leftOf = (s: TsenaView) => 1 - progressOf(s);

/** The other sites of the cell's region, by owner. */
const regionOwners = (s: TsenaView, cell: number) => regionOf(cell).filter((i) => i !== cell).map((i) => s.owner[i]);
const completes = (s: TsenaView, seat: number, cell: number) => regionOwners(s, cell).every((o) => o === seat);
const blocks = (s: TsenaView, seat: number, cell: number) => regionOwners(s, cell).some((o) => o !== null && o !== seat);
/** Owning the cell would let `seat` build in its region. */
function unlocks(s: TsenaView, seat: number, cell: number): boolean {
  const owner = s.owner.slice();
  owner[cell] = seat;
  return majority(owner, cell);
}

function wantsBuy(s: TsenaView, seat: number, cell: number, level: BotLevel, rand: () => number): boolean {
  const left = s.money[seat] - priceOf(cell);
  if (left < 0) return false;
  if (level === 'easy') return rand() < 0.5;
  if (level === 'medium') return left >= MEDIUM_RESERVE;
  // Sites earn rent and keep their value: buy whenever the cash left covers what lies ahead.
  const danger = dangerAhead(s, seat);
  if (unlocks(s, seat, cell) || blocks(s, seat, cell)) return left >= danger * 0.4;
  return left >= Math.max(60, danger * 0.7);
}

/** Next house to build: on the lowest site of a full region, the dearest region first. */
function pickBuild(s: TsenaView, seat: number, level: BotLevel, rand: () => number): number | null {
  const cells = s.owner.flatMap((o, cell) => (o === seat && canBuild(s, seat, cell) ? [cell] : []));
  if (!cells.length) return null;
  if (level === 'easy') return rand() < 0.3 ? cells[Math.floor(rand() * cells.length)] : null;
  // Build evenly: never two houses ahead on one of its own sites of a region.
  const even = cells.filter((c) => regionOf(c).every((i) => s.owner[i] !== seat || s.mortgaged[i] || s.level[c] <= s.level[i]));
  const best = (even.length ? even : cells).sort((a, b) => s.level[a] - s.level[b] || priceOf(b) - priceOf(a))[0];
  // Near the end a house can't pay for itself: hard keeps its cash for the rents to come.
  const reserve = level === 'medium' ? MEDIUM_RESERVE + 100 : hardReserve(s, seat) * (leftOf(s) < 0.1 ? 3 : 1);
  return s.money[seat] - houseCost(best) >= reserve ? best : null;
}

/** A site that earns little on its own: none of its region's building rights depend on it. */
function pickLoose(s: TsenaView, seat: number): number | null {
  const cell = s.owner
    .flatMap((o, c) => (o === seat && !s.mortgaged[c] && s.level[c] === 0 && !majority(s.owner, c) ? [c] : []))
    .sort((a, b) => priceOf(a) - priceOf(b))[0];
  return cell ?? null;
}

/** Hard, early on, mortgages loose sites to pay for houses where it holds a region. */
function pickFunding(s: TsenaView, seat: number, level: BotLevel): number | null {
  if (level !== 'hard' || leftOf(s) < 0.4) return null;
  const wanted = s.owner.some(
    (o, c) => o === seat && !s.mortgaged[c] && s.level[c] < MAX_LEVEL - 1 && majority(s.owner, c) && s.money[seat] < houseCost(c) + hardReserve(s, seat),
  );
  return wanted ? pickLoose(s, seat) : null;
}

/** A mortgaged site worth taking back, once there is cash to spare and nothing to build. */
function pickRedeem(s: TsenaView, seat: number, level: BotLevel): number | null {
  if (level === 'easy') return null;
  if (s.owner.some((o, c) => o === seat && !s.mortgaged[c] && s.level[c] < MAX_LEVEL && majority(s.owner, c))) return null;
  const reserve = (level === 'medium' ? MEDIUM_RESERVE : hardReserve(s, seat)) + 300;
  const cell = s.owner
    .flatMap((o, c) => (o === seat && s.mortgaged[c] ? [c] : []))
    // Sites of a full region first: their rent is worth most.
    .sort((a, b) => Number(fullRegion(s.owner, b)) - Number(fullRegion(s.owner, a)) || priceOf(b) - priceOf(a))[0];
  return cell !== undefined && s.money[seat] - redeemCost(cell) >= reserve ? cell : null;
}

/**
 * Medium and hard try, now and then, to buy the site that lets them build:
 * half as much again as its price, twice for hard when it completes a region.
 */
function pickOffer(s: TsenaView, seat: number, level: BotLevel): { cell: number; price: number } | null {
  // One offer every third round at most: a refused offer won't be accepted next turn either.
  if (level === 'easy' || s.offers > 0 || (s.round + seat) % 3 !== 0) return null;
  // Paying over the odds only makes sense with time left to collect the rents.
  if (level === 'hard' && leftOf(s) < 0.35) return null;
  const reserve = level === 'medium' ? MEDIUM_RESERVE : hardReserve(s, seat);
  let best: { cell: number; price: number; gain: number } | null = null;
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (!canOffer(s, seat, cell)) continue;
    const full = completes(s, seat, cell);
    if (!full && !(unlocks(s, seat, cell) && !majority(s.owner, cell))) continue;
    const factor = level === 'hard' && full ? 2 : 1.5;
    const price = Math.round((priceOf(cell) * factor) / 10) * 10;
    const gain = priceOf(cell) * (full ? 2 : 1);
    if (s.money[seat] - price >= reserve + 100 && (!best || gain > best.gain)) best = { cell, price, gain };
  }
  return best && { cell: best.cell, price: best.price };
}

/** As the owner: sell only for a price that makes up for what the buyer gains. */
function acceptsOffer(s: TsenaView, seat: number, p: Extract<Pending, { kind: 'offer' }>, level: BotLevel, rand: () => number): boolean {
  const ratio = p.price / priceOf(p.cell);
  if (level === 'easy') return ratio >= 1.5 || (ratio >= 1 && rand() < 0.5);
  const broke = s.money[seat] < 100;
  // Late in the game the buyer can't earn the premium back: take the money.
  if (level === 'hard' && leftOf(s) < 0.25 && !majority(s.owner, p.cell)) return ratio >= 1.2;
  // Never cheap when it breaks one of our own building rights.
  if (majority(s.owner, p.cell)) return ratio >= 3 || (broke && ratio >= 2);
  if (completes(s, p.from, p.cell)) return ratio >= (level === 'hard' ? 2.4 : 2) || (broke && ratio >= 1.5);
  if (unlocks(s, p.from, p.cell)) return ratio >= (level === 'hard' ? 1.8 : 1.5) || (broke && ratio >= 1.2);
  return ratio >= (broke ? 1 : level === 'hard' ? 1.4 : 1.3);
}

/** Rough worth of stopping on a cell, in ariary. */
function cellValue(s: TsenaView, seat: number, cell: number, level: BotLevel): number {
  const c = CELLS[cell];
  const money = s.money[seat];
  switch (c.kind) {
    case 'site': {
      const owner = s.owner[cell];
      if (owner === null) {
        if (money < c.price!) return 0;
        return level === 'hard' ? c.price! * 0.3 + (completes(s, seat, cell) ? 120 : 0) : 40;
      }
      return owner === seat ? 0 : -rentOf(s, cell);
    }
    case 'festival':
      return FESTIVAL_GIFT * (alive(s).length - 1);
    case 'tax':
      return level === 'hard' ? -money * TAX_RATE : 0;
    case 'vintana':
    case 'fihavanana':
      return level === 'hard' ? 10 : 0;
    case 'roadblock':
      return level === 'hard' ? -120 : 0;
    case 'cyclone':
      return level === 'hard' && s.owner.some((o, i) => o === seat && s.level[i] > 0) ? -150 : 0;
    default:
      return 0;
  }
}

/** Taxi-brousse: the best hop ahead, or 0 to stay put. */
function pickRide(s: TsenaView, seat: number, fare: number, level: BotLevel, rand: () => number): number {
  if (level === 'easy') return rand() < 0.5 ? 0 : 1 + Math.floor(rand() * TAXI_RANGE);
  let best = 0;
  let bestValue = fare;
  for (let steps = 1; steps <= TAXI_RANGE; steps++) {
    const cell = (s.pos[seat] + steps) % CELL_COUNT;
    const salary = s.pos[seat] + steps >= CELL_COUNT ? SALARY : 0;
    const value = cellValue(s, seat, cell, level) + salary;
    if (value > bestValue) [best, bestValue] = [steps, value];
  }
  return best;
}

/** In the fonja: leave early while there are sites to buy, sit tight once the board is dangerous. */
function jailMove(s: TsenaView, seat: number, level: BotLevel, rand: () => number): TsenaAction | null {
  const free = s.owner.filter((o, cell) => o === null && CELLS[cell].kind === 'site').length;
  const leave = level === 'easy' ? rand() < 0.5 : level === 'medium' ? free > 8 : free > 6 && dangerAhead(s, seat) < 300;
  if (!leave) return null;
  if (s.passes[seat] > 0) return { type: 'pardon' };
  return s.money[seat] - BAIL >= (level === 'hard' ? hardReserve(s, seat) : MEDIUM_RESERVE) ? { type: 'bail' } : null;
}

/**
 * Easy buys on a whim and seldom builds. Medium keeps a fixed reserve, builds
 * evenly and asks one and a half times the price for a missing site. Hard
 * weighs the rents one roll ahead, chases and blocks regions, pays double for
 * the last site of a region and never sells one that completes a rival's.
 */
export function tsenaBot(s: TsenaView, me: PlayerId, level: BotLevel, rand: () => number): TsenaAction | null {
  if (s.over) return null;
  const seat = s.players.indexOf(me);
  if (seat < 0 || s.out[seat]) return null;
  const p = s.pending;
  if (p?.kind === 'offer') return seat === p.to ? { type: acceptsOffer(s, seat, p, level, rand) ? 'accept' : 'refuse' } : null;
  if (seat !== s.turn) return null;
  if (p?.kind === 'buy') return { type: wantsBuy(s, seat, p.cell, level, rand) ? 'buy' : 'pass' };
  if (p?.kind === 'taxi') {
    const steps = pickRide(s, seat, p.fare, level, rand);
    return steps ? { type: 'ride', steps } : { type: 'pass' };
  }
  // Before rolling: take a site back, build, make an offer, get out of the fonja.
  const redeem = pickRedeem(s, seat, level);
  if (redeem !== null) return { type: 'redeem', cell: redeem };
  const build = pickBuild(s, seat, level, rand);
  if (build !== null) return { type: 'build', cell: build };
  const offer = pickOffer(s, seat, level);
  if (offer) return { type: 'offer', ...offer };
  const funding = pickFunding(s, seat, level);
  if (funding !== null) return { type: 'mortgage', cell: funding };
  if (s.jail[seat] > 0) return jailMove(s, seat, level, rand) ?? { type: 'roll' };
  return { type: 'roll' };
}
