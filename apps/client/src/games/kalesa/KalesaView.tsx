import {
  bestShape,
  GRACE_MS,
  roadOf,
  scoreOn,
  segmentAt,
  standings,
  startsOf,
  TERRAINS,
  type KalesaAction,
  type KalesaState,
  type TrackDef,
} from '@game/games/kalesa';
import { memo, useMemo, useRef } from 'react';
import { ErrorBoundary, hasWebGL } from '../../ui/ErrorBoundary';
import type { GameViewProps } from '../types';
import { CAR_LOOKS, carImage, carsOf } from './cars';
import { DrawPad } from './DrawPad';
import { Scene } from './Scene';
import { GAUGE, ROAD } from './theme';

/** How far ahead the next stretch is announced, metres. */
const WARN_M = 70;

const place = (n: number) => (n === 1 ? '1re' : `${n}e`);
const clock = (ms: number) => {
  const tenths = Math.max(0, Math.round(ms / 100));
  const s = Math.floor(tenths / 10);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')},${tenths % 10}`;
};

/** A wheel's outline, as a little picture. */
export function WheelIcon({ pts, closed, color, className }: { pts: number[]; closed: boolean; color: string; className?: string }) {
  const points: string[] = [];
  for (let i = 0; i + 1 < pts.length; i += 2) points.push(`${pts[i]},${-pts[i + 1]}`);
  const Shape = closed ? 'polygon' : 'polyline';
  return (
    <svg className={className} viewBox="-115 -115 230 230" aria-hidden>
      <Shape points={points.join(' ')} fill="none" stroke={color} strokeWidth={16} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** The road from start to finish, coloured by terrain, with every car on it. */
const StripRoad = memo(function StripRoad({ road, length }: { road: TrackDef; length: number }) {
  const starts = startsOf(road);
  return (
    <>
      {road.segments.map((seg, i) => (
        <rect key={i} x={(starts[i] / length) * 1000} y={8} width={(seg.len / length) * 1000 + 0.5} height={14} fill={ROAD[seg.t].top} />
      ))}
    </>
  );
});

function Strip({ s, road, seat, cars }: { s: KalesaState; road: TrackDef; seat: number; cars: string[] }) {
  return (
    <svg className="kalesa-strip" viewBox="-12 0 1030 30" preserveAspectRatio="none" aria-label="La course">
      <StripRoad road={road} length={s.length} />
      <rect x={994} y={4} width={6} height={22} fill={GAUGE.flag} />
      {s.cars
        .map((c, i) => ({ c, i }))
        // This screen's car on top.
        .sort((a, b) => (a.i === seat ? 1 : b.i === seat ? -1 : 0))
        .map(({ c, i }) => (
          <circle
            key={i}
            cx={(c.d / s.length) * 1000}
            cy={15}
            r={i === seat ? 10 : 7.5}
            fill={CAR_LOOKS[cars[i]]?.color ?? GAUGE.flag}
            stroke={i === seat ? GAUGE.mine : GAUGE.outline}
            strokeWidth={i === seat ? 4 : 2}
            vectorEffect="non-scaling-stroke"
          />
        ))}
    </svg>
  );
}

function Standings({ s, seat, cars, names }: { s: KalesaState; seat: number; cars: string[]; names: string[] }) {
  return (
    <ol className="kalesa-standings">
      {standings(s).map((i, k) => {
        const c = s.cars[i];
        return (
          <li key={i} className={i === seat ? 'mine' : ''} style={{ borderColor: CAR_LOOKS[cars[i]]?.color }}>
            <b>{k + 1}</b>
            <img src={carImage(cars[i])} alt="" />
            <span>{i === seat ? 'Toi' : names[i]}</span>
            {c.finish !== null ? <em>{clock(c.finish)}</em> : <WheelIcon className="kalesa-mini-wheel" pts={c.wheel.pts} closed={c.wheel.closed} color={CAR_LOOKS[cars[i]]?.color ?? GAUGE.flag} />}
          </li>
        );
      })}
    </ol>
  );
}

/** Where this player is and what's coming: the terrain, how well the wheel grips it, the next one and the wheel it wants. */
function Hint({ s, seat, road, color }: { s: KalesaState; seat: number; road: TrackDef; color: string }) {
  const c = s.cars[seat];
  const here = segmentAt(road, Math.min(c.d, s.length - 0.01));
  const grip = Math.round(scoreOn(here.t, c.wheel) * 100);
  const nextIndex = here.index + 1;
  const ahead = here.end - c.d;
  const next = nextIndex < road.segments.length ? road.segments[nextIndex].t : null;
  // What to say: the start, the next stretch if it's close, this one if the wheel slips, the next one a little further off.
  const racing = s.time >= 0 && c.finish === null;
  const slipping = racing && grip < 60;
  const [coming, when] =
    s.time < 0
      ? [here.t, 'Au départ']
      : racing && next && ahead < 25
        ? [next, `Dans ${Math.max(0, Math.round(ahead))} m`]
        : slipping
          ? [here.t, 'Ta roue peine']
          : racing && next && ahead < WARN_M
            ? [next, `Dans ${Math.round(ahead)} m`]
            : [null, ''];
  const shape = coming ? bestShape(coming) : null;
  const level = grip >= 85 ? 'good' : grip >= 60 ? 'mid' : 'bad';
  return (
    <div className="kalesa-hint">
      <div className="kalesa-here">
        <span className="kalesa-terrain" style={{ background: ROAD[here.t].top }} />
        <strong>{TERRAINS[here.t].name}</strong>
        <span className="kalesa-grip" aria-label={`Adhérence ${grip} %`}>
          <span style={{ width: `${grip}%`, background: GAUGE[level] }} />
        </span>
        <span className="kalesa-pct">{grip} %</span>
      </div>
      {coming && shape ? (
        <div className="kalesa-next">
          <WheelIcon className="kalesa-next-wheel" pts={shape.wheel.pts} closed={shape.wheel.closed} color={color} />
          <span>
            {when} : <b>{TERRAINS[coming].name}</b>, {TERRAINS[coming].hint}
          </span>
        </div>
      ) : (
        <div className="kalesa-next muted">
          {c.finish !== null ? 'Arrivée !' : next ? `Ensuite : ${TERRAINS[next].name}` : 'Dernière ligne droite !'}
        </div>
      )}
    </div>
  );
}

/** 3, 2, 1, andao! (« let's go! »). */
function Countdown({ time }: { time: number }) {
  if (time >= 900) return null;
  const label = time < 0 ? String(Math.ceil(-time / 1000)) : 'Andao !';
  return (
    <div className="kalesa-countdown" key={label} aria-live="polite">
      {label}
    </div>
  );
}

function Finish({ s, seat }: { s: KalesaState; seat: number }) {
  const first = Math.min(...s.cars.map((c) => c.finish ?? Infinity));
  if (!Number.isFinite(first) || s.over) return null;
  const mine = seat >= 0 ? s.cars[seat] : null;
  const left = Math.ceil((first + GRACE_MS - s.time) / 1000);
  return (
    <div className="kalesa-finish">
      {mine?.finish != null ? <strong>Tu finis à la {place(standings(s).indexOf(seat) + 1)} place !</strong> : <strong>Le premier est arrivé !</strong>}
      <span>Fin de la course dans {left} s</span>
    </div>
  );
}

export function KalesaView({ view, me, room, act }: GameViewProps) {
  const s = view as KalesaState;
  const state = useRef(s);
  const received = useRef(0);
  if (state.current !== s || received.current === 0) {
    state.current = s;
    received.current = performance.now();
  }
  const seat = s.players.indexOf(me);
  const pieces = room.players.map((p) => `${p.id}:${p.piece}`).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cars = useMemo(() => carsOf(s.players, room), [s.players.join(','), pieces]);
  const names = s.players.map((id) => room.players.find((p) => p.id === id)?.name ?? '?');
  const road = roadOf(s);
  const color = seat >= 0 ? CAR_LOOKS[cars[seat]]?.color ?? GAUGE.flag : GAUGE.flag;
  const car = seat >= 0 ? s.cars[seat] : null;
  const gl = hasWebGL();
  const noGl = <p className="kalesa-nogl">Affichage 3D indisponible : suis la course sur la bande en haut.</p>;

  return (
    <div className="game-stage kalesa">
      <div className="kalesa-view">
        {gl ? (
          <ErrorBoundary fallback={noGl}>
            <Scene state={state} received={received} me={seat} cars={cars} />
          </ErrorBoundary>
        ) : (
          noGl
        )}
        <Countdown time={s.time} />
        <Finish s={s} seat={seat} />
      </div>
      <header className="kalesa-top">
        <Standings s={s} seat={seat} cars={cars} names={names} />
        <Strip s={s} road={road} seat={seat} cars={cars} />
      </header>
      {car ? (
        <section className="kalesa-controls">
          <Hint s={s} seat={seat} road={road} color={color} />
          <DrawPad
            wheel={car.wheel}
            color={color}
            enabled={car.finish === null && !s.over}
            label={car.n === 0 ? 'Dessine une forme : elle devient tes roues' : undefined}
            urge={s.time >= 0 && scoreOn(segmentAt(road, Math.min(car.d, s.length - 0.01)).t, car.wheel) < 0.6}
            onWheel={(pts) => act({ type: 'wheel', pts } satisfies KalesaAction)}
          />
        </section>
      ) : (
        <p className="kalesa-watch">Tu regardes la course.</p>
      )}
    </div>
  );
}
