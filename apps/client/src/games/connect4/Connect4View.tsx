import { COLS, ROWS, cellIndex, type Connect4State, type Disc } from '@game/games/connect4';
import { useState, type CSSProperties } from 'react';
import type { GameViewProps } from '../types';
import { connect4Scene as scene } from './theme';

const CELL = 100;
const PAD = 24;
const HOLE_R = 38;
const DISC_R = 43;
/** Space above the board for the disc you're about to drop. */
const TOP = 110;
const BOARD_W = COLS * CELL + PAD * 2;
const BOARD_H = ROWS * CELL + PAD * 2;
const FEET = 44;
const VIEW_H = TOP + BOARD_H + FEET;

const cx = (col: number) => PAD + col * CELL + CELL / 2;
const cy = (row: number) => TOP + PAD + (ROWS - 1 - row) * CELL + CELL / 2;

function DiscShape({ disc, x, y }: { disc: Disc; x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={DISC_R} fill={scene.discs[disc]} stroke={scene.outline} strokeWidth={5} />
      <circle r={DISC_R - 14} fill="none" stroke={scene.discsDark[disc]} strokeWidth={5} />
      <path d="M-24 -14 a28 28 0 0 1 18 -14" stroke="#fff" strokeWidth={6} strokeLinecap="round" fill="none" opacity={0.75} />
    </g>
  );
}

/** Board face with see-through holes; discs are drawn behind it. */
function BoardFace() {
  return (
    <g>
      <defs>
        <mask id="c4-holes">
          <rect width={BOARD_W} height={VIEW_H} fill="#fff" />
          {Array.from({ length: COLS * ROWS }, (_, i) => (
            <circle key={i} cx={cx(i % COLS)} cy={cy(Math.floor(i / COLS))} r={HOLE_R} fill="#000" />
          ))}
        </mask>
      </defs>
      {[PAD + 10, BOARD_W - PAD - 70].map((x) => (
        <path
          key={x}
          d={`M${x} ${TOP + BOARD_H - 10} h60 l14 ${FEET} h-88 z`}
          fill={scene.boardDark}
          stroke={scene.outline}
          strokeWidth={5}
          strokeLinejoin="round"
        />
      ))}
      <rect x={3} y={TOP + 3} width={BOARD_W - 6} height={BOARD_H - 6} rx={28} fill={scene.board} stroke={scene.outline} strokeWidth={6} mask="url(#c4-holes)" />
      {Array.from({ length: COLS * ROWS }, (_, i) => (
        <circle key={i} cx={cx(i % COLS)} cy={cy(Math.floor(i / COLS))} r={HOLE_R} fill="none" stroke={scene.boardDark} strokeWidth={5} />
      ))}
      <path d={`M30 ${TOP + 20} h${BOARD_W - 60}`} stroke="#fff" strokeWidth={6} strokeLinecap="round" opacity={0.35} />
    </g>
  );
}

function WinLine({ cells }: { cells: number[] }) {
  const pts = cells.map((i) => ({ x: cx(i % COLS), y: cy(Math.floor(i / COLS)) })).sort((a, b) => a.x - b.x || a.y - b.y);
  const [a, b] = [pts[0], pts[pts.length - 1]];
  return (
    <g className="c4-winline">
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={scene.outline} strokeWidth={22} strokeLinecap="round" />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#fff" strokeWidth={12} strokeLinecap="round" />
    </g>
  );
}

export function Connect4View({ view, me, room, act }: GameViewProps) {
  const state = view as Connect4State;
  const [hover, setHover] = useState<number | null>(null);
  const seat = state.players.indexOf(me);
  const myDisc = seat === -1 ? null : (seat as Disc);
  const myTurn = myDisc !== null && state.turn === myDisc && state.winner === null;
  const name = (id: string) => room.players.find((p) => p.id === id)?.name ?? '?';
  const lastIndex = state.last ? cellIndex(state.last.col, state.last.row) : -1;
  const win = new Set(state.winLine ?? []);

  return (
    <div className="game-stage c4-stage">
      <div className="c4-board">
        <svg viewBox={`0 0 ${BOARD_W} ${VIEW_H}`} className="c4-svg">
          {state.board.map((disc, i) => {
            if (disc === null) return null;
            const col = i % COLS;
            const row = Math.floor(i / COLS);
            const dropping = i === lastIndex;
            return (
              <g
                key={i}
                className={`${dropping ? 'c4-drop' : ''} ${win.has(i) ? 'c4-win' : ''}`}
                style={dropping ? ({ '--from': `${TOP / 2 - cy(row)}px`, '--ms': `${320 + (ROWS - row) * 45}ms` } as CSSProperties) : undefined}
              >
                <DiscShape disc={disc} x={cx(col)} y={cy(row)} />
              </g>
            );
          })}

          <BoardFace />
          {state.winLine && <WinLine cells={state.winLine} />}

          {myTurn && hover !== null && (
            <g className="c4-ghost">
              <DiscShape disc={myDisc} x={cx(hover)} y={TOP / 2} />
            </g>
          )}

          {Array.from({ length: COLS }, (_, c) => (
            <rect
              key={c}
              className={myTurn ? 'c4-col playable' : 'c4-col'}
              x={PAD + c * CELL}
              y={0}
              width={CELL}
              height={TOP + BOARD_H}
              fill="transparent"
              onPointerEnter={() => setHover(c)}
              onPointerLeave={() => setHover((h) => (h === c ? null : h))}
              onClick={() => myTurn && act({ col: c })}
            />
          ))}
        </svg>
      </div>

      <div className="hud">
        {state.players.map((id, i) => (
          <div key={id} className={`hud-player ${state.turn === i && state.winner === null ? 'active' : ''}`}>
            <span className="chip" style={{ background: scene.discs[i] }} />
            {name(id)}
            {id === me && ' (toi)'}
          </div>
        ))}
      </div>
      {state.winner === null && state.moves < COLS * ROWS && (
        <div className="turn-banner">{myTurn ? 'À toi de jouer !' : `Au tour de ${name(state.players[state.turn])}…`}</div>
      )}
    </div>
  );
}
