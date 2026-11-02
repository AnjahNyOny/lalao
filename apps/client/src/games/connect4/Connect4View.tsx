import { COLS, ROWS, cellIndex, type Connect4State, type Disc } from '@game/games/connect4';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GameViewProps } from '../types';
import { connect4Scene as scene } from './theme';

const DISC_COLORS = scene.discs;
const HOLE_R = 0.4;
const DISC_R = 0.37;
const DEPTH = 0.5;
const PAD = 0.3;
const BOARD_W = COLS + PAD * 2;
const BOARD_H = ROWS + PAD * 2;
/** Board centre height, standing on its feet. */
const BOARD_Y = BOARD_H / 2 + 0.35;
const DROP_FROM = ROWS / 2 + 1;

const cellX = (col: number) => col - (COLS - 1) / 2;
const cellY = (row: number) => row - (ROWS - 1) / 2;

function useBoardGeometry() {
  return useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-BOARD_W / 2, -BOARD_H / 2);
    shape.lineTo(BOARD_W / 2, -BOARD_H / 2);
    shape.lineTo(BOARD_W / 2, BOARD_H / 2);
    shape.lineTo(-BOARD_W / 2, BOARD_H / 2);
    shape.closePath();
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const hole = new THREE.Path();
        hole.absarc(cellX(c), cellY(r), HOLE_R, 0, Math.PI * 2, true);
        shape.holes.push(hole);
      }
    }
    // Few curve segments = faceted holes, the low-poly look.
    const geo = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: false, curveSegments: 9 });
    geo.translate(0, 0, -DEPTH / 2);
    return geo;
  }, []);
}

function DiscMesh({ col, row, disc, animate, highlight, ghost }: {
  col: number;
  row: number;
  disc: Disc;
  animate?: boolean;
  highlight?: boolean;
  ghost?: boolean;
}) {
  const mesh = useRef<THREE.Mesh>(null!);
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  const targetY = ghost ? DROP_FROM : cellY(row);
  const sim = useRef({ y: animate ? DROP_FROM : targetY, v: 0 });

  useFrame(({ clock }, delta) => {
    const s = sim.current;
    const dt = Math.min(delta, 0.05);
    if (s.y > targetY || s.v !== 0) {
      s.v -= 40 * dt;
      s.y += s.v * dt;
      if (s.y <= targetY) {
        s.y = targetY;
        // Small bounce, then settle.
        s.v = Math.abs(s.v) > 3 ? -s.v * 0.3 : 0;
      }
    }
    mesh.current.position.y = s.y;
    if (highlight) mat.current.emissiveIntensity = 0.35 + 0.35 * Math.sin(clock.elapsedTime * 7);
  });

  return (
    <mesh ref={mesh} position={[cellX(col), targetY, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow={!ghost}>
      <cylinderGeometry args={[DISC_R, DISC_R, DEPTH * 0.6, 12]} />
      <meshStandardMaterial
        ref={mat}
        color={DISC_COLORS[disc]}
        emissive={DISC_COLORS[disc]}
        emissiveIntensity={0}
        flatShading
        roughness={0.55}
        transparent={ghost}
        opacity={ghost ? 0.55 : 1}
      />
    </mesh>
  );
}

function Board({ state, myDisc, onPlay }: { state: Connect4State; myDisc: Disc | null; onPlay: (col: number) => void }) {
  const geometry = useBoardGeometry();
  const [hover, setHover] = useState<number | null>(null);
  const myTurn = myDisc !== null && state.turn === myDisc && state.winner === null;
  const win = new Set(state.winLine ?? []);

  return (
    <group position={[0, BOARD_Y, 0]}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial color={scene.board} flatShading roughness={0.6} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (BOARD_W / 2 - 0.35), -BOARD_H / 2 - 0.1, 0]} castShadow>
          <boxGeometry args={[0.7, 0.5, 1.8]} />
          <meshStandardMaterial color={scene.boardFeet} flatShading />
        </mesh>
      ))}

      {state.board.map((disc, i) =>
        disc === null ? null : (
          <DiscMesh
            key={i}
            col={i % COLS}
            row={Math.floor(i / COLS)}
            disc={disc}
            animate={state.last !== null && cellIndex(state.last.col, state.last.row) === i}
            highlight={win.has(i)}
          />
        ),
      )}

      {myTurn && hover !== null && <DiscMesh key={`ghost-${hover}`} col={hover} row={0} disc={myDisc} ghost />}

      {/* Invisible column hit areas; transparent rather than visible=false so they still raycast. */}
      {Array.from({ length: COLS }, (_, c) => (
        <mesh
          key={c}
          position={[cellX(c), 0.5, 0]}
          onPointerOver={(e) => (e.stopPropagation(), setHover(c))}
          onPointerOut={() => setHover((h) => (h === c ? null : h))}
          onClick={(e) => {
            e.stopPropagation();
            if (myTurn) onPlay(c);
          }}
        >
          <boxGeometry args={[1, ROWS + 2, DEPTH * 2]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Keeps the whole board in frame, portrait or landscape. */
function CameraRig() {
  const { camera, size } = useThree();
  useEffect(() => {
    const aspect = size.width / size.height;
    const halfFov = THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov / 2);
    // Far enough for the board's height, and for its width on narrow screens.
    const dist = Math.max(13.5, (BOARD_W / 2 + 0.7) / (Math.tan(halfFov) * aspect));
    camera.position.set(0, BOARD_Y + dist * 0.18, dist);
    camera.lookAt(0, BOARD_Y - 0.3, 0);
  }, [camera, size]);
  return null;
}

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[60, 12]} />
      <meshStandardMaterial color={scene.ground} flatShading />
    </mesh>
  );
}

export function Connect4View({ view, me, room, act }: GameViewProps) {
  const state = view as Connect4State;
  const myDisc = state.players.indexOf(me);
  const name = (id: string) => room.players.find((p) => p.id === id)?.name ?? '?';
  const turnName = name(state.players[state.turn]);

  return (
    <div className="game-stage">
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 42 }}>
        <color attach="background" args={[scene.sky]} />
        <hemisphereLight args={[scene.hemiSky, scene.hemiGround, 1.4]} />
        <directionalLight
          position={[5, 12, 8]}
          intensity={2.2}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-8}
          shadow-camera-right={8}
          shadow-camera-top={10}
          shadow-camera-bottom={-4}
        />
        <CameraRig />
        <Ground />
        <Board state={state} myDisc={myDisc === -1 ? null : (myDisc as Disc)} onPlay={(col) => act({ col })} />
      </Canvas>

      <div className="hud">
        {state.players.map((id, i) => (
          <div key={id} className={`hud-player ${state.turn === i && state.winner === null ? 'active' : ''}`}>
            <span className="chip" style={{ background: DISC_COLORS[i] }} />
            {name(id)}
            {id === me && ' (toi)'}
          </div>
        ))}
      </div>
      {state.winner === null && state.moves < COLS * ROWS && (
        <div className="turn-banner">{state.players[state.turn] === me ? 'À toi de jouer !' : `Au tour de ${turnName}…`}</div>
      )}
    </div>
  );
}
