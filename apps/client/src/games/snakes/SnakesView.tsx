import type { PlayerId, RoomInfo } from '@game/core';
import { SNAKES, type CardId, type HopVia, type SnakesState, type TurnLog } from '@game/games/snakes';
import { useEffect, useRef, useState } from 'react';
import type { GameViewProps } from '../types';
import { BoardArt, cellCenter, VIEW } from './BoardArt';
import { paper } from './theme';

export const CARD_TEXT: Record<CardId, string> = {
  forward: 'Raccourci ! Avance de 3 cases',
  back: 'Rature… Recule de 3 cases',
  again: 'Encore toi ! Rejoue',
  skip: "Panne d'encre : passe ton prochain tour",
  start: 'Page blanche : retour au départ !',
  swap: 'Échange ta place avec le premier !',
  ladder: "File jusqu'à la prochaine échelle",
  storm: 'Coup de gomme : les autres reculent de 2',
  eraser: 'Une gomme en plus !',
};

/** Milliseconds per hop, by kind of move. */
const HOP_MS: Record<HopVia, number> = { walk: 170, bounce: 170, ladder: 650, snake: 750, card: 450 };
const ROLL_MS = 550;
const CARD_MS = 1500;
const PAWN_OFFSETS = [
  [-17, -15],
  [17, -15],
  [-17, 17],
  [17, 17],
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Show {
  pos: number[];
  /** Last pawn to move and its hop count, to retrigger the hop animation. */
  hop: { player: number; n: number; ms: number } | null;
  die: { face: number; rolling: boolean };
  card: CardId | null;
  busy: boolean;
}

/**
 * Replays each TurnLog from the server step by step: dice roll, hops, card, other
 * pawns. Logs that arrive mid-animation queue up and play faster.
 */
function useReplay(state: SnakesState): Show {
  const [show, setShow] = useState<Show>(() => ({
    pos: state.pawns.map((p) => p.pos),
    hop: null,
    die: { face: state.last?.roll ?? 1, rolling: false },
    card: null,
    busy: false,
  }));
  const seen = useRef(state.last?.seq ?? 0);
  const queue = useRef<TurnLog[]>([]);
  const latest = useRef(state);
  const running = useRef(false);
  latest.current = state;

  useEffect(() => {
    const log = state.last;
    if (!log || log.seq <= seen.current) return;
    seen.current = log.seq;
    queue.current.push(log);
    if (running.current) return;
    running.current = true;
    (async () => {
      setShow((s) => ({ ...s, busy: true }));
      while (queue.current.length) {
        // Far behind (tab in the background, reconnection, fast bots): jump to the present.
        if (queue.current.length > 2) {
          queue.current = [];
          const s = latest.current;
          setShow((sh) => ({ ...sh, pos: s.pawns.map((p) => p.pos), die: { face: s.last?.roll ?? sh.die.face, rolling: false }, hop: null }));
          break;
        }
        const next = queue.current.shift()!;
        const speed = queue.current.length ? 0.35 : 1;
        await replay(next, speed);
      }
      // Snap to the authoritative positions in case anything drifted.
      setShow((s) => ({ ...s, pos: latest.current.pawns.map((p) => p.pos), busy: false }));
      running.current = false;
    })();
  }, [state.last]);

  async function replay(log: TurnLog, speed: number) {
    if (log.roll !== null) {
      const end = Date.now() + ROLL_MS * speed;
      while (Date.now() < end) {
        setShow((s) => ({ ...s, die: { face: 1 + Math.floor(Math.random() * 6), rolling: true } }));
        await wait(70);
      }
      setShow((s) => ({ ...s, die: { face: log.roll!, rolling: false } }));
      await wait(180 * speed);
    }
    let n = 0;
    let cardShown = false;
    for (const hop of log.hops) {
      // The card is drawn once the walk ends on a mystery cell.
      if (log.card && !cardShown && hop.via !== 'walk' && hop.via !== 'bounce') {
        cardShown = true;
        await showCard(log.card, speed);
      }
      const ms = HOP_MS[hop.via] * speed;
      setShow((s) => ({ ...s, pos: s.pos.map((p, i) => (i === log.player ? hop.cell : p)), hop: { player: log.player, n: ++n, ms } }));
      await wait(ms + 30);
    }
    if (log.card && !cardShown) await showCard(log.card, speed);
    if (log.moved.length) {
      setShow((s) => ({ ...s, pos: s.pos.map((p, i) => log.moved.find((m) => m.player === i)?.to ?? p) }));
      await wait(450 * speed);
    }
  }

  async function showCard(card: CardId, speed: number) {
    setShow((s) => ({ ...s, card }));
    await wait(CARD_MS * speed);
    setShow((s) => ({ ...s, card: null }));
  }

  return show;
}

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[26, 26], [50, 50], [74, 74]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};

function Die({ face, rolling, onRoll }: { face: number; rolling: boolean; onRoll?: () => void }) {
  return (
    <button className={`snakes-die${rolling ? ' rolling' : ''}`} onClick={onRoll} disabled={!onRoll} aria-label={`Dé : ${face}`}>
      <svg viewBox="0 0 100 100">
        <rect x={6} y={6} width={88} height={88} rx={18} fill={paper.board} stroke={paper.graphite} strokeWidth={5} />
        {PIPS[face].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={9} fill={face === 6 ? paper.redPen : paper.graphite} />
        ))}
      </svg>
    </button>
  );
}

function Pawns({ show, colors }: { show: Show; colors: string[] }) {
  return (
    <svg className="snakes-pawns" viewBox={VIEW} aria-hidden>
      {show.pos.map((cell, i) => {
        const c = cellCenter(cell);
        // Spread pawns that share a cell; off-board ones line up in the tray.
        const sharing = show.pos.map((p, j) => [p, j] as const).filter(([p]) => p === cell);
        const slot = sharing.findIndex(([, j]) => j === i);
        const [ox, oy] = cell <= 0 ? [i * 62 + 100, 0] : sharing.length > 1 ? PAWN_OFFSETS[slot] : [0, 0];
        const moving = show.hop?.player === i;
        return (
          <g
            key={i}
            className="pawn"
            style={{ transform: `translate(${c.x + ox}px, ${c.y + oy}px)`, transitionDuration: `${moving ? show.hop!.ms : 300}ms` }}
          >
            <g key={moving ? show.hop!.n : 0} className={moving ? 'hop' : undefined}>
              <ellipse cx={3} cy={22} rx={22} ry={7} fill={paper.graphite} opacity={0.18} />
              <circle r={24} fill={colors[i]} stroke={paper.graphite} strokeWidth={4} />
              <path d="M-12 -10 a14 14 0 0 1 12 -8" stroke="#fff" strokeWidth={4} strokeLinecap="round" fill="none" opacity={0.7} />
            </g>
          </g>
        );
      })}
    </svg>
  );
}

/** One line for the journal, addressing the player directly when it's their move. */
function describe(log: TurnLog, name: (seat: number) => string, mine: boolean): string {
  const who = name(log.player);
  const parts: string[] = [];
  if (log.roll !== null) parts.push(mine ? `Tu fais ${log.roll}` : `${who} fait ${log.roll}`);
  if (log.erased) parts.push(mine ? 'Tu gommes le serpent !' : `${who} gomme le serpent !`);
  const vias = new Set(log.hops.map((h) => h.via));
  if (vias.has('ladder')) parts.push(mine ? 'tu grimpes à l’échelle' : 'grimpe à l’échelle');
  if (vias.has('snake')) parts.push(mine ? 'tu glisses sur le serpent' : 'glisse sur le serpent');
  if (log.card) parts.push(`case mystère : ${CARD_TEXT[log.card].toLowerCase()}`);
  return parts.join(', ');
}

function Status({ state, me, room, show, act }: { state: SnakesState; me: PlayerId; room: RoomInfo; show: Show; act: (a: unknown) => void }) {
  const name = (seat: number) => room.players.find((p) => p.id === state.players[seat])?.name ?? '?';
  const mine = state.players[state.turn] === me && state.winner === null;
  if (state.winner !== null) return null;
  if (mine && state.pending && !show.busy) {
    const erasers = state.pawns[state.turn].erasers;
    return (
      <div className="snakes-choice">
        <p>
          Serpent {state.pending.head} → {SNAKES[state.pending.head]} ! Tu as {erasers} gomme{erasers > 1 ? 's' : ''}.
        </p>
        <div className="row">
          <button className="primary" onClick={() => act({ type: 'erase' })}>
            Gommer ✏️
          </button>
          <button onClick={() => act({ type: 'slide' })}>Glisser 🐍</button>
        </div>
      </div>
    );
  }
  if (mine && !show.busy) {
    return (
      <button className="primary snakes-roll" onClick={() => act({ type: 'roll' })}>
        Lancer le dé
      </button>
    );
  }
  const who = name(state.turn);
  return (
    <p className="snakes-wait">
      {show.busy && state.last ? describe(state.last, name, state.players[state.last.player] === me) : state.pending ? `${who} hésite à gommer le serpent…` : `Au tour de ${who}…`}
    </p>
  );
}

export function SnakesView({ view, me, room, act }: GameViewProps) {
  const state = view as SnakesState;
  const show = useReplay(state);
  const name = (seat: number) => room.players.find((p) => p.id === state.players[seat])?.name ?? '?';
  const myTurn = state.players[state.turn] === me && state.winner === null && !state.pending && !show.busy;

  return (
    <div className="snakes">
      <div className="snakes-board">
        <div className="snakes-sheet">
          <BoardArt />
          <Pawns show={show} colors={paper.pawns} />
          {show.card && (
            <div className="snakes-card" role="status">
              <strong>Case mystère</strong>
              <span>{CARD_TEXT[show.card]}</span>
            </div>
          )}
        </div>
      </div>

      <aside className="snakes-side">
        <ul className="snakes-players">
          {state.players.map((id, i) => (
            <li key={id} className={i === state.turn && state.winner === null ? 'active' : ''}>
              <span className="chip" style={{ background: paper.pawns[i] }} />
              <span className="snakes-name">
                {name(i)}
                {id === me && ' (toi)'}
              </span>
              <span className="snakes-stats">
                {show.pos[i] > 0 ? `case ${show.pos[i]}` : 'départ'} · ✏️{state.pawns[i].erasers}
                {state.pawns[i].skip && ' · ⏸'}
              </span>
            </li>
          ))}
        </ul>
        <div className="snakes-controls">
          <Die face={show.die.face} rolling={show.die.rolling} onRoll={myTurn ? () => act({ type: 'roll' }) : undefined} />
          <Status state={state} me={me} room={room} show={show} act={act} />
        </div>
      </aside>
    </div>
  );
}
