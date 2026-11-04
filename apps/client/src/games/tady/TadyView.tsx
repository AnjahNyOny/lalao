import {
  altitudeAt,
  bodyOf,
  holding,
  MOUNTAIN,
  orchidTotal,
  PHYS,
  ropeFor,
  size,
  stageAt,
  step,
  touchingGrip,
  type Body,
  type Fx,
  type TadyAction,
  type TadyState,
} from '@game/games/tady';
import { useEffect, useRef, useState } from 'react';
import { Stick } from '../../ui/Stick';
import type { GameViewProps } from '../types';
import { paintMountain, T } from './art';
import { usePad } from './controls';
import { draw, type Particle, type Shown } from './draw';
import { hintFor } from './hints';
import { PAL, SCARVES } from './theme';

const { w: MW, h: MH } = size(MOUNTAIN);
const SEND_EVERY = 0.08;
/** Tiles across the screen: closer in portrait, so a phone shows big pixels. */
const ACROSS = { portrait: 13, landscape: 24 };
const STAGE_MS = 3500;
const touchScreen = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

let mountain: HTMLCanvasElement | null = null;
/** Painted once, the first time the game is shown. */
const mountainArt = () => (mountain ??= paintMountain(MOUNTAIN));

const shownOf = (c: TadyState['climbers'][number]): Shown => ({
  x: c.x,
  y: c.y,
  vx: c.vx,
  vy: c.vy,
  ground: c.ground,
  grab: c.grab,
  face: c.face,
  stamina: c.stamina,
  tired: c.tired,
  hanging: false,
  dragged: false,
});

/** A little burst of pixels for each event: dust, crumbs, an orchid's petals, confetti at the top. */
function burst(particles: Particle[], f: Fx): void {
  const colors: Record<Fx['t'], string[]> = {
    fall: PAL.dust,
    crumble: PAL.crumble,
    restore: ['#e8d8b8'],
    pick: [PAL.orchid[0], PAL.orchid[1], PAL.orchid[2]],
    camp: [PAL.fire[0], PAL.fire[1]],
    summit: [PAL.flag[0], PAL.flag[1], PAL.flag[2], PAL.fire[0]],
  };
  const count = f.t === 'summit' ? 60 : f.t === 'crumble' ? 18 : 12;
  for (let i = 0; i < count; i++) {
    const set = colors[f.t];
    particles.push({
      x: f.x * T + (Math.random() - 0.5) * 10,
      y: f.y * T + (Math.random() - 0.5) * 6,
      vx: (Math.random() - 0.5) * (f.t === 'summit' ? 90 : 50),
      vy: -Math.random() * (f.t === 'summit' ? 120 : 60),
      life: 0.6 + Math.random() * 0.6,
      color: set[i % set.length],
    });
  }
}

const clock = (ms: number) => {
  const sec = Math.floor(ms / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

export function TadyView({ view, me, room, act }: GameViewProps) {
  const s = view as TadyState;
  const state = useRef(s);
  state.current = s;
  const seat = s.players.indexOf(me);
  const pieces = s.players.map((id, i) => room.players.find((p) => p.id === id)?.piece ?? (i === 0 ? 'koto' : 'soa'));
  const piecesRef = useRef(pieces);
  piecesRef.current = pieces;
  const actRef = useRef(act);
  actRef.current = act;
  const { pad, setStick, jump, hold } = usePad();
  const canvas = useRef<HTMLCanvasElement>(null!);
  const [touch] = useState(touchScreen);
  /** Where each climber is drawn right now: the hints read it. */
  const shown = useRef<Shown[]>(s.climbers.map(shownOf));
  const stageShown = useRef({ stage: -1, at: 0 });

  useEffect(() => {
    const cv = canvas.current;
    const ctx = cv.getContext('2d')!;
    const art = document.createElement('canvas');
    const g = art.getContext('2d')!;
    let scale = 1;
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(cv.clientWidth * dpr);
      cv.height = Math.round(cv.clientHeight * dpr);
      const across = cv.clientWidth < cv.clientHeight ? ACROSS.portrait : ACROSS.landscape;
      scale = Math.max(1, Math.round(cv.width / (across * T)));
      art.width = Math.ceil(cv.width / scale);
      art.height = Math.ceil(cv.height / scale);
    };
    fit();
    const resize = new ResizeObserver(fit);
    resize.observe(cv);

    const first = state.current;
    let body: Body | null = seat >= 0 ? bodyOf(first.climbers[seat]) : null;
    let sync = seat >= 0 ? first.climbers[seat].sync : 0;
    let since = 0;
    let lastReport = '';
    let wasGrab = false;
    /** Moved by something else than this screen (a test driving the game): shown as it is, no physics of its own. */
    let driven = false;
    let sent: [number, number] = seat >= 0 ? [first.climbers[seat].x, first.climbers[seat].y] : [0, 0];
    const cam = { x: (first.climbers[0].x + first.climbers[1].x) / 2, y: (first.climbers[0].y + first.climbers[1].y) / 2 };
    const particles: Particle[] = [];
    const landed = [-1e9, -1e9];
    let seen = first.fx.at(-1)?.n ?? 0;
    let last = performance.now();
    let raf = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const raw = Math.min(0.25, (now - last) / 1000);
      last = now;
      const s = state.current;
      const view = shown.current;
      const grounded = view.map((v) => v.ground);

      if (body && seat >= 0) {
        const c = s.climbers[seat];
        const p = pad.current;
        const idle = Math.abs(p.mx) < 0.2 && Math.abs(p.my) < 0.5 && !p.jump && !p.grab && (body.ground || driven);
        if (c.sync !== sync) {
          // The server put us back (a refused report): start again from there.
          body = bodyOf(c);
          sync = c.sync;
          driven = false;
        } else if (idle && (driven || Math.hypot(c.x - sent[0], c.y - sent[1]) > 0.5)) {
          body = bodyOf(c);
          sent = [c.x, c.y];
          driven = true;
        }
        if (!idle) driven = false;
        const over = s.won || driven;
        const input = over ? { mx: 0, my: 0, jump: false, grab: false } : { mx: p.mx, my: p.my, jump: p.jump, grab: p.grab };
        p.jump = false;
        // A slow device still climbs in real time: a long frame becomes several short steps.
        const steps = Math.max(1, Math.ceil(raw * 60));
        const before = body;
        for (let i = 0; i < steps; i++) body = step(s, seat, body, i === 0 ? input : { ...input, jump: false }, raw / steps);
        if (!before.ground && body.ground && before.vy > 9) burst(particles, { n: 0, t: 'fall', x: body.x, y: body.y + PHYS.hh });
        since += raw;
        if (!over && (since >= SEND_EVERY || body.grab !== wasGrab)) {
          since = 0;
          wasGrab = body.grab;
          const reel = p.my < -0.5 ? 1 : p.my > 0.5 ? -1 : 0;
          const report = `${body.x.toFixed(3)},${body.y.toFixed(3)},${body.grab},${body.ground},${reel},${body.face}`;
          if (report !== lastReport) {
            lastReport = report;
            sent = [body.x, body.y];
            const action: TadyAction = { type: 'move', x: body.x, y: body.y, vx: body.vx, vy: body.vy, g: body.ground, h: body.grab, r: reel, f: body.face, s: sync };
            actRef.current(action);
          }
        }
        view[seat] = { x: body.x, y: body.y, vx: body.vx, vy: body.vy, ground: body.ground, grab: body.grab, face: body.face, stamina: body.stamina, tired: body.tired, hanging: body.hanging, dragged: body.dragged };
      }

      // The partner, where the server last saw them, a little ahead if moving, smoothed.
      s.climbers.forEach((c, i) => {
        if (i === seat) return;
        const v = view[i];
        const age = c.grab ? 0 : Math.min(0.2, (s.time - c.at) / 1000);
        const tx = c.x + c.vx * age;
        const ty = c.y + c.vy * age;
        const k = Math.hypot(tx - v.x, ty - v.y) > 3 ? 1 : 1 - Math.exp(-raw * 18);
        const other = view[1 - i];
        const x = v.x + (tx - v.x) * k;
        const y = v.y + (ty - v.y) * k;
        const hanging = holding(other, { x, y, ground: c.ground, grab: c.grab }, ropeFor(s.rope, y, other.y));
        const dragged = c.ground && !c.grab && holding({ x, y }, other, ropeFor(s.rope, other.y, y));
        view[i] = { x, y, vx: c.vx, vy: c.vy, ground: c.ground, grab: c.grab, face: c.face, stamina: c.stamina, tired: c.tired, hanging, dragged };
      });

      // Little signs of life: squashed on landing, dust underfoot, sweat when holding on hurts.
      view.forEach((v, i) => {
        if (v.ground && !grounded[i]) landed[i] = now;
        if (v.ground && Math.abs(v.vx) > 3 && Math.random() < raw * 9) {
          particles.push({ x: v.x * T - v.vx * 1.5, y: (v.y + PHYS.hh) * T - 1, vx: -v.vx * 3, vy: -12 - Math.random() * 14, life: 0.25 + Math.random() * 0.2, color: PAL.dust[i % 2] });
        }
        if ((v.grab || v.tired) && v.stamina < 0.55 && Math.random() < raw * 5) {
          const side = Math.random() < 0.5 ? -1 : 1;
          particles.push({ x: v.x * T + side * 5, y: (v.y - 0.25) * T, vx: side * (14 + Math.random() * 16), vy: -30 - Math.random() * 20, life: 0.45, color: PAL.strength[4] });
        }
      });

      for (const f of s.fx) {
        if (f.n <= seen) continue;
        seen = f.n;
        burst(particles, f);
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const q = particles[i];
        q.life -= raw;
        q.vy += 220 * raw;
        q.x += q.vx * raw;
        q.y += q.vy * raw;
        if (q.life <= 0) particles.splice(i, 1);
      }

      // The camera keeps both in view: they're never more than a rope apart.
      const vw = art.width / T;
      const vh = art.height / T;
      // In portrait the thumbs cover the bottom: the climbers sit a little above the middle.
      const lift = art.height > art.width ? vh * 0.1 : 0;
      const k = 1 - Math.exp(-raw * 5);
      cam.x += ((view[0].x + view[1].x) / 2 - cam.x) * k;
      cam.y += ((view[0].y + view[1].y) / 2 - 0.6 + lift - cam.y) * k;
      const x = vw < MW ? Math.max(vw / 2, Math.min(MW - vw / 2, cam.x)) : MW / 2;
      // A little rock below the valley floor, more in portrait where the thumbs cover the bottom.
      const y = Math.min(MH - vh / 2 + (lift ? vh * 0.25 : 0.4), cam.y);

      draw(g, art.width, art.height, mountainArt(), { s, shown: view, pieces: piecesRef.current, t: now, cam: { x, y }, particles, landed });
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(art, 0, 0, art.width * scale, art.height * scale);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
    };
  }, [seat, pad]);

  const mine = seat >= 0 ? seat : 0;
  const now = shown.current;
  const higher = Math.min(now[0].y, now[1].y);
  const stage = stageAt(MOUNTAIN, higher);
  if (stageShown.current.stage !== stage) stageShown.current = { stage, at: Date.now() };
  const banner = s.won
    ? { top: 'Au sommet du Pic Boby !', main: `${clock(s.time)} · ${s.falls} chute${s.falls > 1 ? 's' : ''} · ✿ ${s.picked.length}/${orchidTotal()}` }
    : Date.now() - stageShown.current.at < STAGE_MS
      ? { top: `Étape ${stage + 1}/${MOUNTAIN.stages.length}`, main: MOUNTAIN.stages[stage].name }
      : null;

  return (
    <div className="game-stage tady">
      <canvas ref={canvas} className="tady-canvas" aria-label="La montagne" />
      <div className="tady-top">
        <div className="tady-who">
          {s.players.map((id, i) => {
            const scarf = SCARVES[pieces[i]] ?? SCARVES.koto;
            const name = room.players.find((p) => p.id === id)?.name ?? scarf.name;
            return (
              <span key={id} style={{ color: scarf.main }}>
                ■ {i === seat ? `Toi (${scarf.name})` : `${name} (${scarf.name})`}
              </span>
            );
          })}
        </div>
        <div className="tady-stats">
          <span>{altitudeAt(MOUNTAIN, now[mine].y).toLocaleString('fr-FR')} m</span>
          <span>
            ✿ {s.picked.length}/{orchidTotal()} · chutes {s.falls}
          </span>
        </div>
      </div>
      {seat >= 0 && <p className="tady-hint">{hintFor(s, now[seat], now[1 - seat])}</p>}
      {banner && (
        <div className="tady-banner" key={banner.main}>
          <span>{banner.top}</span>
          <strong>{banner.main}</strong>
        </div>
      )}
      {seat < 0 ? null : touch ? (
        <>
          <Stick className="tady-stick" onMove={setStick} />
          <div className="tady-buttons">
            <button
              className={`tady-grip${now[seat].tired ? ' tired' : now[seat].grab ? ' holding' : touchingGrip(now[seat]) ? ' ready' : ''}`}
              style={{ ['--force' as string]: now[seat].stamina.toFixed(2) }}
              onPointerDown={(e) => {
                e.preventDefault();
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                hold(true);
              }}
              onPointerUp={() => hold(false)}
              onPointerCancel={() => hold(false)}
            >
              S’agripper
            </button>
            <button
              className="tady-jump"
              onPointerDown={(e) => {
                e.preventDefault();
                jump();
              }}
            >
              Sauter
            </button>
          </div>
        </>
      ) : (
        <p className="tady-keys">Flèches ou ZQSD · Espace : sauter · Maj : s’agripper (maintenir) · Haut, bas : la corde · Gauche, droite pendu : se balancer</p>
      )}
    </div>
  );
}
