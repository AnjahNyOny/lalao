import { makeWheel, MAX_STROKE, PAD, type Wheel } from '@game/games/kalesa';
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { PAD_COLORS } from './theme';

interface Props {
  /** The wheel the car has now, shown faintly under the pen. */
  wheel: Wheel;
  /** The player's colour: the ink. */
  color: string;
  enabled: boolean;
  /** Shown over the paper (how to play, before the first wheel). */
  label?: string;
  /** The wheel slips: the pad calls for a new one. */
  urge?: boolean;
  onWheel: (stroke: number[]) => void;
}

type Pt = [number, number];
const FADE_MS = 450;

/** Pad units (-PAD..PAD, y up) to the canvas's pixels, and back. */
const toPx = (u: number, v: number, size: number): Pt => [((u / PAD + 1) / 2) * size, ((1 - v / PAD) / 2) * size];
const toPad = (x: number, y: number, size: number): Pt => [
  Math.max(-PAD, Math.min(PAD, Math.round(((2 * x) / size - 1) * PAD))),
  Math.max(-PAD, Math.min(PAD, Math.round((1 - (2 * y) / size) * PAD))),
];

/**
 * The square the wheels are drawn in. Whatever is traced becomes the
 * car's wheels when the finger lifts; the shape it has now shows under the pen.
 */
export function DrawPad({ wheel, color, enabled, label, urge, onWheel }: Props) {
  const box = useRef<HTMLDivElement>(null!);
  const canvas = useRef<HTMLCanvasElement>(null!);
  const size = useRef(0);
  const stroke = useRef<Pt[] | null>(null);
  const sent = useRef<{ pts: Pt[]; at: number } | null>(null);
  const pointer = useRef<number | null>(null);
  const frame = useRef(0);
  /** When a stroke was last too small to be a wheel: says so for a moment. */
  const [refused, setRefused] = useState<number | null>(null);
  useEffect(() => {
    if (refused === null) return;
    const t = setTimeout(() => setRefused(null), 1500);
    return () => clearTimeout(t);
  }, [refused]);
  const current = useRef(wheel);
  current.current = wheel;

  const draw = useCallback(() => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!ctx) return;
    const S = size.current;
    const dpr = c.width / Math.max(1, S);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PAD_COLORS.paper;
    ctx.fillRect(0, 0, S, S);
    // Squared paper, a dot for the hub, a ring for the biggest wheel.
    ctx.strokeStyle = PAD_COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 1; k < 8; k++) {
      ctx.moveTo((k * S) / 8, 0);
      ctx.lineTo((k * S) / 8, S);
      ctx.moveTo(0, (k * S) / 8);
      ctx.lineTo(S, (k * S) / 8);
    }
    ctx.stroke();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = PAD_COLORS.guide;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = PAD_COLORS.guide;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    const line = (pts: Pt[], width: number, style: string, close = false) => {
      if (pts.length < 2) return;
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
      if (close) ctx.closePath();
      ctx.stroke();
    };
    // The wheel the car has now.
    const w = current.current;
    const ghost: Pt[] = [];
    for (let i = 0; i + 1 < w.pts.length; i += 2) ghost.push(toPx(w.pts[i], w.pts[i + 1], S));
    ctx.globalAlpha = 0.55;
    line(ghost, Math.max(3, S / 60), PAD_COLORS.ghost, w.closed);
    ctx.globalAlpha = 1;
    // The one just sent, fading as it becomes the car's.
    const fading = sent.current;
    if (fading) {
      const t = (performance.now() - fading.at) / FADE_MS;
      if (t < 1) {
        ctx.globalAlpha = 1 - t;
        line(fading.pts, S / 26, color);
        ctx.globalAlpha = 1;
      } else sent.current = null;
    }
    if (stroke.current) {
      line(stroke.current, S / 26 + 2, PAD_COLORS.ink);
      line(stroke.current, S / 26, color);
    }
    if (sent.current) frame.current = requestAnimationFrame(draw);
  }, [color]);

  // Sized to its box, sharp on high-density screens.
  useEffect(() => {
    const fit = () => {
      const S = box.current.clientWidth;
      size.current = S;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.current.width = Math.round(S * dpr);
      canvas.current.height = Math.round(S * dpr);
      draw();
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, [draw]);
  useEffect(draw, [wheel, draw]);

  const at = (e: PointerEvent): Pt => {
    const r = canvas.current.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const down = (e: PointerEvent) => {
    if (!enabled || pointer.current !== null) return;
    e.preventDefault();
    pointer.current = e.pointerId;
    canvas.current.setPointerCapture(e.pointerId);
    stroke.current = [at(e)];
    draw();
  };
  const move = (e: PointerEvent) => {
    if (pointer.current !== e.pointerId || !stroke.current) return;
    const events = (e.nativeEvent as globalThis.PointerEvent).getCoalescedEvents?.() ?? [e.nativeEvent];
    const r = canvas.current.getBoundingClientRect();
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const p: Pt = [ev.clientX - r.left, ev.clientY - r.top];
      const last = stroke.current[stroke.current.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 2) stroke.current.push(p);
    }
    draw();
  };
  const up = (e: PointerEvent) => {
    if (pointer.current !== e.pointerId) return;
    pointer.current = null;
    const pts = stroke.current ?? [];
    stroke.current = null;
    // Thin out a long stroke, keeping its last point.
    const every = Math.ceil(pts.length / MAX_STROKE);
    const kept = pts.filter((_, i) => i % every === 0 || i === pts.length - 1);
    const flat = kept.flatMap(([x, y]) => toPad(x, y, size.current));
    if (e.type === 'pointercancel' || kept.length < 2 || !makeWheel(flat)) {
      setRefused(performance.now());
      draw();
      return;
    }
    onWheel(flat);
    sent.current = { pts: kept, at: performance.now() };
    draw();
  };

  return (
    <div className={`kalesa-pad${enabled ? '' : ' off'}${urge && enabled ? ' urge' : ''}`} ref={box}>
      <canvas ref={canvas} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Dessine ta roue" />
      {label && enabled && <span className="kalesa-pad-label">{label}</span>}
      {refused !== null && (
        <span className="kalesa-pad-refused" key={refused}>
          Trop petit : dessine plus grand
        </span>
      )}
    </div>
  );
}
