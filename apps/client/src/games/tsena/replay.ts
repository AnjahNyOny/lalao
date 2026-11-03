import { eventMs, JAIL_TRIES, type TsenaView, type TurnLog } from '@game/games/tsena';
import { useEffect, useRef, useState } from 'react';

/** The parts of the state that change during a replay. */
export type Shown = Pick<TsenaView, 'money' | 'pos' | 'owner' | 'level' | 'mortgaged' | 'jail' | 'passes' | 'out'>;

/** Plays the first `count` events of a log over the state before it (display only, no rules). */
export function applyEvents(base: TsenaView, log: TurnLog | null, count: number): Shown {
  const s: Shown = {
    money: base.money.slice(),
    pos: base.pos.slice(),
    owner: base.owner.slice(),
    level: base.level.slice(),
    mortgaged: base.mortgaged.slice(),
    jail: base.jail.slice(),
    passes: base.passes.slice(),
    out: base.out.slice(),
  };
  if (!log) return s;
  const p = log.player;
  for (const e of log.events.slice(0, count)) {
    switch (e.t) {
      case 'move':
        s.pos[p] = e.path[e.path.length - 1];
        break;
      case 'salary':
      case 'cash':
        s.money[p] += e.amount;
        break;
      case 'tax':
      case 'fare':
        s.money[p] -= e.amount;
        break;
      case 'buy':
        s.owner[e.cell] = p;
        s.money[p] -= e.price;
        break;
      case 'rent':
        s.money[p] -= e.amount;
        s.money[e.to] += e.amount;
        break;
      case 'gift':
        s.money[e.from] -= e.amount;
        s.money[e.to] += e.amount;
        break;
      case 'bonus':
        s.out.forEach((out, seat) => !out && (s.money[seat] += e.amount));
        break;
      case 'keep':
        s.passes[p]++;
        break;
      case 'cyclone':
        if (e.cell !== null) s.level[e.cell] = e.level;
        break;
      case 'jail':
        s.jail[p] = JAIL_TRIES;
        break;
      case 'free':
        s.jail[p] = 0;
        s.money[p] -= e.amount;
        if (e.how === 'pass') s.passes[p]--;
        break;
      case 'stay':
        s.jail[p] = e.tries;
        break;
      case 'build':
        s.level[e.cell] = e.level;
        s.money[p] -= e.cost;
        break;
      case 'sell':
        s.level[e.cell] = e.level;
        s.money[p] += e.amount;
        break;
      case 'mortgage':
        s.mortgaged[e.cell] = true;
        s.money[p] += e.amount;
        break;
      case 'redeem':
        s.mortgaged[e.cell] = false;
        s.money[p] -= e.amount;
        break;
      case 'deal':
        s.owner[e.cell] = e.to;
        s.money[e.to] -= e.price;
        s.money[e.from] += e.price;
        break;
      case 'bankrupt':
        s.out[e.seat] = true;
        s.jail[e.seat] = 0;
        s.passes[e.seat] = 0;
        s.owner.forEach((o, cell) => {
          if (o !== e.seat) return;
          s.owner[cell] = null;
          s.level[cell] = 0;
          s.mortgaged[cell] = false;
        });
        break;
    }
  }
  return s;
}

/** A log being played: read every frame by the 3D scene. */
export interface Playback {
  base: TsenaView;
  log: TurnLog;
  start: number;
  /** When each event starts, in ms from `start`. */
  offsets: number[];
}

export const now = () => performance.now();

/** Index of the event playing at `elapsed` ms (events.length once over). */
export function stepAt(pb: Playback, elapsed: number): number {
  let i = 0;
  while (i < pb.offsets.length && elapsed >= pb.offsets[i] + eventMs(pb.log.events[i])) i++;
  return i;
}

/**
 * Replays each new turn log, event by event, at the rules' pace. `shown` is
 * the last state fully on screen; while a log plays, `playback` is set.
 * Falls back to the present when more than two moves are waiting.
 */
export function useReplay(view: TsenaView) {
  const [shown, setShown] = useState(view);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [step, setStep] = useState(0);
  const queue = useRef<TsenaView[]>([]);
  const seen = useRef(view.last?.seq ?? 0);
  const shownRef = useRef(view);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const settle = (v: TsenaView) => {
    clear();
    queue.current = [];
    shownRef.current = v;
    setShown(v);
    setPlayback(null);
  };

  const next = () => {
    const target = queue.current.shift();
    if (!target) return setPlayback(null);
    const log = target.last!;
    const offsets: number[] = [];
    let t = 0;
    for (const e of log.events) {
      offsets.push(t);
      t += eventMs(e);
    }
    const pb: Playback = { base: shownRef.current, log, start: now(), offsets };
    setStep(0);
    setPlayback(pb);
    offsets.forEach((o, i) => i > 0 && timers.current.push(setTimeout(() => setStep(i), o)));
    timers.current.push(
      setTimeout(() => {
        timers.current = [];
        shownRef.current = target;
        setShown(target);
        next();
      }, t),
    );
  };

  useEffect(() => {
    const seq = view.last?.seq ?? 0;
    if (seq < seen.current || !view.last) {
      // A new game started.
      seen.current = seq;
      return settle(view);
    }
    if (seq === seen.current) {
      if (!queue.current.length && timers.current.length === 0) settle(view);
      return;
    }
    seen.current = seq;
    queue.current.push(view);
    if (queue.current.length > 2) return settle(view);
    if (timers.current.length === 0) next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => clear, []);

  const current = playback ? playback.log.events[step] ?? null : null;
  const display = playback ? applyEvents(playback.base, playback.log, step + 1) : applyEvents(shown, null, 0);
  return { shown, playback, step, current, display, busy: playback !== null };
}
