import { mulberryStep, type GameDefinition, type PlayerId } from '@game/core';
import { CARD_STEPS, CARDS, LADDERS, LAST, MYSTERY, SNAKES, STORM_STEPS, type CardId } from './board';
import { snakesBot } from './bot';

export * from './board';

export const START_ERASERS = 2;

export interface Pawn {
  /** 0 = not on the board yet. */
  pos: number;
  /** Each one cancels a snake, at the player's choice. */
  erasers: number;
  /** Misses their next turn. */
  skip: boolean;
}

export type HopVia = 'walk' | 'bounce' | 'ladder' | 'snake' | 'card';
export interface Hop {
  cell: number;
  via: HopVia;
}

/** What just happened, step by step, so every screen can replay it. */
export interface TurnLog {
  /** Increases with every action: lets the view spot a new move. */
  seq: number;
  player: number;
  roll: number | null;
  hops: Hop[];
  card: CardId | null;
  /** Other pawns moved by a card (swap, storm). */
  moved: { player: number; to: number }[];
  erased: boolean;
}

export interface SnakesState {
  players: PlayerId[];
  pawns: Pawn[];
  turn: number;
  /** mulberry32 state: dice and cards stay reproducible. */
  rng: number;
  /** The current player sits on a snake head with an eraser left: their call. */
  pending: { head: number; again: boolean } | null;
  last: TurnLog | null;
  winner: number | null;
}

export type SnakesAction = { type: 'roll' } | { type: 'erase' } | { type: 'slide' };

type Outcome = 'pending' | 'again' | null;

/** Mutable working copy for one action; `apply` never touches its input. */
class Turn {
  readonly s: SnakesState;
  readonly log: TurnLog;

  constructor(state: SnakesState) {
    this.s = { ...state, pawns: state.pawns.map((p) => ({ ...p })) };
    this.log = { seq: (state.last?.seq ?? 0) + 1, player: state.turn, roll: null, hops: [], card: null, moved: [], erased: false };
  }

  get me(): Pawn {
    return this.s.pawns[this.s.turn];
  }

  rand(): number {
    const [value, next] = mulberryStep(this.s.rng);
    this.s.rng = next;
    return value;
  }

  /** Cell by cell, bouncing back off the last cell. */
  walk(steps: number): void {
    let dir = Math.sign(steps);
    for (let i = 0; i < Math.abs(steps); i++) {
      if (this.me.pos === LAST) dir = -1;
      if (this.me.pos === 0 && dir < 0) break;
      this.me.pos += dir;
      this.log.hops.push({ cell: this.me.pos, via: dir > 0 || steps < 0 ? 'walk' : 'bounce' });
    }
  }

  jump(cell: number, via: HopVia): void {
    this.me.pos = cell;
    this.log.hops.push({ cell, via });
  }

  /** Resolves the cell the pawn stopped on. Mystery cards don't chain into more cards. */
  land(allowCard: boolean): Outcome {
    const cell = this.me.pos;
    if (LADDERS[cell]) {
      this.jump(LADDERS[cell], 'ladder');
      return null;
    }
    if (SNAKES[cell]) {
      if (this.me.erasers > 0) return 'pending';
      this.jump(SNAKES[cell], 'snake');
      return null;
    }
    if (allowCard && MYSTERY.includes(cell)) return this.card();
    return null;
  }

  card(): Outcome {
    const total = CARDS.reduce((sum, c) => sum + c.weight, 0);
    let x = this.rand() * total;
    const card = CARDS.find((c) => (x -= c.weight) < 0)?.id ?? CARDS[0].id;
    this.log.card = card;
    const others = this.s.pawns.map((p, i) => ({ p, i })).filter(({ i }) => i !== this.s.turn);

    switch (card) {
      case 'forward':
        this.walk(CARD_STEPS);
        return this.land(false);
      case 'back':
        this.walk(-CARD_STEPS);
        return this.land(false);
      case 'again':
        return 'again';
      case 'skip':
        this.me.skip = true;
        return null;
      case 'start':
        this.jump(0, 'card');
        return null;
      case 'swap': {
        const leader = others.filter(({ p }) => p.pos > this.me.pos).sort((a, b) => b.p.pos - a.p.pos)[0];
        if (!leader) return null;
        const mine = this.me.pos;
        this.jump(leader.p.pos, 'card');
        leader.p.pos = mine;
        this.log.moved.push({ player: leader.i, to: mine });
        return null;
      }
      case 'ladder': {
        const next = Object.keys(LADDERS)
          .map(Number)
          .sort((a, b) => a - b)
          .find((bottom) => bottom > this.me.pos);
        if (next === undefined) {
          this.walk(CARD_STEPS);
          return this.land(false);
        }
        this.jump(next, 'card');
        return this.land(false);
      }
      case 'storm':
        for (const { p, i } of others) {
          p.pos = Math.max(0, p.pos - STORM_STEPS);
          this.log.moved.push({ player: i, to: p.pos });
        }
        return null;
      case 'eraser':
        this.me.erasers++;
        return null;
    }
  }

  /** Hands the dice on, unless the player won, must decide, or plays again. */
  finish(outcome: Outcome, again: boolean): SnakesState {
    const s = this.s;
    s.last = this.log;
    if (this.me.pos === LAST) {
      s.winner = s.turn;
      return s;
    }
    if (outcome === 'pending') {
      s.pending = { head: this.me.pos, again };
      return s;
    }
    if (again || outcome === 'again') return s;
    let next = s.turn;
    for (let i = 0; i < s.pawns.length; i++) {
      next = (next + 1) % s.pawns.length;
      if (!s.pawns[next].skip) break;
      s.pawns[next].skip = false;
    }
    s.turn = next;
    return s;
  }
}

function isAction(a: unknown): a is SnakesAction {
  if (typeof a !== 'object' || a === null) return false;
  const { type } = a as Record<string, unknown>;
  return type === 'roll' || type === 'erase' || type === 'slide';
}

export const snakes: GameDefinition<SnakesState, SnakesAction> = {
  id: 'snakes',
  name: 'Serpents & échelles',
  minPlayers: 2,
  maxPlayers: 4,
  // Let a pawn finish walking, climbing or sliding before a bot rolls again.
  botDelayMs: [2000, 2600],

  setup(players, seed) {
    return {
      players,
      pawns: players.map(() => ({ pos: 0, erasers: START_ERASERS, skip: false })),
      turn: seed % players.length,
      rng: (seed ^ 0x9e3779b9) >>> 0,
      pending: null,
      last: null,
      winner: null,
    };
  },

  validate(state, action, by): action is SnakesAction {
    if (state.winner !== null || state.players[state.turn] !== by || !isAction(action)) return false;
    if (action.type === 'roll') return state.pending === null;
    if (action.type === 'erase') return state.pending !== null && state.pawns[state.turn].erasers > 0;
    return state.pending !== null;
  },

  apply(state, action) {
    const t = new Turn(state);
    if (action.type === 'roll') {
      const roll = 1 + Math.floor(t.rand() * 6);
      t.log.roll = roll;
      t.walk(roll);
      return t.finish(t.land(true), roll === 6);
    }
    const { head, again } = state.pending!;
    t.s.pending = null;
    if (action.type === 'erase') {
      t.me.erasers--;
      t.log.erased = true;
    } else {
      t.jump(SNAKES[head], 'snake');
    }
    return t.finish(null, again);
  },

  bot: snakesBot,

  result(state) {
    return state.winner === null ? null : { kind: 'win', winners: [state.players[state.winner]] };
  },
};
