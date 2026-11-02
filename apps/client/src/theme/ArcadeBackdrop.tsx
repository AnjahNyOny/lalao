import { mulberry32 } from '@game/core';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { NEON } from './arcade';

const GRID_SIZE = 80;
const GRID_DIVISIONS = 40;
const CELL = GRID_SIZE / GRID_DIVISIONS;
const SCROLL_SPEED = 3;

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function Grid() {
  const grid = useMemo(() => {
    const g = new THREE.GridHelper(GRID_SIZE, GRID_DIVISIONS, NEON.pink, NEON.pink);
    const mat = g.material as THREE.LineBasicMaterial;
    mat.transparent = true;
    mat.opacity = 0.75;
    return g;
  }, []);
  useFrame((_, dt) => {
    grid.position.z = (grid.position.z + Math.min(dt, 0.05) * SCROLL_SPEED) % CELL;
  });
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
        <meshBasicMaterial color={NEON.violet} />
      </mesh>
      <primitive object={grid} />
    </>
  );
}

const sunVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Yellow-to-pink gradient, with horizontal gaps in the lower half that widen
// towards the horizon and drift downwards.
const sunFragment = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float y = vUv.y;
    if (y < 0.55) {
      float band = fract(y * 9.0 + uTime * 0.25);
      if (band < (0.55 - y) * 1.1) discard;
    }
    vec3 col = mix(vec3(1.0, 0.16, 0.43), vec3(1.0, 0.85, 0.25), smoothstep(0.1, 0.95, y));
    gl_FragColor = vec4(col, 1.0);
  }
`;

function Sun() {
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <mesh position={[0, 5.5, -42]}>
      <circleGeometry args={[8.5, 24]} />
      <shaderMaterial vertexShader={sunVertex} fragmentShader={sunFragment} uniforms={uniforms} fog={false} />
    </mesh>
  );
}

/** Wireframe pyramids along the horizon, kept clear of the sun in the middle. */
function Mountains() {
  const peaks = useMemo(() => {
    const rand = mulberry32(7);
    return Array.from({ length: 16 }, (_, i) => {
      const side = i % 2 ? 1 : -1;
      const x = side * (9 + rand() * 26);
      return { x, z: -30 - rand() * 8, h: 3 + rand() * 6 + Math.abs(x) * 0.12, r: 3 + rand() * 3, rot: rand() * Math.PI };
    });
  }, []);
  const cone = useMemo(() => new THREE.ConeGeometry(1, 1, 4), []);
  const edges = useMemo(() => new THREE.EdgesGeometry(cone), [cone]);
  return (
    <>
      {peaks.map((p, i) => (
        <group key={i} position={[p.x, p.h / 2, p.z]} scale={[p.r, p.h, p.r]} rotation={[0, p.rot, 0]}>
          <mesh geometry={cone}>
            <meshBasicMaterial color={NEON.violet} />
          </mesh>
          <lineSegments geometry={edges}>
            <lineBasicMaterial color={NEON.cyan} />
          </lineSegments>
        </group>
      ))}
    </>
  );
}

function Stars() {
  const geometry = useMemo(() => {
    const rand = mulberry32(42);
    const pos = new Float32Array(240 * 3);
    for (let i = 0; i < pos.length; i += 3) {
      pos[i] = (rand() - 0.5) * 120;
      pos[i + 1] = 8 + rand() * 40;
      pos[i + 2] = -45 - rand() * 10;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  const ref = useRef<THREE.PointsMaterial>(null!);
  useFrame(({ clock }) => {
    ref.current.opacity = 0.65 + 0.25 * Math.sin(clock.elapsedTime * 1.7);
  });
  return (
    <points geometry={geometry}>
      <pointsMaterial ref={ref} color="#ffffff" size={0.25} transparent fog={false} />
    </points>
  );
}

/** Synthwave scenery behind the main menu. Purely decorative: no pointer events. */
export function ArcadeBackdrop() {
  return (
    <div className="backdrop" aria-hidden>
      <Canvas
        dpr={[1, 1.5]}
        frameloop={reducedMotion() ? 'demand' : 'always'}
        camera={{ position: [0, 2.2, 10], fov: 60 }}
        // Pitched down so the horizon (and the sun) sit high, behind the logo.
        onCreated={({ camera }) => camera.lookAt(0, -8, -40)}
        gl={{ antialias: true }}
      >
        <color attach="background" args={[NEON.night]} />
        <fog attach="fog" args={[NEON.night, 12, 48]} />
        <Stars />
        <Sun />
        <Mountains />
        <Grid />
      </Canvas>
    </div>
  );
}
