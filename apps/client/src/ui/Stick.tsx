import { useRef, useState, type PointerEvent } from 'react';

/** A thumb stick: drag from its centre; x right, y down, length up to 1. */
export function Stick({ className, onMove }: { className: string; onMove: (x: number, y: number) => void }) {
  const base = useRef<HTMLDivElement>(null!);
  const [knob, setKnob] = useState<[number, number]>([0, 0]);
  const pointer = useRef<number | null>(null);
  const move = (e: PointerEvent) => {
    if (pointer.current !== e.pointerId) return;
    const r = base.current.getBoundingClientRect();
    const radius = r.width / 2;
    let x = (e.clientX - r.left - radius) / radius;
    let y = (e.clientY - r.top - radius) / radius;
    const len = Math.hypot(x, y);
    if (len > 1) [x, y] = [x / len, y / len];
    setKnob([x, y]);
    onMove(x, y);
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
      className={className}
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

