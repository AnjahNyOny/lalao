import {
  bodyOf,
  cellIndex,
  cellsWith,
  charAt,
  isTarget,
  LEVELS,
  levelSize,
  step,
  type Body,
  type MiarakaAction,
  type MiarakaState,
} from '@game/games/miaraka';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Model, Scatter } from '../tsena/assets';
import type { Placement } from '../tsena/map';
import type { Controls } from './controls';
import { tsingy } from './theme';

/** Built by assets/blender/miaraka_assets.py; heroes and plants come from Tsena's file. */
const URL = '/models/miaraka.glb';
// Fetched as soon as the app loads, like Tsena's models.
if (typeof window !== 'undefined') useLoader.preload(GLTFLoader, URL);

const HERO: Record<string, string> = { maki: 'pawn_lemur', zebu: 'pawn_zebu' };
const SEND_EVERY = 0.08;

export interface SceneProps {
  /** The latest state, read every frame. */
  state: MutableRefObject<MiarakaState>;
  seat: number;
  controls: MutableRefObject<Controls>;
  act: (a: MiarakaAction) => void;
}

export function Scene(props: SceneProps) {
  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ fov: 45, near: 0.3, far: 120, position: [10, 14, 20] }} gl={{ antialias: true }}>
      <color attach="background" args={[tsingy.sky]} />
      <fog attach="fog" args={[tsingy.fog, 18, 42]} />
      <Suspense fallback={null}>
        <World {...props} />
      </Suspense>
    </Canvas>
  );
}

function World(props: SceneProps) {
  // The player's own avatar, moved here; the camera and the sun follow it.
  const body = useRef<Body>(bodyOf(props.state.current.avatars[props.seat]));
  return (
    <>
      <Lights body={body} />
      <Ground />
      <Walls />
      <Mechanisms state={props.state} />
      <Croc state={props.state} />
      <Treasure state={props.state} />
      <Player {...props} body={body} />
      <Partner state={props.state} seat={1 - props.seat} />
      <Effects state={props.state} />
      <CameraRig body={body} />
    </>
  );
}

const level = LEVELS[0];
const { w: W, h: H } = levelSize(level);
const centre = (cx: number, cz: number) => new THREE.Vector3(cx + 0.5, 0, cz + 0.5);
/** Turn a cell's model a quarter when its passage runs east–west (walls above and below it). */
const across = (cx: number, cz: number) => ('#~'.includes(charAt(level, cx, cz - 1)) ? Math.PI / 2 : 0);
const hash = (cx: number, cz: number) => ((cx * 73856093) ^ (cz * 19349663)) >>> 0;

function CameraRig({ body }: { body: MutableRefObject<Body> }) {
  const { camera, size } = useThree();
  const look = useMemo(() => new THREE.Vector3(body.current.x, 0, body.current.z), [body]);
  useFrame((_, dt) => {
    // Further back in portrait, so the sides stay in view.
    const back = size.width < size.height ? 13 : 9;
    const k = 1 - Math.exp(-dt * 5);
    look.lerp(new THREE.Vector3(body.current.x, Math.max(0, body.current.y) * 0.5, body.current.z - 0.6), k);
    camera.position.set(look.x, look.y + back * 1.05, look.z + back * 0.85);
    camera.lookAt(look);
  });
  return null;
}

function Lights({ body }: { body: MutableRefObject<Body> }) {
  const sun = useRef<THREE.DirectionalLight>(null!);
  const target = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    target.position.set(body.current.x, 0, body.current.z);
    sun.current.position.set(body.current.x + 6, 12, body.current.z + 4);
  });
  return (
    <>
      <hemisphereLight args={['#fff1d6', '#5a6b4a', 1.2]} />
      <primitive object={target} />
      <directionalLight
        ref={sun}
        target={target}
        intensity={2.2}
        color="#ffe2b0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0008}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-camera-near={1}
        shadow-camera-far={40}
      />
    </>
  );
}

/** Laterite floor tiles, the river, and the jungle around the map. */
function Ground() {
  const tiles = useRef<THREE.InstancedMesh>(null!);
  const cells = useMemo(() => {
    const out: [number, number][] = [];
    for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) if (!'#~'.includes(charAt(level, cx, cz)) && !isTarget(charAt(level, cx, cz))) out.push([cx, cz]);
    // Gates stand on floor too; bridges don't.
    return out.concat(cellsWith(level, 'ABCDEFGH').filter(([cx, cz]) => level.groups[charAt(level, cx, cz).toLowerCase()]?.target === 'gate'));
  }, []);
  useEffect(() => {
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    cells.forEach(([cx, cz], i) => {
      m.makeTranslation(cx + 0.5, -0.5, cz + 0.5);
      tiles.current.setMatrixAt(i, m);
      tiles.current.setColorAt(i, color.set(tsingy.floor[hash(cx, cz) % tsingy.floor.length]));
    });
    tiles.current.instanceMatrix.needsUpdate = true;
    tiles.current.instanceColor!.needsUpdate = true;
  }, [cells]);
  const jungle = useMemo(() => {
    const rand = (() => {
      let seed = 7;
      return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    })();
    const items: Record<string, Placement[]> = { ravinala: [], palm: [], baobab: [] };
    const names = Object.keys(items);
    for (let i = 0; i < 70; i++) {
      // A ring of trees just outside the walls.
      const t = rand() * (2 * (W + H));
      const out = 1.2 + rand() * 4;
      let x: number;
      let z: number;
      if (t < W) [x, z] = [t, -out];
      else if (t < W + H) [x, z] = [W + out, t - W];
      else if (t < 2 * W + H) [x, z] = [t - W - H, H + out];
      else [x, z] = [-out, t - 2 * W - H];
      items[names[i % 3]].push({ x, z, rot: rand() * 6.28, scale: 1.1 + rand() * 0.8 });
    }
    return items;
  }, []);
  return (
    <>
      <instancedMesh ref={tiles} args={[undefined, undefined, cells.length]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial flatShading roughness={0.95} />
      </instancedMesh>
      {/* The river bed, and the water over it. */}
      <mesh position={[W / 2, -1.05, H / 2]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial color={tsingy.waterDeep} />
      </mesh>
      <Water />
      {/* Grass beyond the walls: four strips round the map. */}
      {[
        [W / 2, -20, W + 80, 40],
        [W / 2, H + 20, W + 80, 40],
        [-20, H / 2, 40, H],
        [W + 20, H / 2, 40, H],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, -0.02, z]} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color={tsingy.grass} />
        </mesh>
      ))}
      {Object.entries(jungle).map(([name, items]) => (
        <Scatter key={name} name={name} items={items} />
      ))}
    </>
  );
}

function Water() {
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    ref.current.position.y = -0.32 + Math.sin(clock.elapsedTime * 1.4) * 0.025;
  });
  return (
    <mesh ref={ref} position={[W / 2, -0.32, H / 2]} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[W, H]} />
      <meshStandardMaterial ref={mat} color={tsingy.water} transparent opacity={0.85} roughness={0.25} />
    </mesh>
  );
}

/** Walls, ledges, plates, pads and checkpoints: they never move. */
function Walls() {
  const placed = useMemo(() => {
    const at = (cells: [number, number][]): Placement[] =>
      cells.map(([cx, cz]) => ({ x: cx + 0.5, z: cz + 0.5, rot: (hash(cx, cz) % 4) * (Math.PI / 2), scale: 1 }));
    const walls = cellsWith(level, '#');
    const ledgeSwitches = Object.entries(level.groups)
      .filter(([, g]) => g.ledge)
      .map(([k]) => k)
      .join('');
    return {
      wall_a: at(walls.filter(([cx, cz]) => hash(cx, cz) % 2 === 0)),
      wall_b: at(walls.filter(([cx, cz]) => hash(cx, cz) % 2 === 1)),
      ledge: at(cellsWith(level, '^K+' + ledgeSwitches)),
      plate: at(cellsWith(level, Object.keys(level.groups).filter((k) => level.groups[k].switch === 'plate').join(''))),
      heavy_plate: at(cellsWith(level, Object.keys(level.groups).filter((k) => level.groups[k].switch === 'heavy').join(''))),
      pad: at(cellsWith(level, 'T')),
      cairn: at(cellsWith(level, '!')).map((p) => ({ ...p, rot: 0, x: p.x - 0.3, z: p.z - 0.3, scale: 0.9 })),
    };
  }, []);
  return (
    <>
      {Object.entries(placed).map(([name, items]) =>
        items.length ? <Scatter key={name} name={name} url={URL} items={items} lift={name === 'ledge' ? 0 : 0.001} /> : null,
      )}
    </>
  );
}

/** Smoothly towards a value, frame-rate independent. */
const approach = (from: number, to: number, dt: number, rate = 8) => from + (to - from) * (1 - Math.exp(-dt * rate));

function Mechanisms({ state }: { state: MutableRefObject<MiarakaState> }) {
  const cracked = useMemo(() => cellsWith(level, 'x'), []);
  const targets = useMemo(() => cellsWith(level, 'ABCDEFGH'), []);
  const levers = useMemo(() => cellsWith(level, 'abcdefgh').filter(([cx, cz]) => level.groups[charAt(level, cx, cz)]?.switch === 'lever'), []);
  const doors = useMemo(() => cellsWith(level, '|'), []);
  const items = useMemo(() => cellsWith(level, 'kK*+'), []);
  const crates = useMemo(() => state.current.crates.map((_, i) => i), [state]);
  const refs = useRef<Record<string, THREE.Object3D>>({});
  const set = (key: string) => (o: THREE.Object3D | null) => {
    if (o) refs.current[key] = o;
  };

  useFrame(({ clock }, dt) => {
    const s = state.current;
    const r = refs.current;
    for (const [cx, cz] of cracked) {
      const o = r[`x${cx},${cz}`];
      const broken = s.broken.includes(cellIndex(level, cx, cz));
      if (o) o.scale.y = approach(o.scale.y, broken ? 0.001 : 1, dt, 10);
      if (r[`r${cx},${cz}`]) r[`r${cx},${cz}`].visible = broken;
    }
    for (const [cx, cz] of targets) {
      const g = charAt(level, cx, cz).toLowerCase();
      const o = r[`t${cx},${cz}`];
      if (!o) continue;
      const open = s.open.includes(g);
      const bridge = level.groups[g]?.target === 'bridge';
      o.position.y = approach(o.position.y, bridge ? (open ? 0 : -0.75) : open ? -1.7 : 0, dt, 6);
    }
    for (const [cx, cz] of levers) {
      const o = r[`l${cx},${cz}`];
      if (o) o.rotation.x = approach(o.rotation.x, s.levers.includes(charAt(level, cx, cz)) ? -0.9 : 0.9, dt, 6);
    }
    for (const [cx, cz] of doors) {
      const o = r[`d${cx},${cz}`];
      if (o) o.rotation.y = approach(o.rotation.y, s.doors.includes(cellIndex(level, cx, cz)) ? -1.7 : 0, dt, 4);
    }
    items.forEach(([cx, cz], i) => {
      const o = r[`i${cx},${cz}`];
      if (!o) return;
      const picked = s.picked.includes(cellIndex(level, cx, cz));
      o.scale.setScalar(approach(o.scale.x, picked ? 0.001 : 1, dt, 12));
      o.rotation.y = clock.elapsedTime * 1.6 + i;
      o.position.y = o.userData.base + 0.15 + Math.sin(clock.elapsedTime * 2.5 + i) * 0.08;
    });
    for (const i of crates) {
      const o = r[`c${i}`];
      const [cx, cz] = s.crates[i];
      if (!o) continue;
      o.position.x = approach(o.position.x, cx + 0.5, dt, 10);
      o.position.z = approach(o.position.z, cz + 0.5, dt, 10);
    }
  });

  return (
    <>
      {cracked.map(([cx, cz]) => (
        <group key={`x${cx},${cz}`} position={centre(cx, cz)}>
          <group ref={set(`x${cx},${cz}`)}>
            <Model name="cracked" url={URL} />
          </group>
          <group ref={set(`r${cx},${cz}`)} visible={false}>
            <Model name="rubble" url={URL} />
          </group>
        </group>
      ))}
      {targets.map(([cx, cz]) => {
        const g = level.groups[charAt(level, cx, cz).toLowerCase()];
        return (
          <group key={`t${cx},${cz}`} position={centre(cx, cz)} rotation-y={across(cx, cz)}>
            <group ref={set(`t${cx},${cz}`)} position-y={g?.target === 'bridge' ? -0.75 : 0}>
              <Model name={g?.target === 'bridge' ? 'bridge' : 'gate'} url={URL} />
            </group>
          </group>
        );
      })}
      {levers.map(([cx, cz]) => {
        const base = level.groups[charAt(level, cx, cz)]?.ledge ? 1.5 : 0;
        return (
          <group key={`l${cx},${cz}`} position={[cx + 0.5, base, cz + 0.5]}>
            <Model name="lever_base" url={URL} />
            <group ref={set(`l${cx},${cz}`)} position-y={0.2} rotation-x={0.9}>
              <Model name="lever_arm" url={URL} />
            </group>
          </group>
        );
      })}
      {doors.map(([cx, cz]) => (
        <group key={`d${cx},${cz}`} position={centre(cx, cz)} rotation-y={across(cx, cz)}>
          <Model name="door_frame" url={URL} />
          <group ref={set(`d${cx},${cz}`)} position-x={-0.45}>
            <Model name="door" url={URL} />
          </group>
        </group>
      ))}
      {items.map(([cx, cz]) => {
        const c = charAt(level, cx, cz);
        const base = c === 'K' || c === '+' ? 1.5 : 0;
        return (
          <group key={`i${cx},${cz}`} ref={set(`i${cx},${cz}`)} position={[cx + 0.5, base, cz + 0.5]} userData={{ base }}>
            <Model name={c === 'k' || c === 'K' ? 'key' : 'pod'} url={URL} shadows={false} />
          </group>
        );
      })}
      {crates.map((i) => (
        <group key={`c${i}`} ref={set(`c${i}`)} position={[state.current.crates[i][0] + 0.5, 0, state.current.crates[i][1] + 0.5]}>
          <Model name="crate" url={URL} />
        </group>
      ))}
    </>
  );
}

function Croc({ state }: { state: MutableRefObject<MiarakaState> }) {
  const ref = useRef<THREE.Group>(null!);
  const placed = useRef(false);
  useFrame(({ clock }, dt) => {
    const c = state.current.crocs[0];
    if (!c) return;
    const o = ref.current;
    if (!placed.current) {
      o.position.set(c.x, -0.3, c.z);
      placed.current = true;
    }
    const dx = c.x - o.position.x;
    const dz = c.z - o.position.z;
    o.position.x += dx * (1 - Math.exp(-dt * 10));
    o.position.z += dz * (1 - Math.exp(-dt * 10));
    if (Math.hypot(dx, dz) > 0.002) o.rotation.y = Math.atan2(-dx, -dz);
    // Stunned: belly up, wobbling.
    const stunned = c.stun > 0;
    o.rotation.z = approach(o.rotation.z, stunned ? Math.PI * 0.9 + Math.sin(clock.elapsedTime * 8) * 0.1 : 0, dt, 8);
    o.position.y = -0.3 + Math.sin(clock.elapsedTime * 3) * 0.03;
  });
  return (
    <group ref={ref}>
      <Model name="croc" url={URL} scale={1.2} />
    </group>
  );
}

function Treasure({ state }: { state: MutableRefObject<MiarakaState> }) {
  const lid = useRef<THREE.Group>(null!);
  const [x, z] = level.chest;
  useFrame((_, dt) => {
    lid.current.rotation.x = approach(lid.current.rotation.x, state.current.won ? -1.9 : 0, dt, 3);
  });
  return (
    <group position={[x, 0, z]} rotation-y={-Math.PI / 2}>
      <Model name="chest_base" url={URL} />
      <group ref={lid} position={[0, 0.44, 0.25]}>
        <Model name="chest_lid" url={URL} />
      </group>
    </group>
  );
}

/** The player's own animal: moved here every frame, reported to the server several times a second. */
function Player({ state, seat, controls, act, body }: SceneProps & { body: MutableRefObject<Body> }) {
  const ref = useRef<THREE.Group>(null!);
  const sync = useRef(state.current.avatars[seat].sync);
  const since = useRef(0);
  const last = useRef<string>('');
  /** Where this screen last told the server it was. */
  const sent = useRef<[number, number]>([state.current.avatars[seat].x, state.current.avatars[seat].z]);
  const role = state.current.avatars[seat].role;
  useFrame((_, raw) => {
    // A slow device still moves in real time: a long frame becomes several short steps.
    const frame = Math.min(raw, 0.25);
    const steps = Math.ceil(frame / 0.05);
    const dt = frame / steps;
    const s = state.current;
    const a = s.avatars[seat];
    const c = controls.current;
    const idle = Math.hypot(c.mx, c.mz) < 0.1 && !c.action && body.current.grounded;
    if (a.sync !== sync.current) {
      // The server moved us (a fall, a bite, a refused report): start again from there.
      body.current = bodyOf(a);
      sync.current = a.sync;
    } else if (idle && Math.hypot(a.x - sent.current[0], a.z - sent.current[1]) > 0.5) {
      // Moved by something else than this screen (a test driving the game): follow it.
      body.current = bodyOf(a);
      sent.current = [a.x, a.z];
    }
    const over = s.won || s.lost;
    const input = over
      ? { mx: 0, mz: 0, jump: false, charge: false }
      : { mx: c.mx, mz: c.mz, jump: c.action && role === 'maki', charge: c.action && role === 'zebu' };
    c.action = false;
    let charged = false;
    for (let i = 0; i < steps; i++) {
      const next = step(s, role, body.current, i === 0 ? input : { ...input, jump: false, charge: false }, dt);
      body.current = next.body;
      charged ||= next.charged;
    }
    const b = body.current;
    if (charged) act({ type: 'charge', f: b.f });
    since.current += frame;
    if (!over && since.current >= SEND_EVERY) {
      since.current = 0;
      const report = `${b.x.toFixed(3)},${b.y.toFixed(3)},${b.z.toFixed(3)},${b.f.toFixed(2)}`;
      if (report !== last.current) {
        last.current = report;
        sent.current = [b.x, b.z];
        act({ type: 'move', x: b.x, y: b.y, z: b.z, f: b.f, s: sync.current });
      }
    }
    ref.current.position.set(b.x, b.y, b.z);
    ref.current.rotation.y = b.f;
    // A little squash and stretch in the air, a lean while charging.
    ref.current.scale.y = approach(ref.current.scale.y, b.grounded ? 1 : 1.12, frame, 12);
    ref.current.rotation.x = approach(ref.current.rotation.x, b.dash > 0 ? 0.25 : 0, frame, 14);
  });
  return (
    <group ref={ref}>
      <Hero role={role} />
    </group>
  );
}

function Hero({ role }: { role: string }) {
  return (
    <>
      <mesh position-y={0.03} receiveShadow>
        <cylinderGeometry args={[0.36, 0.38, 0.05, 16]} />
        <meshStandardMaterial color={role === 'maki' ? tsingy.maki : tsingy.zebu} />
      </mesh>
      <Model name={HERO[role]} position-y={0.05} scale={role === 'zebu' ? 1.15 : 1.05} />
    </>
  );
}

/** The other player's animal, where the server last saw it, smoothed. */
function Partner({ state, seat }: { state: MutableRefObject<MiarakaState>; seat: number }) {
  const ref = useRef<THREE.Group>(null!);
  const role = state.current.avatars[seat].role;
  const placed = useRef(-1);
  useFrame((_, dt) => {
    const a = state.current.avatars[seat];
    const o = ref.current;
    if (placed.current !== a.sync) {
      // Snap after a respawn rather than gliding across the map.
      o.position.set(a.x, a.y, a.z);
      placed.current = a.sync;
    }
    const k = 1 - Math.exp(-dt * 14);
    o.position.x += (a.x - o.position.x) * k;
    o.position.y += (a.y - o.position.y) * k;
    o.position.z += (a.z - o.position.z) * k;
    let d = a.f - o.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    o.rotation.y += d * k;
  });
  return (
    <group ref={ref}>
      <Hero role={role} />
    </group>
  );
}

const FX_COLOR: Record<string, string> = {
  break: '#d9a066',
  push: '#c9a27a',
  pick: '#f4f0e6',
  key: '#e6b53a',
  door: '#e6b53a',
  lever: '#f08a24',
  splash: '#7fd3ec',
  bite: '#e05a4a',
  stun: '#f4d35e',
  check: '#7fd06a',
  treasure: '#f4d35e',
};

interface Particle {
  mesh: THREE.Mesh;
  v: THREE.Vector3;
  life: number;
}

/** Bursts of little cubes for every event: a wall breaking, a pickup, a splash… */
function Effects({ state }: { state: MutableRefObject<MiarakaState> }) {
  const group = useRef<THREE.Group>(null!);
  const seen = useRef(state.current.fx.at(-1)?.n ?? 0);
  const pool = useMemo(() => {
    const geometry = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    return Array.from({ length: 90 }, (): Particle => {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      mesh.visible = false;
      return { mesh, v: new THREE.Vector3(), life: 0 };
    });
  }, []);
  useEffect(() => {
    pool.forEach((p) => group.current.add(p.mesh));
  }, [pool]);
  useFrame((_, dt) => {
    for (const f of state.current.fx) {
      if (f.n <= seen.current) continue;
      seen.current = f.n;
      const count = f.t === 'treasure' ? 40 : f.t === 'break' ? 18 : 10;
      let made = 0;
      for (const p of pool) {
        if (p.life > 0) continue;
        p.life = 0.6 + Math.random() * 0.5;
        p.mesh.visible = true;
        p.mesh.position.set(f.x + (Math.random() - 0.5) * 0.4, f.t === 'splash' || f.t === 'bite' ? 0 : 0.6, f.z + (Math.random() - 0.5) * 0.4);
        p.v.set((Math.random() - 0.5) * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 3);
        (p.mesh.material as THREE.MeshBasicMaterial).color.set(FX_COLOR[f.t]);
        if (++made >= count) break;
      }
    }
    for (const p of pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.v.y -= 9 * dt;
      p.mesh.position.addScaledVector(p.v, dt);
      p.mesh.rotation.x += dt * 5;
      p.mesh.scale.setScalar(Math.max(0.01, p.life * 1.5));
      if (p.life <= 0) p.mesh.visible = false;
    }
  });
  return <group ref={group} />;
}
