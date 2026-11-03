import {
  bodyOf,
  cellIndex,
  cellsWith,
  charAt,
  isTarget,
  LEVELS,
  levelSize,
  PHYS,
  step,
  type Body,
  type FoeDef,
  type LevelDef,
  type MiarakaAction,
  type MiarakaState,
} from '@game/games/miaraka';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { createContext, Suspense, useContext, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Model, Scatter } from '../tsena/assets';
import type { Placement } from '../tsena/map';
import type { Controls } from './controls';
import { LOOKS, tsingy, type Look } from './theme';

/** Built by assets/blender/miaraka_assets.py; heroes, the fosa and the trees come from Tsena's file. */
const URL = '/models/miaraka.glb';
// Fetched as soon as the app loads, like Tsena's models.
if (typeof window !== 'undefined') useLoader.preload(GLTFLoader, URL);

const HERO: Record<string, string> = { maki: 'pawn_lemur', zebu: 'pawn_zebu' };
const SEND_EVERY = 0.08;

export interface SceneProps {
  /** The latest state, read every frame. */
  state: MutableRefObject<MiarakaState>;
  seat: number;
  /** The level on screen: the world is rebuilt when it changes. */
  level: number;
  controls: MutableRefObject<Controls>;
  act: (a: MiarakaAction) => void;
}

/** The level being drawn, and what every part of the scene derives from it. */
interface Stage {
  l: LevelDef;
  look: Look;
  dark: boolean;
  W: number;
  H: number;
  /** Turn a cell's model a quarter when its passage runs east–west (walls or water above and below it). */
  across: (cx: number, cz: number) => number;
}

const StageContext = createContext<Stage>(null!);
const useStage = () => useContext(StageContext);

function stageOf(index: number): Stage {
  const l = LEVELS[index];
  const { w: W, h: H } = levelSize(l);
  return {
    l,
    look: LOOKS[l.look],
    dark: !!l.dark,
    W,
    H,
    across: (cx, cz) => ('#~-'.includes(charAt(l, cx, cz - 1)) ? Math.PI / 2 : 0),
  };
}

export function Scene(props: SceneProps) {
  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ fov: 45, near: 0.3, far: 120, position: [10, 14, 20] }} gl={{ antialias: true }}>
      <Suspense fallback={null}>
        <World key={props.level} {...props} />
      </Suspense>
    </Canvas>
  );
}

function World(props: SceneProps) {
  const stage = useMemo(() => stageOf(props.level), [props.level]);
  // The player's own avatar, moved here; the camera and the sun follow it.
  const body = useRef<Body>(bodyOf(props.state.current.avatars[props.seat]));
  const { look } = stage;
  return (
    <StageContext.Provider value={stage}>
      <color attach="background" args={[look.sky]} />
      <fog attach="fog" args={[look.fog, 12 + look.fogNear, 12 + look.fogFar]} />
      <Lights body={body} />
      <Ground />
      <Walls />
      <Plates state={props.state} />
      <Mechanisms state={props.state} />
      {stage.l.foes.map((def, k) => (
        <Foe key={k} state={props.state} index={k} def={def} />
      ))}
      <Treasure state={props.state} />
      <Player {...props} body={body} />
      <Partner state={props.state} seat={1 - props.seat} />
      <Effects state={props.state} />
      {stage.dark && <Glow />}
      <CameraRig body={body} />
    </StageContext.Provider>
  );
}

const centre = (cx: number, cz: number) => new THREE.Vector3(cx + 0.5, 0, cz + 0.5);
const hash = (cx: number, cz: number) => ((cx * 73856093) ^ (cz * 19349663)) >>> 0;
const at = (cells: [number, number][], extra: Partial<Placement> = {}): Placement[] =>
  cells.map(([cx, cz]) => ({ x: cx + 0.5, z: cz + 0.5, rot: (hash(cx, cz) % 4) * (Math.PI / 2), scale: 1, ...extra }));
/** Group letters whose switch is of this kind. */
const groupsWhere = (l: LevelDef, test: (g: LevelDef['groups'][string]) => boolean) =>
  Object.keys(l.groups)
    .filter((k) => test(l.groups[k]))
    .join('');

function CameraRig({ body }: { body: MutableRefObject<Body> }) {
  const { camera, size, scene } = useThree();
  const stage = useStage();
  const look = useMemo(() => new THREE.Vector3(body.current.x, 0, body.current.z), [body]);
  useFrame((_, dt) => {
    // Further back in portrait, so the sides stay in view.
    const back = size.width < size.height ? 13 : 9;
    // The fog is counted from the player, however far back the camera stands.
    if (scene.fog instanceof THREE.Fog) {
      const dist = back * Math.hypot(1.05, 0.85);
      scene.fog.near = dist + stage.look.fogNear;
      scene.fog.far = dist + stage.look.fogFar;
    }
    const k = 1 - Math.exp(-dt * 5);
    look.lerp(new THREE.Vector3(body.current.x, Math.max(0, body.current.y) * 0.5, body.current.z - 0.6), k);
    camera.position.set(look.x, look.y + back * 1.05, look.z + back * 0.85);
    camera.lookAt(look);
  });
  return null;
}

function Lights({ body }: { body: MutableRefObject<Body> }) {
  const { look, dark } = useStage();
  const sun = useRef<THREE.DirectionalLight>(null!);
  const target = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    target.position.set(body.current.x, 0, body.current.z);
    sun.current.position.set(body.current.x + 6, 12, body.current.z + 4);
  });
  return (
    <>
      <hemisphereLight args={look.hemi} />
      <primitive object={target} />
      <directionalLight
        ref={sun}
        target={target}
        intensity={look.sun}
        color={look.sunColor}
        castShadow={!dark}
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

/** Floor tiles, the shallows, the water, and what lies beyond the walls. */
function Ground() {
  const { l, look, W, H } = useStage();
  const tiles = useRef<THREE.InstancedMesh>(null!);
  const sand = useRef<THREE.InstancedMesh>(null!);
  const cells = useMemo(() => {
    const out: [number, number][] = [];
    for (let cz = 0; cz < H; cz++) {
      for (let cx = 0; cx < W; cx++) {
        const c = charAt(l, cx, cz);
        if (!'#~-%'.includes(c) && !isTarget(c)) out.push([cx, cz]);
      }
    }
    // Gates stand on floor too; bridges don't.
    return out.concat(cellsWith(l, 'ABCDEFGH').filter(([cx, cz]) => l.groups[charAt(l, cx, cz).toLowerCase()]?.target === 'gate'));
  }, [l, W, H]);
  const shallows = useMemo(() => cellsWith(l, '-'), [l]);
  useEffect(() => {
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    cells.forEach(([cx, cz], i) => {
      m.makeTranslation(cx + 0.5, -0.5, cz + 0.5);
      tiles.current.setMatrixAt(i, m);
      tiles.current.setColorAt(i, color.set(look.floor[hash(cx, cz) % look.floor.length]));
    });
    tiles.current.instanceMatrix.needsUpdate = true;
    tiles.current.instanceColor!.needsUpdate = true;
    if (sand.current) {
      shallows.forEach(([cx, cz], i) => {
        m.makeTranslation(cx + 0.5, -1.0, cz + 0.5);
        sand.current.setMatrixAt(i, m);
      });
      sand.current.instanceMatrix.needsUpdate = true;
    }
  }, [cells, shallows, look]);
  const jungle = useMemo(() => {
    const rand = (() => {
      let seed = 7;
      return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
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
      // Kirindy's dry forest has its baobabs.
      const name = l.look === 'forest' && i % 3 !== 1 ? 'baobab' : names[i % 3];
      items[name].push({ x, z, rot: rand() * 6.28, scale: 1.1 + rand() * 0.8 });
    }
    return items;
  }, [l, W, H]);
  return (
    <>
      <instancedMesh ref={tiles} args={[undefined, undefined, cells.length]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial flatShading roughness={0.95} />
      </instancedMesh>
      {shallows.length > 0 && (
        // Sand under the shallows, just below the surface.
        <instancedMesh ref={sand} args={[undefined, undefined, shallows.length]} receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial flatShading roughness={1} color="#d8c38e" />
        </instancedMesh>
      )}
      {shallows.length > 0 && <Scatter name="reeds" url={URL} items={at(shallows)} />}
      {/* The river bed, and the water over it. */}
      <mesh position={[W / 2, -1.05, H / 2]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial color={look.waterDeep} />
      </mesh>
      <Water />
      {/* Beyond the walls: four strips round the map. */}
      {[
        [W / 2, -20, W + 80, 40],
        [W / 2, H + 20, W + 80, 40],
        [-20, H / 2, 40, H],
        [W + 20, H / 2, 40, H],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, -0.02, z]} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color={look.grass} />
        </mesh>
      ))}
      {look.jungle && Object.entries(jungle).map(([name, items]) => items.length > 0 && <Scatter key={name} name={name} items={items} />)}
    </>
  );
}

function Water() {
  const { look, W, H } = useStage();
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    ref.current.position.y = -0.32 + Math.sin(clock.elapsedTime * 1.4) * 0.025;
  });
  return (
    <mesh ref={ref} position={[W / 2, -0.32, H / 2]} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[W, H]} />
      <meshStandardMaterial color={look.water} transparent opacity={0.85} roughness={0.25} />
    </mesh>
  );
}

/** Walls, ledges, rocks, planks, pads and checkpoints: they never move. */
function Walls() {
  const { l, look, across } = useStage();
  const placed = useMemo(() => {
    const walls = cellsWith(l, '#');
    const [a, b] = look.walls === 'bush' ? ['bush_a', 'bush_b'] : ['wall_a', 'wall_b'];
    const tall = PHYS.high / PHYS.ledge;
    return {
      [a]: at(walls.filter(([cx, cz]) => hash(cx, cz) % 2 === 0)),
      [b]: at(walls.filter(([cx, cz]) => hash(cx, cz) % 2 === 1)),
      ledge: at(cellsWith(l, '^K+' + groupsWhere(l, (g) => !!g.ledge))).concat(at(cellsWith(l, 'I' + groupsWhere(l, (g) => !!g.high)), { sy: tall })),
      planks: cellsWith(l, '%').map(([cx, cz]) => ({ x: cx + 0.5, z: cz + 0.5, rot: across(cx, cz), scale: 1 })),
      plate: at(cellsWith(l, groupsWhere(l, (g) => g.switch === 'plate'))),
      heavy_plate: at(cellsWith(l, groupsWhere(l, (g) => g.switch === 'heavy'))),
      pad: at(cellsWith(l, 'T')),
      cairn: at(cellsWith(l, '!')).map((p) => ({ ...p, rot: 0, x: p.x - 0.3, z: p.z - 0.3, scale: 0.9 })),
    };
  }, [l, look, across]);
  return (
    <>
      {Object.entries(placed).map(([name, items]) =>
        items.length ? <Scatter key={name} name={name} url={URL} items={items} lift={name === 'ledge' || name === 'planks' ? 0 : 0.001} /> : null,
      )}
    </>
  );
}

/** A ring of light round each plate while it's weighed down (or, for plates that go together, once they've worked). */
function Plates({ state }: { state: MutableRefObject<MiarakaState> }) {
  const { l } = useStage();
  const plates = useMemo(
    () =>
      cellsWith(l, groupsWhere(l, (g) => g.switch !== 'lever')).map(([cx, cz]) => ({ cx, cz, i: cellIndex(l, cx, cz), g: charAt(l, cx, cz) })),
    [l],
  );
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const s = state.current;
    plates.forEach((p, k) => {
      const o = rings.current[k];
      if (o) o.visible = s.pressed.includes(p.i) || s.levers.includes(p.g);
    });
  });
  return (
    <>
      {plates.map((p, k) => (
        <mesh key={k} ref={(o) => (rings.current[k] = o)} position={[p.cx + 0.5, 0.12, p.cz + 0.5]} rotation-x={-Math.PI / 2} visible={false}>
          <ringGeometry args={[0.36, 0.46, 20]} />
          <meshBasicMaterial color={tsingy.open} transparent opacity={0.9} />
        </mesh>
      ))}
    </>
  );
}

/** Smoothly towards a value, frame-rate independent. */
const approach = (from: number, to: number, dt: number, rate = 8) => from + (to - from) * (1 - Math.exp(-dt * rate));

function Mechanisms({ state }: { state: MutableRefObject<MiarakaState> }) {
  const { l, across } = useStage();
  const cracked = useMemo(() => cellsWith(l, 'x'), [l]);
  const targets = useMemo(() => cellsWith(l, 'ABCDEFGH'), [l]);
  const levers = useMemo(() => cellsWith(l, 'abcdefgh').filter(([cx, cz]) => l.groups[charAt(l, cx, cz)]?.switch === 'lever'), [l]);
  const doors = useMemo(() => cellsWith(l, '|'), [l]);
  const items = useMemo(() => cellsWith(l, 'kK*+'), [l]);
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
      const broken = s.broken.includes(cellIndex(l, cx, cz));
      if (o) o.scale.y = approach(o.scale.y, broken ? 0.001 : 1, dt, 10);
      if (r[`r${cx},${cz}`]) r[`r${cx},${cz}`].visible = broken;
    }
    for (const [cx, cz] of targets) {
      const g = charAt(l, cx, cz).toLowerCase();
      const o = r[`t${cx},${cz}`];
      if (!o) continue;
      const open = s.open.includes(g);
      const bridge = l.groups[g]?.target === 'bridge';
      o.position.y = approach(o.position.y, bridge ? (open ? 0 : -0.75) : open ? -1.7 : 0, dt, 6);
    }
    for (const [cx, cz] of levers) {
      const g = charAt(l, cx, cz);
      const o = r[`l${cx},${cz}`];
      if (!o) continue;
      // A timed lever creeps back as its time runs out.
      const timer = l.groups[g].timer;
      const left = timer ? (s.timers[g] ?? 0) / timer : s.levers.includes(g) ? 1 : 0;
      o.rotation.x = approach(o.rotation.x, 0.9 - 1.8 * left, dt, 6);
    }
    for (const [cx, cz] of doors) {
      const o = r[`d${cx},${cz}`];
      if (o) o.rotation.y = approach(o.rotation.y, s.doors.includes(cellIndex(l, cx, cz)) ? -1.7 : 0, dt, 4);
    }
    items.forEach(([cx, cz], i) => {
      const o = r[`i${cx},${cz}`];
      if (!o) return;
      const picked = s.picked.includes(cellIndex(l, cx, cz));
      o.scale.setScalar(approach(o.scale.x, picked ? 0.001 : 1, dt, 12));
      o.rotation.y = clock.elapsedTime * 1.6 + i;
      o.position.y = o.userData.base + 0.15 + Math.sin(clock.elapsedTime * 2.5 + i) * 0.08;
    });
    for (const i of crates) {
      const o = r[`c${i}`];
      const c = s.crates[i];
      if (!o || !c) continue;
      const [x, z] = [c.x + 0.5, c.z + 0.5];
      // Back home in a puff, rather than sliding through the walls.
      if (Math.hypot(o.position.x - x, o.position.z - z) > 1.5) o.position.set(x, o.position.y, z);
      o.position.x = approach(o.position.x, x, dt, 10);
      o.position.z = approach(o.position.z, z, dt, 10);
      // Sunk: its top flush with the ground, a stepping stone.
      o.position.y = approach(o.position.y, c.sunk ? -0.9 : 0, dt, 5);
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
        const g = l.groups[charAt(l, cx, cz).toLowerCase()];
        return (
          <group key={`t${cx},${cz}`} position={centre(cx, cz)} rotation-y={across(cx, cz)}>
            <group ref={set(`t${cx},${cz}`)} position-y={g?.target === 'bridge' ? -0.75 : 0}>
              <Model name={g?.target === 'bridge' ? 'bridge' : 'gate'} url={URL} />
            </group>
          </group>
        );
      })}
      {levers.map(([cx, cz]) => {
        const g = l.groups[charAt(l, cx, cz)];
        const base = g?.high ? PHYS.high : g?.ledge ? PHYS.ledge : 0;
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
        const c = charAt(l, cx, cz);
        const base = c === 'K' || c === '+' ? PHYS.ledge : 0;
        return (
          <group key={`i${cx},${cz}`} ref={set(`i${cx},${cz}`)} position={[cx + 0.5, base, cz + 0.5]} userData={{ base }}>
            <Model name={c === 'k' || c === 'K' ? 'key' : 'pod'} url={URL} shadows={false} />
          </group>
        );
      })}
      {crates.map((i) => (
        <group key={`c${i}`} ref={set(`c${i}`)} position={[state.current.crates[i].x + 0.5, 0, state.current.crates[i].z + 0.5]}>
          <Model name="crate" url={URL} />
        </group>
      ))}
    </>
  );
}

/** A crocodile in the water, a bat up in the air, or the fosa on the prowl. */
function Foe({ state, index, def }: { state: MutableRefObject<MiarakaState>; index: number; def: FoeDef }) {
  const { l } = useStage();
  const ref = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const wings = useRef<(THREE.Group | null)[]>([]);
  const placed = useRef(false);
  const baseY = def.kind === 'croc' ? -0.3 : def.kind === 'bat' ? 2.3 : 0;
  useFrame(({ clock }, dt) => {
    const s = state.current;
    const f = s.foes[index];
    if (!f) return;
    const o = ref.current;
    if (!placed.current) {
      o.position.set(f.x, baseY, f.z);
      placed.current = true;
    }
    const dx = f.x - o.position.x;
    const dz = f.z - o.position.z;
    o.position.x += dx * (1 - Math.exp(-dt * 10));
    o.position.z += dz * (1 - Math.exp(-dt * 10));
    if (Math.hypot(dx, dz) > 0.002) {
      let d = Math.atan2(dx, dz) - o.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      o.rotation.y += d * (1 - Math.exp(-dt * 12));
    }
    const t = clock.elapsedTime + index;
    const stunned = f.stun > 0;
    if (def.kind === 'croc') {
      // Stunned: belly up, wobbling. Under a ford, it dives.
      body.current.rotation.z = approach(body.current.rotation.z, stunned ? Math.PI * 0.9 + Math.sin(t * 8) * 0.1 : 0, dt, 8);
      const under = s.crates.some((c) => c.sunk && c.x === Math.floor(f.x) && c.z === Math.floor(f.z));
      o.position.y = approach(o.position.y, under ? -1 : -0.3 + Math.sin(t * 3) * 0.03, dt, 8);
    } else if (def.kind === 'bat') {
      const flap = Math.sin(t * 16) * 0.7;
      if (wings.current[0]) wings.current[0].rotation.z = flap;
      if (wings.current[1]) wings.current[1].rotation.z = -flap;
      o.position.y = baseY + Math.sin(t * 2.2) * 0.25;
    } else {
      // The fosa: a lope while it runs, a dizzy spin when stunned.
      const running = f.hunt >= 0;
      body.current.position.y = running ? Math.abs(Math.sin(t * 12)) * 0.12 : 0;
      body.current.rotation.y = stunned ? t * 3 : approach(body.current.rotation.y, 0, dt, 8);
    }
  });
  const model =
    def.kind === 'croc' ? (
      <Model name="croc" url={URL} scale={1.2} />
    ) : def.kind === 'bat' ? (
      <group scale={1.7}>
        <Model name="bat" url={URL} shadows={false} />
        <group ref={(o) => (wings.current[0] = o)} position={[0.04, 0, 0]}>
          <Model name="bat_wing" url={URL} shadows={false} />
        </group>
        <group ref={(o) => (wings.current[1] = o)} position={[-0.04, 0, 0]} scale-x={-1}>
          <Model name="bat_wing" url={URL} shadows={false} />
        </group>
      </group>
    ) : (
      <Model name="pawn_fossa" scale={1.5} />
    );
  return (
    <group ref={ref}>
      <group ref={body}>{model}</group>
      {/* In the dark, a foe shows by its eyes. */}
      {l.dark && <pointLight position-y={0.6} color="#ff9a7a" intensity={1.2} distance={2.2} decay={2} />}
    </group>
  );
}

function Treasure({ state }: { state: MutableRefObject<MiarakaState> }) {
  const { l, dark } = useStage();
  const lid = useRef<THREE.Group>(null!);
  const [x, z] = l.chest;
  useFrame((_, dt) => {
    const s = state.current;
    lid.current.rotation.x = approach(lid.current.rotation.x, s.won || s.cleared !== null ? -1.9 : 0, dt, 3);
  });
  return (
    <group position={[x, 0, z]} rotation-y={-Math.PI / 2}>
      <Model name="chest_base" url={URL} />
      <group ref={lid} position={[0, 0.44, 0.25]}>
        <Model name="chest_lid" url={URL} />
      </group>
      {dark && <pointLight position-y={1.2} color="#f4d35e" intensity={6} distance={6} decay={2} />}
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
  /** Moved by something else than this screen (a test driving the game): shown as it is, no physics of its own. */
  const driven = useRef(false);
  useFrame((_, raw) => {
    // A slow device still moves in real time: a long frame becomes several short steps.
    const frame = Math.min(raw, 0.25);
    const steps = Math.ceil(frame / 0.05);
    const dt = frame / steps;
    const s = state.current;
    const a = s.avatars[seat];
    const c = controls.current;
    const idle = Math.hypot(c.mx, c.mz) < 0.1 && !c.action && (body.current.grounded || driven.current);
    if (a.sync !== sync.current) {
      // The server moved us (a fall, a bite, a refused report): start again from there.
      body.current = bodyOf(a);
      sync.current = a.sync;
      driven.current = false;
    } else if (idle && (driven.current || Math.hypot(a.x - sent.current[0], a.z - sent.current[1]) > 0.5)) {
      body.current = bodyOf(a);
      sent.current = [a.x, a.z];
      driven.current = true;
    }
    if (!idle) driven.current = false;
    const over = s.won || s.lost || s.cleared !== null || driven.current;
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

/** An animal on its coloured disc; in the dark, the maki holds up its lantern and the zebu glows faintly. */
function Hero({ role }: { role: string }) {
  const { dark } = useStage();
  const flame = useRef<THREE.PointLight>(null!);
  useFrame(({ clock }) => {
    if (flame.current) flame.current.intensity = 14 + Math.sin(clock.elapsedTime * 13) * 1.2 + Math.sin(clock.elapsedTime * 7.3) * 0.8;
  });
  return (
    <>
      <mesh position-y={0.03} receiveShadow>
        <cylinderGeometry args={[0.36, 0.38, 0.05, 16]} />
        <meshStandardMaterial color={role === 'maki' ? tsingy.maki : tsingy.zebu} />
      </mesh>
      <Model name={HERO[role]} position-y={0.05} scale={role === 'zebu' ? 1.15 : 1.05} />
      {dark && role === 'maki' && (
        <group position={[0.22, 0.75, 0.12]}>
          <Model name="lantern" url={URL} shadows={false} />
          <mesh position-y={0.12}>
            <sphereGeometry args={[0.045, 8, 6]} />
            <meshBasicMaterial color="#ffd27a" />
          </mesh>
          <pointLight ref={flame} position-y={0.12} color="#ffc66e" intensity={14} distance={9} decay={1.6} />
        </group>
      )}
      {dark && role === 'zebu' && <pointLight position-y={1.2} color="#9fc4ff" intensity={4.5} distance={4.5} decay={1.6} />}
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

/** Glow-worms along the cave walls: just enough to make out the shape of the place. */
function Glow() {
  const { l, W, H } = useStage();
  const ref = useRef<THREE.InstancedMesh>(null!);
  const spots = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let cz = 1; cz < H - 1; cz++) {
      for (let cx = 1; cx < W - 1; cx++) {
        if (charAt(l, cx, cz) !== '#' || hash(cx, cz) % 5) continue;
        const h = hash(cz, cx);
        out.push([cx + 0.2 + (h % 7) / 10, 0.3 + (h % 11) / 10, cz + 0.2 + (h % 5) / 8]);
      }
    }
    // Every checkpoint and treasure pad glows too.
    for (const [cx, cz] of cellsWith(l, '!T')) out.push([cx + 0.5, 0.15, cz + 0.5]);
    return out;
  }, [l, W, H]);
  useEffect(() => {
    const m = new THREE.Matrix4();
    spots.forEach(([x, y, z], i) => ref.current.setMatrixAt(i, m.makeTranslation(x, y, z)));
    ref.current.instanceMatrix.needsUpdate = true;
  }, [spots]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, spots.length]}>
      <sphereGeometry args={[0.06, 6, 4]} />
      <meshBasicMaterial color="#8ff0c8" />
    </instancedMesh>
  );
}

const FX_COLOR: Record<string, string> = {
  break: '#d9a066',
  push: '#c9a27a',
  sink: '#7fd3ec',
  home: '#f4f0e6',
  pick: '#f4f0e6',
  key: '#e6b53a',
  door: '#e6b53a',
  lever: '#f08a24',
  splash: '#7fd3ec',
  fall: '#8a6a4a',
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
        const low = f.t === 'splash' || f.t === 'bite' || f.t === 'sink' || f.t === 'fall';
        p.mesh.position.set(f.x + (Math.random() - 0.5) * 0.4, low ? 0 : 0.6, f.z + (Math.random() - 0.5) * 0.4);
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
