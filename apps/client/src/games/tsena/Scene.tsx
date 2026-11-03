import { CELL_COUNT, CELLS, eventMs, JAIL, MAX_LEVEL, PACE, type TsenaEvent } from '@game/games/tsena';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Model, Scatter } from './assets';
import { DIE_UP, diceMaterials, LABEL_H, LABEL_W, labelTexture, resetLabels } from './labels';
import { cellPos, coast, hills, houseAt, islandBox, islets, landmarkAt, onLand, paddies, road, roadAt, scenery, stretch, type Spot } from './map';
import { now, type Playback, type Shown } from './replay';
import { SITES } from './texts';
import { island } from './theme';

const TILE_R = 0.82;
const TILE_TOP = 0.16;
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface SceneProps {
  display: Shown;
  playback: Playback | null;
  current: TsenaEvent | null;
  /** Seat whose turn it is (camera goes there when nothing is playing). */
  turn: number;
  players: number;
  overview: boolean;
  /** Cells to make pulse: taxi destinations. */
  highlight: number[];
  selected: number | null;
  onCell: (cell: number) => void;
}

/** Live positions of the pawns, written every frame, read by the camera and the dice. */
type PawnSpots = THREE.Vector3[];

export function Scene(props: SceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      frameloop={reducedMotion() ? 'demand' : 'always'}
      camera={{ fov: 42, near: 0.5, far: 260, position: [0, 60, 40] }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={[island.sky]} />
      <fog attach="fog" args={[island.sky, 30, 90]} />
      <Suspense fallback={null}>
        <World {...props} />
      </Suspense>
    </Canvas>
  );
}

function World(props: SceneProps) {
  const spots = useMemo<PawnSpots>(() => Array.from({ length: 4 }, () => new THREE.Vector3()), []);
  // Where the camera looks, shared with the sun so shadows follow the view.
  const look = useMemo(() => islandCentre.clone(), []);
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    document.fonts.load("800 1em 'Baloo 2'").then(() => {
      resetLabels();
      setFontsReady(true);
    }, () => setFontsReady(true));
  }, []);

  return (
    <>
      <Lights look={look} overview={props.overview} />
      <CameraRig spots={spots} look={look} {...props} />
      <Ocean />
      <Land />
      <Road />
      <Tiles {...props} fontsReady={fontsReady} />
      <Buildings display={props.display} />
      <Landmarks />
      <Decor />
      {Array.from({ length: props.players }, (_, seat) => (
        <Pawn key={seat} seat={seat} spots={spots} {...props} />
      ))}
      <Dice spots={spots} playback={props.playback} />
    </>
  );
}

// ---------- Camera ----------

const PITCH = THREE.MathUtils.degToRad(56);
const islandCentre = islandBox.getCenter(new THREE.Vector3());
const islandSize = islandBox.getSize(new THREE.Vector3());

/** The site an event is about, when it isn't where the pawn stands. */
function eventCell(e: TsenaEvent | null): number | null {
  if (!e) return null;
  switch (e.t) {
    case 'cyclone':
    case 'build':
    case 'sell':
    case 'mortgage':
    case 'redeem':
    case 'offer':
    case 'deal':
    case 'refuse':
    case 'cancel':
      return e.cell;
    default:
      return null;
  }
}

/**
 * Where the camera should look: the site an action is about, the moving
 * pawn, the cell the player opened, or the player whose turn it is.
 */
function focusPoint(p: SceneProps, spots: PawnSpots, out: THREE.Vector3): THREE.Vector3 {
  if (p.overview) return out.copy(islandCentre);
  const cell = eventCell(p.current) ?? (p.playback ? null : p.selected);
  if (cell !== null) return out.copy(cellPos[cell]);
  const seat = p.playback ? p.playback.log.player : p.turn;
  return out.copy(spots[seat]);
}

/** What the camera is on; when it changes, the camera glides over to the new subject. */
function subject(p: SceneProps, wide: boolean): string {
  if (wide) return 'wide';
  const cell = eventCell(p.current) ?? (p.playback ? null : p.selected);
  if (cell !== null) return `cell:${cell}`;
  return `pawn:${p.playback ? p.playback.log.player : p.turn}`;
}

/** Slow start, slow finish: strong for the camera's glides, gentle for a walk. */
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const easeSine = (t: number) => 0.5 - Math.cos(Math.min(1, Math.max(0, t)) * Math.PI) / 2;

interface Glide {
  key: string;
  from: THREE.Vector3;
  fromDist: number;
  start: number;
  ms: number;
}

function CameraRig({ spots, look, ...p }: SceneProps & { spots: PawnSpots; look: THREE.Vector3 }) {
  const { camera, size, scene } = useThree();
  const goal = useMemo(() => new THREE.Vector3(), []);
  const glide = useRef<Glide | null>(null);
  const dist = useRef<number | null>(null);
  const started = useRef(now());
  const props = useRef(p);
  props.current = p;

  useFrame((_, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    const tan = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const intro = now() - started.current < 1800;
    const wide = props.current.overview || intro;
    // Close enough to read the tiles: about 7.5 units across in portrait, 9 tall in landscape.
    const want = wide
      ? Math.max(islandSize.z / (2 * tan), islandSize.x / (2 * tan * aspect)) * 1.2
      : Math.max(7.4 / (2 * tan * aspect), 9 / (2 * tan));
    focusPoint({ ...props.current, overview: wide }, spots, goal);
    // Aim a little south of the subject: it then sits above the bottom panel.
    goal.z += wide ? islandSize.z * 0.17 : aspect < 1 ? 1.4 : 0.6;
    if (dist.current === null) {
      dist.current = want;
      look.copy(goal);
    }

    const key = subject(props.current, wide);
    const last = glide.current;
    if (!last || last.key !== key) {
      glide.current = { key, from: look.clone(), fromDist: dist.current, start: now(), ms: key === 'wide' || last?.key === 'wide' ? 2000 : 1300 };
    }
    const g = glide.current!;
    const t = Math.min(1, (now() - g.start) / g.ms);
    if (t < 1) {
      const e = easeInOut(t);
      look.lerpVectors(g.from, goal, e);
      dist.current = g.fromDist + (want - g.fromDist) * e;
    } else {
      // On the subject: stay with it. A walking pawn already moves smoothly.
      const k = 1 - Math.exp(-dt * (props.current.playback ? 10 : 4));
      look.lerp(goal, k);
      dist.current += (want - dist.current) * k;
    }
    cam.position.set(look.x, look.y + Math.sin(PITCH) * dist.current, look.z + Math.cos(PITCH) * dist.current);
    cam.lookAt(look);
    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      fog.near = dist.current * 1.2;
      fog.far = dist.current * 3.2;
    }
  });
  return null;
}

function Lights({ look, overview }: { look: THREE.Vector3; overview: boolean }) {
  const sun = useRef<THREE.DirectionalLight>(null!);
  const target = useMemo(() => new THREE.Object3D(), []);
  const wide = useRef(overview);
  wide.current = overview;
  useFrame(() => {
    target.position.copy(look);
    sun.current.position.copy(look).add(new THREE.Vector3(9, 16, 7));
    const cam = sun.current.shadow.camera;
    const r = wide.current ? 60 : 16;
    if (cam.right !== r) {
      cam.left = cam.bottom = -r;
      cam.right = cam.top = r;
      cam.updateProjectionMatrix();
    }
  });
  return (
    <>
      <hemisphereLight args={[island.skyFar, '#c9a26b', 1.25]} />
      <primitive object={target} />
      <directionalLight
        ref={sun}
        target={target}
        intensity={2.3}
        color="#fff3dc"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0008}
        shadow-camera-near={1}
        shadow-camera-far={60}
      />
    </>
  );
}

// ---------- Land and sea ----------

function Ocean() {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(340, 340, 64, 64);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const base = useMemo(() => Float32Array.from(geometry.attributes.position.array), [geometry]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      const z = base[i * 3 + 2];
      pos.setY(i, Math.sin(x * 0.35 + t * 0.9) * 0.07 + Math.cos(z * 0.3 + t * 0.7) * 0.07);
    }
    pos.needsUpdate = true;
  });
  return (
    <mesh geometry={geometry} position={[islandCentre.x, -0.55, islandCentre.z]} receiveShadow>
      <meshStandardMaterial color={island.ocean} flatShading roughness={0.4} />
    </mesh>
  );
}

/** Coastline pushed out a little: the shallow turquoise lagoon around the island. */
function offsetCoast(points: THREE.Vector3[], by: number): THREE.Vector2[] {
  return points.map((p, i) => {
    const a = points[(i - 1 + points.length) % points.length];
    const b = points[(i + 1) % points.length];
    const n = new THREE.Vector2(b.z - a.z, a.x - b.x).normalize();
    if (onLand(p.x + n.x * 0.2, p.z + n.y * 0.2)) n.negate();
    return new THREE.Vector2(p.x + n.x * by, -(p.z + n.y * by));
  });
}

function ellipse(at: THREE.Vector3, r: number, stretch: number, grow = 0): THREE.Vector2[] {
  return Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return new THREE.Vector2(at.x + Math.cos(a) * (r + grow), -(at.z + Math.sin(a) * (r * stretch + grow)));
  });
}

/** Flat-topped landmass, top at y = 0, sandy sides. */
function landGeometry(outline: THREE.Vector2[], depth: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(outline), {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.12,
    bevelSize: 0.35,
    bevelSegments: 1,
    curveSegments: 4,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -0.12, 0);
  // Extrude caps sit at both ends: lift so the top cap is at 0.
  g.computeBoundingBox();
  g.translate(0, -g.boundingBox!.max.y, 0);
  return g;
}

function Land() {
  const { main, small, lagoon } = useMemo(() => {
    const main = landGeometry(coast.map((p) => new THREE.Vector2(p.x, -p.z)), 0.6);
    const small = islets.map((it) => landGeometry(ellipse(it.at, it.r, it.stretch), 0.5));
    const lagoonShapes = [new THREE.Shape(offsetCoast(coast, 1.4)), ...islets.map((it) => new THREE.Shape(ellipse(it.at, it.r, it.stretch, 0.9)))];
    const lagoon = new THREE.ShapeGeometry(lagoonShapes, 4);
    lagoon.rotateX(-Math.PI / 2);
    return { main, small, lagoon };
  }, []);
  const materials = useMemo(
    () => [
      new THREE.MeshStandardMaterial({ color: island.grass, flatShading: true, roughness: 0.95 }),
      new THREE.MeshStandardMaterial({ color: island.sand, flatShading: true, roughness: 0.95 }),
    ],
    [],
  );
  return (
    <>
      <mesh geometry={lagoon} position-y={-0.42}>
        <meshStandardMaterial color={island.lagoon} roughness={0.5} transparent opacity={0.85} />
      </mesh>
      <mesh geometry={main} material={materials} receiveShadow />
      {small.map((g, i) => (
        <mesh key={i} geometry={g} material={materials} receiveShadow />
      ))}
      <Hills />
      <Paddies />
    </>
  );
}

function Hills() {
  const ref = useRef<THREE.InstancedMesh>(null!);
  // Rounded domes: from up close, cones read as tents.
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), []);
  useEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const color = new THREE.Color();
    hills.forEach((h, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), h.rot);
      m.compose(new THREE.Vector3(h.x, -0.05, h.z), q, new THREE.Vector3(h.scale, h.height, h.scale * 0.9));
      ref.current.setMatrixAt(i, m);
      ref.current.setColorAt(i, color.set(island.hill[h.color]));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.instanceColor!.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, []);
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, hills.length]} castShadow receiveShadow>
      <meshStandardMaterial flatShading roughness={0.95} />
    </instancedMesh>
  );
}

/** Terraced rice fields: three stacked green steps. */
function Paddies() {
  const tiers = [0.95, 0.68, 0.4];
  return (
    <>
      {tiers.map((r, tier) => (
        <PaddyTier key={tier} r={r} tier={tier} />
      ))}
    </>
  );
}

function PaddyTier({ r, tier }: { r: number; tier: number }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const geometry = useMemo(() => new THREE.CylinderGeometry(r, r * 1.04, 0.1, 9), [r]);
  useEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    paddies.forEach((p, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rot);
      m.compose(new THREE.Vector3(p.x, 0.05 + tier * 0.1, p.z), q, new THREE.Vector3(p.scale, 1, p.scale));
      ref.current.setMatrixAt(i, m);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [tier]);
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, paddies.length]} receiveShadow>
      <meshStandardMaterial color={island.rice[tier]} flatShading roughness={0.9} />
    </instancedMesh>
  );
}

/** The laterite road through every cell. */
function Road() {
  const geometry = useMemo(() => {
    const n = 1600;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      const p = road.getPoint((i % n) / n);
      const t = road.getTangent((i % n) / n);
      const side = new THREE.Vector3(-t.z, 0, t.x).normalize().multiplyScalar(0.3);
      pos.push(p.x + side.x, 0.025, p.z + side.z, p.x - side.x, 0.025, p.z - side.z);
      if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color={island.road} roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ---------- Board ----------

const tileGeometry = new THREE.CylinderGeometry(TILE_R, TILE_R + 0.05, TILE_TOP, 14).translate(0, TILE_TOP / 2, 0);
const labelGeometry = new THREE.PlaneGeometry(LABEL_W, LABEL_H).rotateX(-Math.PI / 2);
const ringGeometry = new THREE.TorusGeometry(TILE_R + 0.04, 0.07, 6, 28).rotateX(Math.PI / 2);

function Tiles({ display, highlight, selected, onCell, fontsReady }: SceneProps & { fontsReady: boolean }) {
  return (
    <>
      {CELLS.map((c, i) => (
        <Tile
          key={i}
          cell={i}
          color={c.kind !== 'site' ? island.special[c.kind] : display.mortgaged[i] ? island.tileMortgaged : island.tile}
          owner={display.owner[i]}
          texture={labelTexture(i, display)}
          glow={highlight.includes(i)}
          selected={selected === i}
          onCell={onCell}
          fontsReady={fontsReady}
        />
      ))}
    </>
  );
}

function Tile(props: {
  cell: number;
  color: string;
  owner: number | null;
  texture: THREE.Texture;
  glow: boolean;
  selected: boolean;
  onCell: (cell: number) => void;
  fontsReady: boolean;
}) {
  const { cell, color, owner, texture, glow, selected, onCell } = props;
  const ring = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const pulse = glow ? 1 + Math.sin(clock.elapsedTime * 5) * 0.06 : 1;
    ring.current.scale.setScalar(pulse);
  });
  const ringColor = glow ? '#ffffff' : owner !== null ? island.players[owner] : selected ? island.ink : null;
  return (
    <group position={cellPos[cell]}>
      <mesh
        geometry={tileGeometry}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onCell(cell);
        }}
      >
        <meshStandardMaterial color={color} flatShading roughness={0.8} />
      </mesh>
      <mesh geometry={labelGeometry} position-y={TILE_TOP + 0.004}>
        <meshBasicMaterial map={texture} transparent toneMapped={false} />
      </mesh>
      {ringColor && (
        <mesh ref={ring} geometry={ringGeometry} position-y={TILE_TOP - 0.02}>
          <meshStandardMaterial color={ringColor} emissive={glow ? '#ffe9a8' : '#000000'} emissiveIntensity={glow ? 0.6 : 0} flatShading />
        </mesh>
      )}
    </group>
  );
}

/** Houses stand side by side across the road from the landmark; the hotel takes the middle. */
const HOUSE_SLOTS = [[], [1], [0, 2], [0, 1, 2]];

function Buildings({ display }: { display: Shown }) {
  return (
    <>
      {CELLS.map((c, cell) => {
        const level = display.level[cell];
        const owner = display.owner[cell];
        if (c.kind !== 'site' || owner === null) return null;
        const color = island.players[owner];
        if (level === 0) return <Building key={`${cell}:flag`} name="flag" spot={houseAt(cell, 1)} color={color} />;
        if (level === MAX_LEVEL) return <Building key={`${cell}:hotel`} name="hotel" spot={houseAt(cell, 1)} color={color} scale={0.9} />;
        return HOUSE_SLOTS[level].map((slot) => <Building key={`${cell}:house${slot}`} name="house" spot={houseAt(cell, slot)} color={color} />);
      })}
    </>
  );
}

/** Pops up when built, with a little bounce. */
function Building({ name, spot, color, scale = 1 }: { name: string; spot: Spot; color: string; scale?: number }) {
  const ref = useRef<THREE.Group>(null!);
  const born = useRef(now());
  useFrame(() => {
    const t = Math.min(1, (now() - born.current) / 750);
    const s = t < 1 ? 1.15 * Math.sin((t * Math.PI) / 2) + (t > 0.7 ? (1 - t) * 0.5 : 0) : 1.15;
    ref.current.scale.setScalar(Math.max(0.01, s * scale));
  });
  return (
    <group ref={ref} position={spot.position} rotation={spot.rotation}>
      <Model name={name} color={color} />
    </group>
  );
}

const cellsOf = (kind: string) => CELLS.flatMap((c, i) => (c.kind === kind ? [i] : []));

/** What stands beside each special cell. */
const SPECIAL_MODEL: Record<string, string> = {
  start: 'market',
  taxi: 'busstop',
  tax: 'office',
  landtax: 'cadastre',
  festival: 'stage',
  jail: 'prison',
  roadblock: 'roadblock',
};

function Landmarks() {
  const charms = useRef<THREE.Group>(null!);
  const storm = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    charms.current.children.forEach((g, i) => {
      g.rotation.y = t * 1.4 + i;
      g.position.y = 0.95 + Math.sin(t * 2 + i) * 0.08;
    });
    storm.current.rotation.y = -t * 1.8;
    storm.current.rotation.z = Math.sin(t * 1.3) * 0.08;
  });
  const cyclone = cellsOf('cyclone')[0];
  return (
    <>
      {CELLS.map((c, cell) => {
        if (c.kind === 'site') {
          const { model } = SITES[c.name];
          const spot = landmarkAt(cell);
          if (model !== 'rova') return <Model key={cell} name={model} {...spot} scale={1.1} />;
          // The palace on its hill.
          return (
            <group key={cell} {...spot}>
              <mesh position-y={0.12} castShadow receiveShadow>
                <cylinderGeometry args={[0.85, 1.1, 0.3, 9]} />
                <meshStandardMaterial color={island.grassDark} flatShading />
              </mesh>
              <Model name="rova" position-y={0.27} scale={1.05} />
            </group>
          );
        }
        const model = SPECIAL_MODEL[c.kind];
        return model ? <Model key={cell} name={model} {...landmarkAt(cell)} scale={c.kind === 'start' ? 1.25 : 1.1} /> : null;
      })}
      <group ref={charms}>
        {[...cellsOf('vintana'), ...cellsOf('fihavanana')].map((i) => (
          <group key={i} position={[cellPos[i].x, 0.95, cellPos[i].z]}>
            <Model name={CELLS[i].kind === 'vintana' ? 'sapphire' : 'sobika'} scale={CELLS[i].kind === 'vintana' ? 1.4 : 1.6} shadows={false} />
          </group>
        ))}
      </group>
      <group position={landmarkAt(cyclone).position}>
        <group ref={storm} scale={1.6}>
          <Model name="cyclone" />
        </group>
      </group>
    </>
  );
}

function Decor() {
  return (
    <>
      {Object.entries(scenery).map(([name, items]) => (
        <Scatter key={name} name={name} items={items} lift={name === 'pirogue' || name === 'whale' ? -0.5 : 0} />
      ))}
    </>
  );
}

// ---------- Pawns and dice ----------

/** Pawns stand on the back (north) half of a tile, so its name stays readable. */
const STAND_Z = -0.36;
/** Where several pawns share a cell, they stand side by side. */
const SHARE = [
  [-0.3, 0],
  [0.3, 0],
  [-0.62, 0.36],
  [0.62, 0.36],
];

/**
 * Where a pawn is `elapsed` ms into its own action's replay: a point on the
 * road (as a fractional cell index), or in mid-air on its way to the fonja.
 */
function walking(seat: number, pb: Playback, elapsed: number): { at: THREE.Vector3; u: number; cell: number; hop: number; dir: number } {
  let cell = pb.base.pos[seat];
  for (let k = 0; k < pb.log.events.length; k++) {
    const e = pb.log.events[k];
    if (e.t !== 'move') continue;
    const start = pb.offsets[k];
    const dur = eventMs(e);
    if (elapsed < start) break;
    if (elapsed >= start + dur) {
      cell = e.path[e.path.length - 1];
      continue;
    }
    const t = easeSine((elapsed - start) / dur);
    if (e.via === 'jail') {
      // Straight over the island, in one big leap.
      const at = roadAt(cell).lerp(cellPos[JAIL], t);
      return { at, u: cell, cell, hop: Math.sin(t * Math.PI) * 2.5, dir: 0 };
    }
    // At an even pace along the road (cells aren't all as far apart), easing in and out.
    const dir = e.via === 'back' ? -1 : 1;
    const legs = e.path.map((_, j) => stretch(dir > 0 ? (j === 0 ? cell : e.path[j - 1]) : e.path[j]));
    let s = t * legs.reduce((a, b) => a + b, 0);
    let j = 0;
    while (j < legs.length - 1 && s > legs[j]) s -= legs[j++];
    const local = Math.min(1, s / legs[j]);
    const from = j === 0 ? cell : e.path[j - 1];
    const hop = e.via === 'taxi' ? 0.05 : Math.sin(local * Math.PI) * (e.via === 'card' ? 0.7 : Math.min(0.6, 0.2 + legs[j] * 0.06));
    const u = from + dir * local;
    return { at: roadAt(u), u, cell: from, hop, dir };
  }
  return { at: roadAt(cell), u: cell, cell, hop: 0, dir: 0 };
}

function Pawn({ seat, spots, display, playback, turn }: SceneProps & { seat: number; spots: PawnSpots }) {
  const ref = useRef<THREE.Group>(null!);
  const marker = useRef<THREE.Mesh>(null!);
  const cage = useRef<THREE.Group>(null!);
  const facing = useRef(0);
  const placed = useRef(false);
  const live = useRef({ display, playback, turn });
  live.current = { display, playback, turn };
  const color = island.players[seat];

  useFrame(({ clock }, dt) => {
    const { display, playback, turn } = live.current;
    const mine = playback && playback.log.player === seat;
    const pos = display.pos[seat];
    const { at, u, cell, hop, dir } = mine ? walking(seat, playback, now() - playback.start) : { at: roadAt(pos), u: pos, cell: pos, hop: 0, dir: 0 };
    ref.current.visible = !display.out[seat];
    const p = at;
    p.z += STAND_Z;
    if (dir === 0 && hop === 0) {
      // Standing still: make room for anyone else on the same cell.
      const here = display.pos.flatMap((c, s) => (c === cell && !display.out[s] ? [s] : []));
      if (here.length > 1) {
        const [dx, dz] = SHARE[here.indexOf(seat)];
        p.x += dx;
        p.z += dz;
      }
    }
    // Glide into place (a pawn making room on a shared cell), but keep up with a walk.
    const k = placed.current && hop === 0 ? 1 - Math.exp(-dt * 16) : 1;
    placed.current = true;
    ref.current.position.x += (p.x - ref.current.position.x) * k;
    ref.current.position.z += (p.z - ref.current.position.z) * k;
    ref.current.position.y = TILE_TOP + hop;
    spots[seat].set(ref.current.position.x, 0, ref.current.position.z - STAND_Z);
    // Face the way it's going; face the camera when standing.
    const ahead = dir === 0 ? null : roadAt(u + dir * 0.1).sub(roadAt(u));
    const want = ahead ? Math.atan2(ahead.x, ahead.z) : 0;
    let diff = want - facing.current;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    facing.current += diff * (1 - Math.exp(-dt * 6));
    ref.current.rotation.y = facing.current;
    cage.current.visible = display.jail[seat] > 0 && hop === 0;
    cage.current.rotation.y = -facing.current;
    const active = (playback ? playback.log.player : turn) === seat;
    marker.current.visible = active;
    marker.current.position.y = 1.35 + Math.sin(clock.elapsedTime * 4) * 0.08;
    marker.current.rotation.y = clock.elapsedTime * 2 - facing.current;
  });

  return (
    <group ref={ref}>
      <mesh castShadow receiveShadow position-y={0.035}>
        <cylinderGeometry args={[0.3, 0.33, 0.07, 14]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      <Model name={island.pawns[seat].model} position-y={0.07} />
      <group ref={cage} visible={false}>
        <Model name="cage" scale={0.95} shadows={false} />
      </group>
      <mesh ref={marker} rotation-x={Math.PI}>
        <coneGeometry args={[0.15, 0.32, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} flatShading />
      </mesh>
    </group>
  );
}

const dieGeometry = new THREE.BoxGeometry(0.36, 0.36, 0.36);

/** Two dice thrown by the pawn when a turn starts; they stay until the walk is over. */
function Dice({ spots, playback }: { spots: PawnSpots; playback: Playback | null }) {
  const group = useRef<THREE.Group>(null!);
  const dice = useRef<THREE.Mesh[]>([]);
  const materials = useMemo(() => diceMaterials(), []);
  const throwAt = useRef(new THREE.Vector3());
  const spin = useMemo(() => [new THREE.Vector3(1, 0.4, 0.2).normalize(), new THREE.Vector3(-0.3, 0.2, 1).normalize()], []);
  const index = playback ? playback.log.events.findIndex((e) => e.t === 'dice') : -1;
  const roll = index >= 0 ? (playback!.log.events[index] as Extract<TsenaEvent, { t: 'dice' }>) : null;

  useEffect(() => {
    if (roll && playback) throwAt.current.copy(spots[playback.log.player]);
  }, [roll, playback, spots]);

  useFrame(() => {
    if (!roll || !playback) {
      group.current.visible = false;
      return;
    }
    const elapsed = now() - playback.start - playback.offsets[index];
    const end = playback.offsets[index] + PACE.dice;
    const firstMove = playback.log.events.findIndex((e) => e.t === 'move');
    const until = firstMove >= 0 ? playback.offsets[firstMove] + eventMs(playback.log.events[firstMove]) : end + 600;
    group.current.visible = elapsed >= 0 && elapsed + playback.offsets[index] < until;
    const t = Math.min(1, elapsed / (PACE.dice * 0.8));
    dice.current.forEach((d, i) => {
      const side = i === 0 ? -0.32 : 0.32;
      const bounce = t < 0.7 ? 2.2 * (1 - (t / 0.7) ** 2) : Math.sin(((t - 0.7) / 0.3) * Math.PI) * 0.18;
      d.position.set(throwAt.current.x + side, TILE_TOP + 0.18 + bounce, throwAt.current.z + 1.05 + (1 - t) * 0.4);
      const q = new THREE.Quaternion().setFromEuler(DIE_UP[roll.dice[i]]);
      q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.4 + i * 0.5));
      q.multiply(new THREE.Quaternion().setFromAxisAngle(spin[i], (1 - t) ** 2 * Math.PI * 5));
      d.quaternion.copy(q);
    });
  });

  return (
    <group ref={group} visible={false}>
      {[0, 1].map((i) => (
        <mesh key={i} ref={(m) => m && (dice.current[i] = m)} geometry={dieGeometry} material={materials} castShadow />
      ))}
    </group>
  );
}
