import { hubHeight, PAD, roadOf, scoreOn, segmentAt, standings, startsOf, traits, type KalesaState, type Terrain, type TrackDef } from '@game/games/kalesa';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { memo, Suspense, useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Model, Scatter } from '../tsena/assets';
import type { Placement } from '../tsena/map';
import { CAR_LOOKS } from './cars';
import { bumpsOn, FORD_DEPTH, groundAt, laneOf, LANE, ROAD_W, scatter, WHEEL_M, wheelGeometry } from './road';
import { FX, LANDS, ROAD, SCENE, type Land } from './theme';

/** Built by assets/blender/kalesa_assets.py; trees, zebus and the tsingy come from Tsena's file. */
const URL = '/models/kalesa.glb';
// Fetched as soon as the app loads, like Tsena's models.
if (typeof window !== 'undefined') useLoader.preload(GLTFLoader, URL);

export interface SceneProps {
  /** The latest state, read every frame. */
  state: MutableRefObject<KalesaState>;
  /** When it arrived (performance.now()): cars are drawn a little ahead of it, at their speed. */
  received: MutableRefObject<number>;
  /** This screen's seat, -1 for someone watching. */
  me: number;
  /** Each seat's car. */
  cars: string[];
}

/** Where a car is drawn: smoothed, between the server's reports. */
interface Vis {
  placed: boolean;
  d: number;
  lastD: number;
  y: number;
  pitch: number;
  /** How far the wheels have turned. */
  phi: number;
  /** The wheel on screen (its number), and how long since it popped in. */
  n: number;
  pop: number;
  done: boolean;
  spray: number;
}

/** Terrains where a poor wheel spins without getting anywhere. */
const SLIPPY = new Set<Terrain>(['glissant', 'boue', 'sable', 'gue']);
/** What flies off the wheels. */
const SPRAY = new Set<Terrain>(['glissant', 'boue', 'sable', 'gue', 'rochers']);

export const Scene = memo(function Scene(props: SceneProps) {
  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ fov: 40, near: 0.5, far: 230, position: [-10, 8, 16] }} gl={{ antialias: true }}>
      <Quality />
      <Suspense fallback={null}>
        <World {...props} />
      </Suspense>
    </Canvas>
  );
});

/** Drawn in software (no graphics chip): straight to the cheapest look. */
function software(gl: THREE.WebGLRenderer): boolean {
  const ctx = gl.getContext();
  const info = ctx.getExtension('WEBGL_debug_renderer_info');
  const name = String(info ? ctx.getParameter(info.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER));
  return /swiftshader|llvmpipe|software/i.test(name);
}

/**
 * Keeps the race smooth on a modest phone: if frames come too slowly, first
 * fewer pixels, then no shadows.
 */
function Quality() {
  const { gl, scene, setDpr } = useThree();
  const watch = useRef({ time: 0, frames: 0, level: 2 });
  const lower = (level: number) => {
    const w = watch.current;
    if (level >= w.level) return;
    if (level < 2) setDpr(1);
    if (level < 1) {
      gl.shadowMap.enabled = false;
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        for (const x of Array.isArray(m) ? m : m ? [m] : []) x.needsUpdate = true;
      });
    }
    w.level = level;
  };
  useEffect(() => {
    if (software(gl)) lower(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);
  useFrame((_, dt) => {
    const w = watch.current;
    w.time += dt;
    w.frames++;
    if (w.time < 2.5) return;
    if (w.frames / w.time < 22) lower(w.level - 1);
    w.time = 0;
    w.frames = 0;
  });
  return null;
}

const approach = (from: number, to: number, dt: number, rate: number) => from + (to - from) * (1 - Math.exp(-dt * rate));
const easeOutBack = (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;

function World({ state, received, me, cars }: SceneProps) {
  const course = state.current.course;
  const road = useMemo(() => roadOf(state.current), [course.track, course.seed, course.sprint]); // eslint-disable-line react-hooks/exhaustive-deps
  const length = state.current.length;
  const land = LANDS[road.look];
  // This screen's car in the nearest lane, the others behind it in seat order.
  const lanes = useMemo(() => {
    const order = cars.map((_, seat) => seat).sort((a, b) => (a === me ? -1 : b === me ? 1 : a - b));
    const out: number[] = [];
    order.forEach((seat, k) => (out[seat] = laneOf(k, cars.length)));
    return out;
  }, [cars, me]);
  const vis = useRef<Vis[]>(cars.map(() => ({ placed: false, d: 0, lastD: 0, y: 0.4, pitch: 0, phi: 0, n: -1, pop: 1, done: false, spray: 0 })));
  const emitter = useRef<Emit>(() => {});
  // Whom the camera follows: this screen's car, or the leader for someone watching.
  const follow = () => (me >= 0 ? me : standings(state.current)[0]);
  return (
    <>
      <color attach="background" args={[land.sky]} />
      <fog attach="fog" args={[land.fog, 60, 190]} />
      <Lights vis={vis} follow={follow} land={land} />
      <Ground road={road} length={length} land={land} />
      <Road road={road} length={length} />
      <Scenery road={road} length={length} />
      {cars.map((id, seat) => (
        <Car key={seat} seat={seat} id={id} lane={lanes[seat]} road={road} state={state} received={received} vis={vis} emit={emitter} />
      ))}
      <Particles emitter={emitter} />
      <CameraRig vis={vis} lanes={lanes} follow={follow} />
    </>
  );
}

function CameraRig({ vis, lanes, follow }: { vis: MutableRefObject<Vis[]>; lanes: number[]; follow: () => number }) {
  const { camera, size } = useThree();
  const look = useMemo(() => new THREE.Vector3(), []);
  const want = useMemo(() => new THREE.Vector3(), []);
  const placed = useRef(false);
  useFrame((_, dt) => {
    const seat = follow();
    const v = vis.current[seat];
    if (!v?.placed) return;
    // Taller than wide: from further behind the car, so the road ahead runs up the screen.
    const aspect = size.width / size.height;
    const tall = Math.min(1, Math.max(0, (1.5 - aspect) / 0.7));
    const yaw = 0.42 + 0.42 * tall;
    const dist = 17 + 1.5 * tall;
    want.set(v.d + 6 - 1.5 * tall, 0.6 + v.y * 0.3, lanes[seat] - 1.5);
    if (!placed.current) look.copy(want);
    else look.lerp(want, 1 - Math.exp(-dt * 5));
    placed.current = true;
    camera.position.set(look.x - Math.sin(yaw) * dist, look.y + 6.5 + 2 * tall, look.z + Math.cos(yaw) * dist);
    camera.lookAt(look);
  });
  return null;
}

function Lights({ vis, follow, land }: { vis: MutableRefObject<Vis[]>; follow: () => number; land: Land }) {
  const sun = useRef<THREE.DirectionalLight>(null!);
  const target = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const x = vis.current[follow()]?.d ?? 0;
    target.position.set(x + 6, 0, 0);
    sun.current.position.set(x - 4, 22, 14);
  });
  return (
    <>
      <hemisphereLight args={land.hemi} />
      <primitive object={target} />
      <directionalLight
        ref={sun}
        target={target}
        intensity={land.sun}
        color={land.sunColor}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0006}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-camera-near={1}
        shadow-camera-far={70}
      />
    </>
  );
}

/** One colour per instance, set once. */
function useInstances(ref: MutableRefObject<THREE.InstancedMesh>, items: { m: THREE.Matrix4; c?: string }[]) {
  useLayoutEffect(() => {
    if (!ref.current) return;
    const color = new THREE.Color();
    items.forEach((it, i) => {
      ref.current.setMatrixAt(i, it.m);
      if (it.c) ref.current.setColorAt(i, color.set(it.c));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [ref, items]);
}

const mat = (x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));

/** Things are drawn in stretches this long, so that what's off screen (or out of the sun's view) isn't drawn at all. */
const CHUNK = 60;

function chunks<T>(items: T[], x: (t: T) => number): T[][] {
  const out = new Map<number, T[]>();
  for (const it of items) {
    const k = Math.floor(x(it) / CHUNK);
    let list = out.get(k);
    if (!list) out.set(k, (list = []));
    list.push(it);
  }
  return [...out.values()];
}

/** Many copies of a model along the road, a stretch at a time. */
function Spread({ name, url, items }: { name: string; url?: string; items: Placement[] }) {
  const parts = useMemo(() => chunks(items, (p) => p.x), [items]);
  return (
    <>
      {parts.map((list, i) => (
        <Scatter key={i} name={name} url={url} items={list} />
      ))}
    </>
  );
}

/** Boxes, a stretch of road at a time. */
function BoxRuns(props: { items: { m: THREE.Matrix4; c: string }[]; shadows?: boolean }) {
  const parts = useMemo(() => chunks(props.items, (it) => it.m.elements[12]), [props.items]);
  return (
    <>
      {parts.map((list, i) => (
        <Boxes key={i} {...props} items={list} />
      ))}
    </>
  );
}

/** Boxes, each its own size and colour, in one draw call. */
function Boxes({ items, shadows = true }: { items: { m: THREE.Matrix4; c: string }[]; shadows?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  useInstances(ref, items);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} receiveShadow castShadow={shadows} key={items.length}>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial flatShading />
    </instancedMesh>
  );
}

/** Flat discs: puddles, potholes. */
function Discs({ items, color, roughness }: { items: { m: THREE.Matrix4 }[]; color: string; roughness: number }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  useInstances(ref, items);
  if (!items.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} receiveShadow key={items.length}>
      <cylinderGeometry args={[1, 1, 1, 12]} />
      <meshStandardMaterial flatShading color={color} roughness={roughness} />
    </instancedMesh>
  );
}

/** Where rivers cross the road (with their banks): nothing grows or stands there. */
function riversOf(road: TrackDef): [number, number][] {
  const starts = startsOf(road);
  return road.segments.flatMap((seg, i): [number, number][] => (seg.t === 'gue' ? [[starts[i] - RIVER_BANK, starts[i] + seg.len + RIVER_BANK]] : []));
}
const RIVER_BANK = 2;
const inRiver = (rivers: [number, number][], x: number, margin = 0) => rivers.some(([a, b]) => x > a - margin && x < b + margin);

/** The land on both sides, cut where a river runs across, and the hills far off. */
function Ground({ road, length, land }: { road: TrackDef; length: number; land: Land }) {
  const rivers = useMemo(() => riversOf(road), [road]);
  // The land between the rivers.
  const stretches = useMemo(() => {
    const out: [number, number][] = [];
    let from = -300;
    for (const [a, b] of rivers) {
      out.push([from, a]);
      from = b;
    }
    out.push([from, length + 300]);
    return out;
  }, [rivers, length]);
  const items = useMemo(() => {
    const out: { m: THREE.Matrix4; c: string }[] = [];
    // Patches of a few greens (or ochres) along both sides.
    for (const { x, f } of scatter(11, -80, length + 160, 18)) {
      if (inRiver(rivers, x, 16)) continue;
      for (const side of [1, -1]) {
        const z = side * (ROAD_W + 10 + f[1] * 50);
        out.push({ m: mat(x, -0.06, z, 14 + f[2] * 16, 0.1, 12 + f[1] * 14, f[2]), c: land.ground[Math.floor(f[2] * land.ground.length) % land.ground.length] });
      }
    }
    return out;
  }, [length, land, rivers]);
  const hills = useMemo(() => {
    const out: Placement[] = [];
    for (const { x, f } of scatter(23, -100, length + 250, 26)) out.push({ x, z: -110 - f[1] * 60, rot: f[2] * 6, scale: 18 + f[0] * 22, sy: 0.4 + f[2] * 0.5 });
    return out;
  }, [length]);
  const hillRef = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    hills.forEach((h, i) => hillRef.current.setMatrixAt(i, mat(h.x, 0, h.z, h.scale, h.scale * (h.sy ?? 1), h.scale, h.rot)));
    hillRef.current.instanceMatrix.needsUpdate = true;
    hillRef.current.computeBoundingSphere();
  }, [hills]);
  return (
    <>
      {stretches.map(([a, b]) => (
        <mesh key={a} position={[(a + b) / 2, -0.1, 0]} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[b - a, 500]} />
          <meshLambertMaterial color={land.ground[0]} />
        </mesh>
      ))}
      {rivers.map(([a, b]) => (
        // The river's bed, and its banks.
        <group key={a}>
          <mesh position={[(a + b) / 2, -0.75, 0]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[b - a, 500]} />
            <meshLambertMaterial color={SCENE.riverBed} />
          </mesh>
          {[a, b].map((x) => (
            <mesh key={x} position={[x, -0.42, 0]}>
              <boxGeometry args={[0.3, 0.64, 500]} />
              <meshLambertMaterial color={land.ground[0]} />
            </mesh>
          ))}
        </group>
      ))}
      <BoxRuns items={items} shadows={false} />
      <instancedMesh ref={hillRef} args={[undefined, undefined, hills.length]}>
        <coneGeometry args={[1, 1, 7]} />
        <meshLambertMaterial flatShading color={land.hills} />
      </instancedMesh>
    </>
  );
}

/** The road itself: one stretch per terrain, with what belongs on each. */
function Road({ road, length }: { road: TrackDef; length: number }) {
  const parts = useMemo(() => {
    const starts = startsOf(road);
    const slabs: { m: THREE.Matrix4; c: string }[] = [];
    const marks: { m: THREE.Matrix4; c: string }[] = [];
    const puddles: { m: THREE.Matrix4 }[] = [];
    const mud: { m: THREE.Matrix4 }[] = [];
    const holes: { m: THREE.Matrix4 }[] = [];
    const rocks: Record<string, Placement[]> = { rock_a: [], rock_b: [], rock_c: [] };
    const fords: { from: number; to: number }[] = [];
    road.segments.forEach((seg, i) => {
      const from = starts[i];
      const to = from + seg.len;
      const c = ROAD[seg.t];
      const top = seg.t === 'gue' ? -FORD_DEPTH : 0;
      slabs.push({ m: mat((from + to) / 2, top - 0.3, 0, seg.len + 0.02, 0.6, 2 * ROAD_W), c: c.top });
      // Kerbs along the edges.
      for (const s of [1, -1]) slabs.push({ m: mat((from + to) / 2, top - 0.25, s * (ROAD_W + 0.3), seg.len + 0.02, 0.6, 0.6), c: c.side });
      if (seg.t === 'goudron') {
        for (let x = from + 1; x < to - 2; x += 4) for (let k = 1; k < 4; k++) marks.push({ m: mat(x + 1, 0.01, (k - 2) * LANE, 2, 0.02, 0.14), c: c.detail });
        for (const s of [1, -1]) marks.push({ m: mat((from + to) / 2, 0.01, s * (ROAD_W - 0.35), seg.len - 1, 0.02, 0.14), c: c.detail });
      } else if (seg.t === 'glissant' || seg.t === 'boue') {
        for (const { x, f } of scatter(i * 31 + 5, from + 2, to - 2, 3.2)) {
          const r = 0.6 + f[1] * 1.0;
          (seg.t === 'boue' ? mud : puddles).push({ m: mat(x, 0.01, (f[2] - 0.5) * 2 * (ROAD_W - 1.4), r * 1.5, 0.02, r, f[0] * 3) });
        }
        // Ruts: the tracks of those who went before.
        for (let k = 0; k < 4; k++) for (const s of [-0.8, 0.8]) marks.push({ m: mat((from + to) / 2, 0.005, (1.5 - k) * LANE + s, seg.len - 1, 0.01, 0.22), c: c.detail });
      } else if (seg.t === 'trous') {
        for (const b of bumpsOn('trous', from, to)) holes.push({ m: mat(b.x, 0.01, b.z, b.r, 0.02, b.r * 0.85) });
      } else if (seg.t === 'rochers') {
        bumpsOn('rochers', from, to).forEach((b, k) =>
          rocks[['rock_a', 'rock_b', 'rock_c'][k % 3]].push({ x: b.x, z: b.z, rot: k * 1.7, scale: b.r * 1.5, sy: 0.75 }),
        );
      } else if (seg.t === 'sable') {
        for (let x = from + 1; x < to - 1; x += 1.4) {
          for (let k = 0; k < 4; k++) {
            const z = -ROAD_W + 1.6 + k * 3.1 + Math.sin(x * 1.7 + k) * 0.6;
            marks.push({ m: mat(x + Math.sin(x * 3.1 + k * 2) * 0.35, 0.01, z, 0.16, 0.03, 2.2, 0.25 * Math.sin(x + k)), c: c.detail });
          }
        }
      } else if (seg.t === 'gue') {
        fords.push({ from, to });
        // Wooden stakes mark the way across.
        for (let x = from + 2; x < to - 1; x += 6) for (const s of [1, -1]) slabs.push({ m: mat(x, -0.1, s * (ROAD_W - 0.2), 0.16, 0.9, 0.16), c: SCENE.stake });
      }
    });
    // Tarmac before the start and past the finish.
    for (const [from, to] of [
      [-40, 0],
      [length, length + 60],
    ]) {
      slabs.push({ m: mat((from + to) / 2, -0.3, 0, to - from, 0.6, 2 * ROAD_W), c: ROAD.goudron.top });
      for (const s of [1, -1]) slabs.push({ m: mat((from + to) / 2, -0.25, s * (ROAD_W + 0.3), to - from, 0.6, 0.6), c: ROAD.goudron.side });
    }
    // Chequered lines at the start and the finish.
    for (const x0 of [0, length]) {
      for (let k = 0; k < 26; k++) {
        for (let j = 0; j < 2; j++) {
          marks.push({ m: mat(x0 - 0.25 - j * 0.5, 0.015, -ROAD_W + 0.25 + k * 0.5, 0.5, 0.02, 0.5), c: (k + j) % 2 ? SCENE.checkerDark : SCENE.checkerLight });
        }
      }
    }
    return { slabs, marks, puddles, mud, holes, rocks, fords };
  }, [road, length]);
  return (
    <>
      <BoxRuns items={parts.slabs} />
      <BoxRuns items={parts.marks} shadows={false} />
      {[
        [parts.puddles, SCENE.puddle, 0.15],
        [parts.mud, SCENE.mudPuddle, 0.25],
        [parts.holes, ROAD.trous.detail, 0.6],
      ].map(([items, color, roughness], k) =>
        chunks(items as { m: THREE.Matrix4 }[], (it) => it.m.elements[12]).map((list, i) => <Discs key={`${k}-${i}`} items={list} color={color as string} roughness={roughness as number} />),
      )}
      {Object.entries(parts.rocks).map(([name, items]) => items.length > 0 && <Spread key={name} name={name} url={URL} items={items} />)}
      {parts.fords.map((f, i) => (
        <Ford key={i} {...f} />
      ))}
      <Model name="finish_arch" url={URL} position={[length, 0, 0]} rotation-y={Math.PI / 2} />
    </>
  );
}

/** A river across the road and the land round it: over the ford, the road's bed shows through. */
function Ford({ from, to }: { from: number; to: number }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    ref.current.position.y = -0.13 + Math.sin(clock.elapsedTime * 1.3) * 0.02;
  });
  return (
    <mesh ref={ref} position={[(from + to) / 2, -0.13, 0]} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[to - from + 2 * RIVER_BANK, 500]} />
      <meshStandardMaterial color={SCENE.water} transparent opacity={0.7} roughness={0.2} />
    </mesh>
  );
}

/** What stands along the road: it depends on the region, and on the stretch (rice fields by the mud). */
function Scenery({ road, length }: { road: TrackDef; length: number }) {
  const placed = useMemo(() => {
    const rivers = riversOf(road);
    const kalesa: Record<string, Placement[]> = { borne: [], eucalyptus: [], pine: [], house_merina: [], sarety: [], charcoal: [], rock_a: [], rock_b: [] };
    const tsena: Record<string, Placement[]> = { baobab: [], palm: [], ravinala: [], tsingy: [], pawn_zebu: [], hut: [] };
    const paddies: { m: THREE.Matrix4; c: string }[] = [];
    const far = (f: number, near = 10, span = 30) => -(ROAD_W + near + f * span);
    const look = road.look;
    // Kilometre stones on the near side, every hundred metres.
    for (let x = 100; x < length; x += 100) if (!inRiver(rivers, x, 2)) kalesa.borne.push({ x, z: ROAD_W + 1.2, rot: Math.PI / 2, scale: 1 });
    // Trees and houses beyond the road.
    for (const { x, f } of scatter(3, -60, length + 120, 5.5)) {
      if (inRiver(rivers, x, 4)) continue;
      const z = far(f[1], 6, 34);
      const rot = f[2] * 6.28;
      if (look === 'hautes') {
        if (f[0] < 0.1) kalesa.house_merina.push({ x, z: far(f[1], 9, 18), rot: Math.PI / 2 + (f[2] - 0.5) * 0.4, scale: 1.3 });
        else if (f[0] < 0.55) kalesa.eucalyptus.push({ x, z, rot, scale: 1.4 + f[2] * 0.8 });
        else kalesa.pine.push({ x, z, rot, scale: 1.2 + f[2] * 0.9 });
      } else if (look === 'ouest') {
        if (f[0] < 0.5) tsena.baobab.push({ x, z: far(f[1], 8, 40), rot, scale: 6 + f[2] * 4 });
        else if (f[0] < 0.8) tsena.palm.push({ x, z, rot, scale: 4 + f[2] * 2 });
        else tsena.hut.push({ x, z: far(f[1], 8, 20), rot: Math.PI / 2, scale: 3 });
      } else {
        if (f[0] < 0.5) tsena.tsingy.push({ x, z: far(f[1], 6, 36), rot, scale: 4 + f[2] * 5, sy: 1.3 });
        else if (f[0] < 0.75) tsena.ravinala.push({ x, z, rot: Math.PI / 2, scale: 5 + f[2] * 2 });
        else if (f[0] < 0.9) tsena.palm.push({ x, z, rot, scale: 4 + f[2] * 2 });
        else tsena.baobab.push({ x, z: far(f[1], 12, 30), rot, scale: 5 + f[2] * 3 });
      }
    }
    // Zebus grazing, a cart on the verge, charcoal for sale.
    for (const { x, f } of scatter(7, 20, length, 45)) {
      if (inRiver(rivers, x, 5)) continue;
      if (f[0] < 0.5) tsena.pawn_zebu.push({ x, z: far(f[1], 4, 14), rot: f[2] * 6.28, scale: 2.4 });
      else if (f[0] < 0.75) kalesa.sarety.push({ x, z: -(ROAD_W + 3.2), rot: 0, scale: 1 });
      else if (look === 'hautes') kalesa.charcoal.push({ x, z: -(ROAD_W + 2.2), rot: f[2] * 6, scale: 1.2 });
      else kalesa.rock_a.push({ x, z: -(ROAD_W + 2.5), rot: f[2] * 6, scale: 1.6 });
    }
    // Low things on the near side, where nothing may hide the cars: rice fields in the highlands, stones elsewhere.
    const starts = startsOf(road);
    road.segments.forEach((seg, i) => {
      const from = starts[i];
      const wet = seg.t === 'boue' || seg.t === 'glissant' || seg.t === 'gue';
      for (const { x, f } of scatter(i * 13 + 1, from, from + seg.len, 9)) {
        if (inRiver(rivers, x, 5)) continue;
        if (look === 'hautes' && (wet || f[0] < 0.4)) {
          for (const side of [1, -1]) {
            const z = side * (ROAD_W + 4.5 + f[1] * 3);
            paddies.push({ m: mat(x, -0.04, z, 8, 0.08, 6, 0), c: SCENE.dyke });
            paddies.push({ m: mat(x, -0.01, z, 7.4, 0.08, 5.4, 0), c: f[2] < 0.4 ? SCENE.paddyWater : SCENE.rice[Math.floor(f[2] * 3) % 3] });
          }
        } else if (f[0] < 0.3) kalesa.rock_b.push({ x, z: ROAD_W + 2 + f[1] * 3, rot: f[2] * 6, scale: 0.45 + 0.5 * f[2] });
        else if (f[0] < 0.6) paddies.push({ m: mat(x, -0.02, ROAD_W + 2.5 + f[1] * 4, 3 + f[2] * 3, 0.06, 2, f[2]), c: look === 'ouest' ? SCENE.dryGrass : SCENE.grass });
      }
    });
    return { kalesa, tsena, paddies };
  }, [road, length]);
  return (
    <>
      {Object.entries(placed.kalesa).map(([name, items]) => items.length > 0 && <Spread key={name} name={name} url={URL} items={items} />)}
      {Object.entries(placed.tsena).map(([name, items]) => items.length > 0 && <Spread key={name} name={name} items={items} />)}
      {placed.paddies.length > 0 && <BoxRuns items={placed.paddies} shadows={false} />}
    </>
  );
}

type Emit = (x: number, y: number, z: number, color: string, count: number, power?: number) => void;

interface CarProps {
  seat: number;
  id: string;
  lane: number;
  road: TrackDef;
  state: MutableRefObject<KalesaState>;
  received: MutableRefObject<number>;
  vis: MutableRefObject<Vis[]>;
  emit: MutableRefObject<Emit>;
}

// Both sides: a drawn ribbon can turn either way.
const tyreMaterial = new THREE.MeshStandardMaterial({ color: SCENE.tyre, flatShading: true, roughness: 0.9, side: THREE.DoubleSide });
const hubMaterials = new Map<string, THREE.MeshStandardMaterial>();
const hubMaterial = (color: string) => {
  let m = hubMaterials.get(color);
  if (!m) hubMaterials.set(color, (m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.5 })));
  return m;
};

/** A car on its drawn wheels: rolls where the server says, rides up and down on the shape of its wheels and the road. */
function Car({ seat, id, lane, road, state, received, vis, emit }: CarProps) {
  const look = CAR_LOOKS[id] ?? CAR_LOOKS.taxi4l;
  const body = useRef<THREE.Group>(null!);
  const wheels = useRef<(THREE.Group | null)[]>([]);
  const tyres = useRef<(THREE.Mesh | null)[]>([]);
  const hubs = useRef<(THREE.Mesh | null)[]>([]);
  const geometry = useRef<ReturnType<typeof wheelGeometry> | null>(null);
  const heights = useMemo(() => look.wheels.map(() => 0), [look]);
  const front = Math.max(...look.wheels.map((w) => w[0]));
  const rear = Math.min(...look.wheels.map((w) => w[0]));
  useEffect(() => () => {
    geometry.current?.tyre.dispose();
    geometry.current?.hub.dispose();
  }, []);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.1);
    const s = state.current;
    const c = s.cars[seat];
    const v = vis.current[seat];
    if (!c || !v) return;
    // Ahead of the last report by as long as it's been, at the car's speed.
    const age = Math.min(0.25, (performance.now() - received.current) / 1000);
    const target = c.finish !== null || s.time < 0 ? c.d : Math.min(s.length, c.d + c.v * age);
    if (!v.placed || Math.abs(target - v.d) > 12) {
      v.d = target;
      v.lastD = target;
    } else v.d = approach(v.d, target, dt, 9);
    const moved = Math.max(0, v.d - v.lastD);
    v.lastD = v.d;

    // A new wheel: rebuild it, and pop it in.
    if (c.n !== v.n) {
      geometry.current?.tyre.dispose();
      geometry.current?.hub.dispose();
      geometry.current = wheelGeometry(c.wheel);
      tyres.current.forEach((m) => m && (m.geometry = geometry.current!.tyre));
      hubs.current.forEach((m) => m && (m.geometry = geometry.current!.hub));
      if (v.placed) {
        v.pop = 0;
        emit.current(v.d, 0.8, lane, look.color, 14, 1);
      }
      v.n = c.n;
    }
    v.pop += dt;

    const t = segmentAt(road, Math.min(v.d, s.length - 0.01)).t;
    const score = scoreOn(t, c.wheel);
    const big = traits(c.wheel).big;
    const radius = Math.max(0.08, c.wheel.size * PAD * WHEEL_M);
    const racing = s.time >= 0 && c.finish === null;
    // On a slippery road a poor wheel spins faster than the car goes.
    const slip = SLIPPY.has(t) ? 1 + 1.8 * (1 - score) : 1;
    v.phi += (moved / radius) * slip + (racing && SLIPPY.has(t) ? dt * 3 * (1 - score) : 0);

    let yf = 0;
    let yr = 0;
    let nf = 0;
    let nr = 0;
    look.wheels.forEach(([wx, wz], k) => {
      // Rear and far wheels a little out of step, so a lopsided wheel rocks the car.
      const phase = v.phi + (wx < 0 ? 0.9 : 0) + (wz < 0 ? 0.35 : 0);
      const y = groundAt(road, v.d + wx, lane + wz, big) + hubHeight(c.wheel.pts, phase - Math.PI / 2) * WHEEL_M;
      heights[k] = y;
      if (wx > 0) {
        yf += y;
        nf++;
      } else {
        yr += y;
        nr++;
      }
    });
    yf /= nf;
    yr /= nr;
    const base = front - rear;
    const axle = yr + ((yf - yr) * -rear) / base;
    const first = !v.placed;
    v.y = first ? axle : approach(v.y, axle, dt, 16);
    v.pitch = first ? 0 : approach(v.pitch, Math.atan2(yf - yr, base), dt, 12);
    v.placed = true;
    const hop = v.pop < 0.45 ? Math.sin((v.pop / 0.45) * Math.PI) * 0.4 : 0;
    body.current.position.set(v.d, v.y + hop, lane);
    body.current.rotation.z = v.pitch;
    const grow = 0.35 + 0.65 * easeOutBack(Math.min(1, v.pop / 0.3));
    look.wheels.forEach(([wx, wz], k) => {
      const o = wheels.current[k];
      if (!o) return;
      const phase = v.phi + (wx < 0 ? 0.9 : 0) + (wz < 0 ? 0.35 : 0);
      o.position.set(v.d + wx * Math.cos(v.pitch), heights[k] + hop, lane + wz);
      o.rotation.z = -phase;
      o.scale.setScalar(grow);
    });

    // Mud, water, sand and red dust off the back wheels.
    if (racing && SPRAY.has(t) && moved > 0) {
      v.spray += dt * (6 + c.v * (0.6 + slip));
      while (v.spray >= 1) {
        v.spray -= 1;
        emit.current(v.d + rear - radius * 0.6, 0.15 + (t === 'gue' ? 0 : radius * 0.3), lane + (Math.random() < 0.5 ? 0.8 : -0.8), FX[t], 1, 0.6 + 0.3 * slip);
      }
    }
    // Over the line: a burst in the car's colour (once per race: a rematch starts over).
    if (c.finish !== null && !v.done) {
      v.done = true;
      emit.current(v.d, 1.5, lane, look.color, 40, 1.8);
    } else if (c.finish === null) v.done = false;
  });

  return (
    <>
      <group ref={body}>
        <Model name={`car_${id}`} url={URL} />
      </group>
      {look.wheels.map((_, k) => (
        <group key={k} ref={(o) => (wheels.current[k] = o)}>
          <mesh ref={(o) => (tyres.current[k] = o)} material={tyreMaterial} castShadow />
          <mesh ref={(o) => (hubs.current[k] = o)} material={hubMaterial(look.color)} />
        </group>
      ))}
    </>
  );
}

interface Particle {
  mesh: THREE.Mesh;
  v: THREE.Vector3;
  life: number;
}

/** Little cubes for spray, a new wheel popping in, a finish. */
function Particles({ emitter }: { emitter: MutableRefObject<Emit> }) {
  const group = useRef<THREE.Group>(null!);
  const pool = useMemo(() => {
    const geometry = new THREE.BoxGeometry(0.13, 0.13, 0.13);
    return Array.from({ length: 220 }, (): Particle => {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      mesh.visible = false;
      return { mesh, v: new THREE.Vector3(), life: 0 };
    });
  }, []);
  const next = useRef(0);
  useEffect(() => {
    pool.forEach((p) => group.current.add(p.mesh));
    emitter.current = (x, y, z, color, count, power = 1) => {
      for (let i = 0; i < count; i++) {
        const p = pool[next.current];
        next.current = (next.current + 1) % pool.length;
        p.life = 0.45 + Math.random() * 0.4;
        p.mesh.visible = true;
        p.mesh.position.set(x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3);
        const spread = count > 4 ? 1 : 0.4;
        p.v.set((count > 4 ? (Math.random() - 0.5) * 4 : -1.5 - Math.random() * 2) * power, (1.5 + Math.random() * 2.5) * power, (Math.random() - 0.5) * 3 * spread * power);
        (p.mesh.material as THREE.MeshBasicMaterial).color.set(color);
      }
    };
  }, [pool, emitter]);
  useFrame((_, dt) => {
    for (const p of pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.v.y -= 9 * dt;
      p.mesh.position.addScaledVector(p.v, dt);
      p.mesh.rotation.x += dt * 6;
      p.mesh.scale.setScalar(Math.max(0.01, p.life * 1.6));
      if (p.life <= 0) p.mesh.visible = false;
    }
  });
  return <group ref={group} />;
}
