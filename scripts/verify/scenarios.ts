import type { PlayerId } from '@game/core';
import { COLS, dropRow, type Connect4State } from '@game/games/connect4';
import type { SnakesState } from '@game/games/snakes';
import { BAIL, canBuild, canOffer, priceOf, TAXI_RANGE, type TsenaView } from '@game/games/tsena';

/**
 * How verify plays each game: given a player's view, return a legal action,
 * or null when it isn't that player's turn. Random legal moves are enough to
 * reach the end of a game.
 */
export type Chooser = (view: unknown, me: PlayerId) => unknown | null;

const pick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

export const scenarios: Record<string, Chooser> = {
  connect4: (view, me) => {
    const s = view as Connect4State;
    if (s.winner !== null || s.players[s.turn] !== me) return null;
    const cols = Array.from({ length: COLS }, (_, c) => c).filter((c) => dropRow(s.board, c) >= 0);
    return { col: pick(cols) };
  },

  snakes: (view, me) => {
    const s = view as SnakesState;
    if (s.winner !== null || s.players[s.turn] !== me) return null;
    if (!s.pending) return { type: 'roll' };
    return { type: pick(['erase', 'slide']) };
  },

  tsena: (view, me) => {
    const s = view as TsenaView;
    if (s.over) return null;
    const seat = s.players.indexOf(me);
    const p = s.pending;
    if (p?.kind === 'offer') return seat === p.to ? { type: pick(['accept', 'refuse']) } : null;
    if (seat !== s.turn) return null;
    if (p?.kind === 'buy') return s.money[seat] >= priceOf(p.cell) && Math.random() < 0.7 ? { type: 'buy' } : { type: 'pass' };
    if (p?.kind === 'taxi') return Math.random() < 0.3 ? { type: 'pass' } : { type: 'ride', steps: 1 + Math.floor(Math.random() * TAXI_RANGE) };
    // Before rolling, now and then: build, make an offer, pay the bail.
    const r = Math.random();
    const cells = s.owner.map((_, cell) => cell);
    const builds = cells.filter((cell) => canBuild(s, seat, cell));
    if (r < 0.3 && builds.length) return { type: 'build', cell: pick(builds) };
    const offers = cells.filter((cell) => canOffer(s, seat, cell) && s.money[seat] >= priceOf(cell));
    if (r < 0.36 && offers.length) {
      const cell = pick(offers);
      return { type: 'offer', cell, price: priceOf(cell) };
    }
    if (s.jail[seat] > 0 && r < 0.5 && s.money[seat] >= BAIL) return { type: 'bail' };
    return { type: 'roll' };
  },
};
