import { LADDERS, LAST, MYSTERY, SIZE, SNAKES, cellXY } from '@game/games/snakes';
import { memo } from 'react';
import { paper } from './theme';

export const CELL = 100;
export const BOARD = CELL * SIZE;
/** Strip under the board where pawns wait before their first move. */
export const TRAY = 90;
export const VIEW = `0 0 ${BOARD} ${BOARD + TRAY}`;

export interface Pt {
  x: number;
  y: number;
}

export function cellCenter(cell: number): Pt {
  if (cell <= 0) return { x: 160, y: BOARD + TRAY / 2 };
  const { col, row } = cellXY(cell);
  return { x: col * CELL + CELL / 2, y: (SIZE - 1 - row) * CELL + CELL / 2 };
}

/** Wavy line from head to tail, flattening out towards the tail. */
function snakeBody(head: Pt, tail: Pt): string {
  const dx = tail.x - head.x;
  const dy = tail.y - head.y;
  const len = Math.hypot(dx, dy);
  const [nx, ny] = [-dy / len, dx / len];
  const waves = Math.max(2, Math.round(len / 170));
  const amp = Math.min(34, len * 0.11);
  const pts: string[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const off = amp * Math.sin(t * Math.PI * waves) * (1 - 0.4 * t);
    pts.push(`${(head.x + dx * t + nx * off).toFixed(1)},${(head.y + dy * t + ny * off).toFixed(1)}`);
  }
  return `M${pts.join(' L')}`;
}

function Ladder({ from, to }: { from: number; to: number }) {
  const a = cellCenter(from);
  const b = cellCenter(to);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const [ux, uy] = [(b.x - a.x) / len, (b.y - a.y) / len];
  const [px, py] = [-uy * 17, ux * 17];
  // Pull the ends into the cells so the ladder sits inside them.
  const s = { x: a.x - ux * 10, y: a.y - uy * 10 };
  const e = { x: b.x + ux * 10, y: b.y + uy * 10 };
  const rungs = Math.max(3, Math.floor(len / 38));
  return (
    <g stroke={paper.ladder} strokeLinecap="round" fill="none">
      <line x1={s.x + px} y1={s.y + py} x2={e.x + px} y2={e.y + py} strokeWidth={6} />
      <line x1={s.x - px} y1={s.y - py} x2={e.x - px} y2={e.y - py} strokeWidth={6} />
      {Array.from({ length: rungs }, (_, i) => {
        const t = (i + 0.7) / (rungs + 0.4);
        const c = { x: s.x + (e.x - s.x) * t, y: s.y + (e.y - s.y) * t };
        return <line key={i} x1={c.x + px} y1={c.y + py} x2={c.x - px} y2={c.y - py} strokeWidth={4.5} />;
      })}
    </g>
  );
}

function Snake({ head, tail }: { head: number; tail: number }) {
  const h = cellCenter(head);
  const t = cellCenter(tail);
  const d = snakeBody(h, t);
  const angle = (Math.atan2(t.y - h.y, t.x - h.x) * 180) / Math.PI;
  return (
    <g strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d={d} stroke={paper.snakeDark} strokeWidth={24} />
      <path d={d} stroke={paper.snake} strokeWidth={17} />
      <path d={d} stroke={paper.snakeBelly} strokeWidth={5} strokeDasharray="2 14" />
      {/* Head points away from the body. */}
      <g transform={`translate(${h.x} ${h.y}) rotate(${angle + 180})`}>
        <path d="M12 0 l14 -3 m-14 3 l14 3" stroke={paper.redPen} strokeWidth={3} />
        <ellipse rx={20} ry={15} fill={paper.snake} stroke={paper.snakeDark} strokeWidth={3.5} />
        <circle cx={6} cy={-6} r={4.5} fill="#fff" stroke={paper.graphite} strokeWidth={1.5} />
        <circle cx={6} cy={6} r={4.5} fill="#fff" stroke={paper.graphite} strokeWidth={1.5} />
        <circle cx={7.5} cy={-6} r={2} fill={paper.graphite} />
        <circle cx={7.5} cy={6} r={2} fill={paper.graphite} />
      </g>
    </g>
  );
}

/** The drawn board. Static: rendered once, on its own layer so pawn moves never repaint it. */
export const BoardArt = memo(function BoardArt() {
  const cells = Array.from({ length: LAST }, (_, i) => i + 1);
  return (
    <svg className="snakes-art" viewBox={VIEW} aria-hidden>
      <defs>
        {/* Wobbles straight lines so they look drawn by hand. */}
        <filter id="pencil" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={3} />
          <feDisplacementMap in="SourceGraphic" scale={5} />
        </filter>
        {paper.washes.map((c, i) => (
          <pattern key={c} id={`wash-${i}`} width={9} height={9} patternUnits="userSpaceOnUse" patternTransform={`rotate(${i ? -35 : 40})`}>
            <rect width={9} height={9} fill={c} opacity={0.35} />
            <line x1={0} y1={0} x2={0} y2={9} stroke={c} strokeWidth={5} opacity={0.8} />
          </pattern>
        ))}
      </defs>

      <g filter="url(#pencil)">
        <rect x={4} y={4} width={BOARD - 8} height={BOARD - 8} fill={paper.board} stroke={paper.graphite} strokeWidth={5} />
        {cells.map((cell) => {
          const { col, row } = cellXY(cell);
          const x = col * CELL;
          const y = (SIZE - 1 - row) * CELL;
          return (col + row) % 3 === 0 ? (
            <rect key={cell} x={x + 6} y={y + 6} width={CELL - 12} height={CELL - 12} fill={`url(#wash-${(col + row) % 2})`} />
          ) : null;
        })}
        <g stroke={paper.graphite} strokeWidth={2.2} opacity={0.75}>
          {Array.from({ length: SIZE - 1 }, (_, i) => (
            <g key={i}>
              <line x1={(i + 1) * CELL} y1={6} x2={(i + 1) * CELL} y2={BOARD - 6} />
              <line x1={6} y1={(i + 1) * CELL} x2={BOARD - 6} y2={(i + 1) * CELL} />
            </g>
          ))}
        </g>
        {Object.entries(LADDERS).map(([from, to]) => (
          <Ladder key={from} from={+from} to={to} />
        ))}
      </g>

      <g className="cell-numbers" fill={paper.graphite}>
        {cells.map((cell) => {
          const { col, row } = cellXY(cell);
          return (
            <text key={cell} x={col * CELL + 10} y={(SIZE - 1 - row) * CELL + 26} fontSize={22} opacity={0.7}>
              {cell}
            </text>
          );
        })}
      </g>

      {MYSTERY.map((cell) => {
        const c = cellCenter(cell);
        return (
          <g key={cell} className="mystery" fill="none" stroke={paper.pen}>
            <circle cx={c.x + 6} cy={c.y + 8} r={27} strokeWidth={2.5} strokeDasharray="60 6 30 4" />
            <text x={c.x + 6} y={c.y + 27} fontSize={58} textAnchor="middle" fill={paper.pen} stroke="none">
              ?
            </text>
          </g>
        );
      })}

      <g filter="url(#pencil)">
        {Object.entries(SNAKES).map(([head, tail]) => (
          <Snake key={head} head={+head} tail={tail} />
        ))}
      </g>

      {(() => {
        const finish = cellCenter(LAST);
        return (
          <g className="finish" transform={`translate(${finish.x - 4} ${finish.y + 4})`}>
            <line x1={-12} y1={30} x2={-12} y2={-32} stroke={paper.graphite} strokeWidth={4} strokeLinecap="round" />
            <path d="M-12 -32 L26 -22 L-12 -10 Z" fill={paper.redPen} stroke={paper.graphite} strokeWidth={2.5} strokeLinejoin="round" />
          </g>
        );
      })()}

      <text className="tray-label" x={30} y={BOARD + TRAY / 2 + 10} fontSize={34} fill={paper.graphite}>
        Départ
      </text>

      {/* Masking tape holding the sheet down. */}
      <rect x={-14} y={-8} width={110} height={34} fill={paper.tape} transform="rotate(-32 40 10)" />
      <rect x={BOARD - 96} y={-8} width={110} height={34} fill={paper.tape} transform={`rotate(30 ${BOARD - 40} 10)`} />
    </svg>
  );
});
