import { useLoader } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Placement } from './map';

/** Built by assets/blender/tsena_assets.py. Other games pass their own `url`. */
export const MODELS_URL = '/models/tsena.glb';

// Fetched as soon as the app loads, so a solo game started offline still has its models.
if (typeof window !== 'undefined') useLoader.preload(GLTFLoader, MODELS_URL);

interface Part {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
}

const partsCache = new Map<string, Part[]>();

/** One mesh per material: a model's pieces, positioned around its own origin. */
function useParts(name: string, url = MODELS_URL): Part[] {
  const gltf = useLoader(GLTFLoader, url);
  return useMemo(() => {
    const key = `${url}#${name}`;
    const cached = partsCache.get(key);
    if (cached) return cached;
    const root = gltf.scene.getObjectByName(name);
    if (!root) throw new Error(`Modèle introuvable : ${name}`);
    const parts: Part[] = [];
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const material = o.material as THREE.MeshStandardMaterial;
      material.flatShading = true;
      parts.push({ geometry: o.geometry, material });
    });
    partsCache.set(key, parts);
    return parts;
  }, [gltf, name, url]);
}

const ownerMaterials = new Map<string, THREE.MeshStandardMaterial>();

/** The 'Owner' material (awnings, roofs), repainted in a player's colour. */
function paint(material: THREE.MeshStandardMaterial, color: string | undefined): THREE.Material {
  if (!color || material.name !== 'Owner') return material;
  let m = ownerMaterials.get(color);
  if (!m) {
    m = material.clone();
    m.color.set(color);
    ownerMaterials.set(color, m);
  }
  return m;
}

type GroupProps = JSX.IntrinsicElements['group'];

/** A single model from the .glb. `color` repaints its 'Owner' parts. */
export function Model({ name, url, color, shadows = true, ...props }: GroupProps & { name: string; url?: string; color?: string; shadows?: boolean }) {
  const parts = useParts(name, url);
  return (
    <group {...props}>
      {parts.map((p, i) => (
        <mesh key={i} geometry={p.geometry} material={paint(p.material, color)} castShadow={shadows} receiveShadow={shadows} />
      ))}
    </group>
  );
}

/** Many copies of a model in a few draw calls (one instanced mesh per material). */
export function Scatter({ name, url, items, lift = 0 }: { name: string; url?: string; items: Placement[]; lift?: number }) {
  const parts = useParts(name, url);
  return (
    <>
      {parts.map((p, i) => (
        <ScatterPart key={i} part={p} items={items} lift={lift} />
      ))}
    </>
  );
}

function ScatterPart({ part, items, lift }: { part: Part; items: Placement[]; lift: number }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    items.forEach((it, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rot);
      m.compose(new THREE.Vector3(it.x, lift, it.z), q, new THREE.Vector3(it.scale, it.scale, it.scale));
      ref.current.setMatrixAt(i, m);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [items, lift]);
  return <instancedMesh ref={ref} args={[part.geometry, part.material, items.length]} castShadow receiveShadow />;
}
