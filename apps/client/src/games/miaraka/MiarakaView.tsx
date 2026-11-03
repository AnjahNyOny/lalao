import { cellIndex, LEVELS, levelSize, vanillaTotal, type MiarakaAction, type MiarakaState, type Role } from '@game/games/miaraka';
import { memo, useMemo, useRef, useState, type PointerEvent } from 'react';
import { ErrorBoundary, hasWebGL } from '../../ui/ErrorBoundary';
import type { GameViewProps } from '../types';
import { useControls } from './controls';
import { Scene } from './Scene';
import { tsingy } from './theme';

const level = LEVELS[0];
const { w: W, h: H } = levelSize(level);
const NAMES: Record<Role, string> = { maki: 'Maki', zebu: 'Zébu' };
const ACTION: Record<Role, string> = { maki: 'Sauter', zebu: 'Foncer' };
const touchScreen = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** What to do next, for this animal, from where the pair has got to. */
export function hintFor(s: MiarakaState, role: Role): string {
  if (s.won) return 'Le trésor des Tsingy est à vous deux !';
  if (s.lost) return 'Le temps est écoulé… On réessaie ?';
  const zebu = role === 'zebu';
  const croc = s.crocs.some((c) => s.avatars.some((a) => Math.hypot(a.x - c.x, a.z - c.z) < 3)) && !s.crocs.every((c) => c.stun > 0);
  if (croc) return zebu ? 'Le crocodile ! Fonce sur lui pour l’étourdir.' : 'Le crocodile ! Attends qu’il s’éloigne, ou que le zébu l’étourdisse.';
  if (!s.broken.includes(cellIndex(level, 7, 7)))
    return zebu ? 'Fonce dans le mur fissuré pour ouvrir le passage.' : 'Seul le zébu casse le mur fissuré. En attendant, saute cueillir la vanille sur les rochers !';
  if (!s.levers.includes('b'))
    return zebu
      ? 'Monte sur la dalle aux cornes et restes-y : la palissade s’ouvre pour le maki.'
      : s.open.includes('a')
        ? 'Passe la palissade, puis grimpe tirer le levier sur les rochers.'
        : 'La palissade ne s’ouvre que sous le poids du zébu, sur la dalle aux cornes.';
  if (!s.open.includes('c'))
    return zebu ? 'Fonce dans la caisse pour la pousser sur la dalle : le pont descendra.' : 'Tiens la dalle près de la rivière pour le zébu, ou saute par-dessus l’eau !';
  if (s.keys === 0 && s.doors.length === 0) return 'Une clé brille en haut des rochers : seul le maki peut sauter la chercher.';
  if (s.doors.length === 0) return 'Apportez la clé à la porte du trésor.';
  return 'Chacun sur un socle, en même temps : le trésor s’ouvre !';
}

/** The level from above: walls, water, and the two of you. */
const MinimapBase = memo(function MinimapBase() {
  const cells = useMemo(() => {
    const out: { x: number; z: number; c: string }[] = [];
    level.rows.forEach((row, z) => [...row].forEach((c, x) => (c === '#' || c === '~') && out.push({ x, z, c })));
    return out;
  }, []);
  return (
    <>
      {cells.map(({ x, z, c }) => (
        <rect key={`${x},${z}`} x={x} y={z} width={1.02} height={1.02} fill={c === '#' ? tsingy.wall : tsingy.water} />
      ))}
    </>
  );
});

function Minimap({ s, seat }: { s: MiarakaState; seat: number }) {
  return (
    <svg className="miaraka-map" viewBox={`0 0 ${W} ${H}`} aria-label="Carte">
      <rect width={W} height={H} fill={tsingy.floor[0]} />
      <MinimapBase />
      {s.avatars.map((a, i) => (
        <circle key={i} cx={a.x} cy={a.z} r={i === seat ? 0.9 : 0.75} fill={a.role === 'maki' ? tsingy.maki : tsingy.zebu} stroke="#fff" strokeWidth={0.25} />
      ))}
    </svg>
  );
}

/** A thumb stick: drag from its centre. */
function Stick({ onMove }: { onMove: (x: number, z: number) => void }) {
  const base = useRef<HTMLDivElement>(null!);
  const [knob, setKnob] = useState<[number, number]>([0, 0]);
  const pointer = useRef<number | null>(null);
  const move = (e: PointerEvent) => {
    if (pointer.current !== e.pointerId) return;
    const r = base.current.getBoundingClientRect();
    const radius = r.width / 2;
    let x = (e.clientX - r.left - radius) / radius;
    let z = (e.clientY - r.top - radius) / radius;
    const len = Math.hypot(x, z);
    if (len > 1) [x, z] = [x / len, z / len];
    setKnob([x, z]);
    onMove(x, z);
  };
  const end = (e: PointerEvent) => {
    if (pointer.current !== e.pointerId) return;
    pointer.current = null;
    setKnob([0, 0]);
    onMove(0, 0);
  };
  return (
    <div
      ref={base}
      className="miaraka-stick"
      onPointerDown={(e) => {
        pointer.current = e.pointerId;
        base.current.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <span style={{ transform: `translate(${knob[0] * 40}%, ${knob[1] * 40}%)` }} />
    </div>
  );
}

const clock = (ms: number) => {
  const left = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
};

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

  return (
    <div className="game-stage miaraka">
      {hasWebGL() ? (
        <ErrorBoundary fallback={<p className="miaraka-nogl">Ce jeu a besoin de l’affichage 3D, indisponible sur cet appareil.</p>}>
          <Scene state={state} seat={seat} controls={controls} act={(a: MiarakaAction) => act(a)} />
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
          <span title="Vanille">🌼 {s.vanilla}/{vanillaTotal(level)}</span>
          {s.keys > 0 && <span title="Clé">🔑 {s.keys}</span>}
          {s.limit !== null && <span className={s.limit - s.time < 60_000 ? 'hurry' : ''}>⏱ {clock(s.limit - s.time)}</span>}
        </div>
        <Minimap s={s} seat={seat} />
      </div>
      <p className="miaraka-hint">{hintFor(s, mine.role)}</p>
      {touch ? (
        <>
          <Stick onMove={setStick} />
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
