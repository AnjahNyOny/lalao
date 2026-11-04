import { LEVELS, levelSize, NEXT_MS, vanillaTotal, type MiarakaAction, type MiarakaState, type Role } from '@game/games/miaraka';
import { memo, useMemo, useRef, useState } from 'react';
import { ErrorBoundary, hasWebGL } from '../../ui/ErrorBoundary';
import { Stick } from '../../ui/Stick';
import type { GameViewProps } from '../types';
import { useControls } from './controls';
import { hintFor } from './hints';
import { Scene } from './Scene';
import { LOOKS, tsingy } from './theme';

const NAMES: Record<Role, string> = { maki: 'Maki', zebu: 'Zébu' };
const ACTION: Record<Role, string> = { maki: 'Sauter', zebu: 'Foncer' };
const touchScreen = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
/** How long a level's name stays up as it starts. */
const INTRO_MS = 3500;
/** In the dark, the map shows what the lantern has lit so far. */
const SEEN_RADIUS = 4;

/** The level from above: walls and water, only where you've been if it's dark. */
const MinimapBase = memo(function MinimapBase({ level, seen }: { level: number; seen: Set<number> | null; version: number }) {
  const l = LEVELS[level];
  const look = LOOKS[l.look];
  const { w } = levelSize(l);
  const cells: { x: number; z: number; c: string }[] = [];
  l.rows.forEach((row, z) =>
    [...row].forEach((c, x) => {
      if ('#~-I'.includes(c) && (!seen || seen.has(z * w + x))) cells.push({ x, z, c });
    }),
  );
  return (
    <>
      {cells.map(({ x, z, c }) => (
        <rect key={`${x},${z}`} x={x} y={z} width={1.02} height={1.02} fill={c === '#' || c === 'I' ? look.wall : look.water} />
      ))}
    </>
  );
});

function Minimap({ s, seat }: { s: MiarakaState; seat: number }) {
  const l = LEVELS[s.level];
  const { w: W, h: H } = levelSize(l);
  // Cells lit so far, for this level.
  const seen = useMemo(() => (l.dark ? new Set<number>() : null), [l]);
  if (seen) {
    for (const a of s.avatars) {
      for (let z = Math.floor(a.z - SEEN_RADIUS); z <= a.z + SEEN_RADIUS; z++) {
        for (let x = Math.floor(a.x - SEEN_RADIUS); x <= a.x + SEEN_RADIUS; x++) {
          if (x >= 0 && z >= 0 && x < W && z < H && Math.hypot(x + 0.5 - a.x, z + 0.5 - a.z) < SEEN_RADIUS) seen.add(z * W + x);
        }
      }
    }
  }
  const look = LOOKS[l.look];
  return (
    <svg className="miaraka-map" viewBox={`0 0 ${W} ${H}`} aria-label="Carte">
      <rect width={W} height={H} fill={l.dark ? '#0d0f11' : look.floor[0]} />
      <MinimapBase level={s.level} seen={seen} version={seen?.size ?? 0} />
      {s.avatars.map((a, i) => (
        <circle key={i} cx={a.x} cy={a.z} r={i === seat ? 0.9 : 0.75} fill={a.role === 'maki' ? tsingy.maki : tsingy.zebu} stroke="#fff" strokeWidth={0.25} />
      ))}
    </svg>
  );
}

const clock = (ms: number) => {
  const left = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
};

/** A level's name as it starts (on this screen, however long it took to load), and the treasure as it's found. */
function Banner({ s }: { s: MiarakaState }) {
  const l = LEVELS[s.level];
  const shown = useRef({ level: -1, at: 0 });
  if (shown.current.level !== s.level) shown.current = { level: s.level, at: Date.now() };
  if (s.cleared !== null) {
    const next = LEVELS[s.level + 1];
    return (
      <div className="miaraka-banner" key={`clear${s.level}`}>
        <strong>Trésor trouvé !</strong>
        <span>
          🌼 {s.vanilla}/{vanillaTotal(l)} · Ensuite : {next.name} ({clock(NEXT_MS - s.cleared)})
        </span>
      </div>
    );
  }
  if (Date.now() - shown.current.at >= INTRO_MS) return null;
  return (
    <div className="miaraka-banner" key={`intro${s.level}`}>
      <span>
        Niveau {s.level + 1}/{LEVELS.length} · {l.place}
      </span>
      <strong>{l.name}</strong>
    </div>
  );
}

export function MiarakaView({ view, me, room, act }: GameViewProps) {
  const s = view as MiarakaState;
  const state = useRef(s);
  state.current = s;
  const seat = s.players.indexOf(me);
  const { controls, setStick, press } = useControls();
  const [touch] = useState(touchScreen);
  if (seat < 0) return <main className="screen lobby">Partie à deux : regarde-les jouer.</main>;
  const mine = s.avatars[seat];
  const partner = room.players.find((p) => p.id === s.players[1 - seat])?.name ?? 'ton partenaire';
  const level = LEVELS[s.level];

  return (
    <div className="game-stage miaraka" data-look={level.look}>
      {hasWebGL() ? (
        <ErrorBoundary fallback={<p className="miaraka-nogl">Ce jeu a besoin de l’affichage 3D, indisponible sur cet appareil.</p>}>
          <Scene state={state} seat={seat} level={s.level} controls={controls} act={(a: MiarakaAction) => act(a)} />
        </ErrorBoundary>
      ) : (
        <p className="miaraka-nogl">Ce jeu a besoin de l’affichage 3D, indisponible sur cet appareil.</p>
      )}
      <div className="miaraka-top">
        <div className="miaraka-who">
          <span className={`miaraka-role ${mine.role}`}>Toi : {NAMES[mine.role]}</span>
          <span className="muted small">
            {partner} : {NAMES[s.avatars[1 - seat].role]}
          </span>
        </div>
        <div className="miaraka-stats">
          <span title={level.name}>
            Niv. {s.level + 1}/{LEVELS.length}
          </span>
          <span title="Vanille">
            🌼 {s.vanilla}/{vanillaTotal(level)}
            {s.keys > 0 && <span title="Clé"> · 🔑 {s.keys}</span>}
          </span>
          {s.limit !== null && <span className={s.limit - s.time < 60_000 ? 'hurry' : ''}>⏱ {clock(s.limit - s.time)}</span>}
        </div>
        <Minimap s={s} seat={seat} />
      </div>
      <p className="miaraka-hint">{hintFor(s, mine.role)}</p>
      <Banner s={s} />
      {touch ? (
        <>
          <Stick className="miaraka-stick" onMove={setStick} />
          <button
            className={`miaraka-action ${mine.role}`}
            onPointerDown={(e) => {
              e.preventDefault();
              press();
            }}
          >
            {ACTION[mine.role]}
          </button>
        </>
      ) : (
        <p className="miaraka-keys">Flèches ou ZQSD pour bouger · Espace : {ACTION[mine.role].toLowerCase()}</p>
      )}
    </div>
  );
}
