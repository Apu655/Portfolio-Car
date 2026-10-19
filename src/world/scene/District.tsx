import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { CuboidCollider, CylinderCollider, RigidBody, TrimeshCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { STATIC_COLLIDERS } from '../district/colliders';
import { BUILDINGS, SECTION_GATES, TOWER } from '../district/layout';
import { CityBuildings } from './CityBuildings';
import { dissolveTargets, makeDissolvable, type Dissolvable } from './dissolve';
import { useSurfaceDetail } from './useSurfaceDetail';
import { Selectable } from './Selectable';

export const MODEL_URLS = {
  district: '/models/district.glb',
  tower: '/models/career_tower.glb',
  kiosks: '/models/kiosks.glb',
  landmarks: '/models/landmarks.glb',
  billboard: '/models/billboard.glb',
  props: '/models/props.glb',
  car: '/models/car.glb',
} as const;

/** Load a model with the bundled meshopt decoder (no Draco, no CDN). */
export function useModel(url: string) {
  return useGLTF(url, false, true);
}

export function enableShadows(root: THREE.Object3D, cast = true, receive = true): THREE.Object3D {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
  });
  return root;
}

/**
 * World-space triangle soup for a trimesh collider. Reads positions through the attribute accessors so
 * meshopt-quantized (normalized int16) geometry and its node transforms come out in meters.
 */
function trimeshOf(root: THREE.Object3D): { vertices: Float32Array; indices: Uint32Array } {
  root.updateWorldMatrix(true, true);
  const vertices: number[] = [];
  const indices: number[] = [];
  const p = new THREE.Vector3();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const position = mesh.geometry.attributes.position;
    const base = vertices.length / 3;
    for (let i = 0; i < position.count; i++) {
      p.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
      vertices.push(p.x, p.y, p.z);
    }
    const index = mesh.geometry.index;
    const count = index ? index.count : position.count;
    for (let i = 0; i < count; i++) indices.push(base + (index ? index.getX(i) : i));
  });
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) };
}

/** Static scenery: ground (trimesh collider), roads, landscaping, tower, Contact kiosk, gates, city blocks. Clicking the tower or the kiosk travels there. */
export function District() {
  const district = useModel(MODEL_URLS.district);
  const tower = useModel(MODEL_URLS.tower);
  const kiosks = useModel(MODEL_URLS.kiosks);

  const parts = useMemo(() => {
    const scene = district.scene;
    // Clone rather than detach: StrictMode runs this twice, and the original must still be findable.
    const source = scene.getObjectByName('collider_mesh_ground')!;
    source.visible = false;
    const ground = enableShadows(source.clone(), false, true);
    ground.visible = true;
    const groundShape = trimeshOf(source);
    enableShadows(scene, true, true);
    // Flat paint and paving only receive shadows.
    for (const name of ['roads', 'markings_white', 'markings_yellow', 'plazas', 'sidewalks']) {
      const o = scene.getObjectByName(name);
      if (o) enableShadows(o, false, true);
    }
    enableShadows(tower.scene);
    enableShadows(kiosks.scene);
    // Everything tall enough to hide the car can dissolve while it does (R3); the city blocks register their own
    // (CityBuildings). Kiosks share materials, so they get their own copies; the tower is a single instance and is
    // patched in place.
    const dissolvables: Array<[string, Dissolvable]> = [
      ['tower', makeDissolvable(tower.scene, { cloneMaterials: false })],
      ...SECTION_GATES.map((g): [string, Dissolvable] => [`gate-${g.section}`, makeDissolvable(kiosks.scene.getObjectByName(`gate_${g.section}`)!, { cloneMaterials: true })]),
      ['kiosk-contact', makeDissolvable(kiosks.scene.getObjectByName('kiosk_contact')!, { cloneMaterials: true })],
    ];
    // The Contact kiosk renders as its own clickable object; the section gates stay in the shared kiosks scene.
    const contactKiosk = kiosks.scene.getObjectByName('kiosk_contact')!;
    return { scene, ground, groundShape, dissolvables, contactKiosk };
  }, [district, tower, kiosks]);

  // Building footprints for the ground's contact shading; the records hold world-axis half sizes.
  const footprints = useMemo(() => BUILDINGS.map((b) => ({ x: b.center[0], z: b.center[1], hx: b.half[0], hz: b.half[1], rotationY: 0 })), []);
  useSurfaceDetail(parts.scene, footprints);

  useEffect(() => {
    parts.dissolvables.forEach(([key, d]) => dissolveTargets.set(key, d));
    return () => parts.dissolvables.forEach(([key]) => dissolveTargets.delete(key));
  }, [parts]);

  return (
    <>
      <RigidBody type="fixed" colliders={false} friction={1}>
        <TrimeshCollider args={[parts.groundShape.vertices, parts.groundShape.indices]} friction={1} />
      </RigidBody>
      <primitive object={parts.ground} />
      <primitive object={parts.scene} />
      <Selectable selection={{ section: 'experience' }}>
        <primitive object={tower.scene} position={[TOWER.center[0], 0, TOWER.center[1]]} />
      </Selectable>
      <primitive object={kiosks.scene} />
      <Selectable selection={{ section: 'contact' }}>
        <primitive object={parts.contactKiosk} />
      </Selectable>
      <CityBuildings />
      <RigidBody type="fixed" colliders={false} friction={0.6} restitution={0.1}>
        {STATIC_COLLIDERS.map((c) =>
          c.kind === 'box' ? (
            <CuboidCollider key={c.name} args={c.half} position={c.position} rotation={[0, c.rotationY, 0]} />
          ) : (
            <CylinderCollider key={c.name} args={[c.halfHeight, c.radius]} position={c.position} />
          ),
        )}
      </RigidBody>
    </>
  );
}

for (const url of Object.values(MODEL_URLS)) useGLTF.preload(url, false, true);
