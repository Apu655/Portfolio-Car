import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  CuboidCollider,
  CylinderCollider,
  RigidBody,
  type ContactForcePayload,
  type RapierRigidBody,
} from '@react-three/rapier';
import * as THREE from 'three';
import { PROPS, type PropPlacement } from '../district/layout';
import { emit } from '../events';
import { impactIntensity, MIN_IMPACT, PROP_SPECS, shouldReset } from '../physics/props';
import { MODEL_URLS, enableShadows, useModel } from './District';

/** Minimum seconds between impact sounds from the same object. */
const IMPACT_COOLDOWN = 0.15;

interface Tracked {
  body: RapierRigidBody;
  rest: PropPlacement;
  idle: number;
}

function restCenter(p: PropPlacement): [number, number, number] {
  return [p.position[0], p.position[1] + PROP_SPECS[p.kind].half[1], p.position[2]];
}

function Collider({ kind }: { kind: PropPlacement['kind'] }) {
  const spec = PROP_SPECS[kind];
  return spec.shape === 'box' ? (
    <CuboidCollider args={spec.half} mass={spec.mass} friction={spec.friction} restitution={spec.restitution} />
  ) : (
    <CylinderCollider args={[spec.half[1], spec.half[0]]} mass={spec.mass} friction={spec.friction} restitution={spec.restitution} />
  );
}

/** Cones, crates, barrels, signs, benches, and the brick wall: physical, sleeping until hit, tidied up later. */
export function Props() {
  const gltf = useModel(MODEL_URLS.props);
  const camera = useThree((s) => s.camera);
  const tracked = useRef<Tracked[]>([]);
  const lastImpact = useRef(new Map<number, number>());
  const clock = useRef(0);
  const sinceReset = useRef(0);
  const scratch = useMemo(() => ({ frustum: new THREE.Frustum(), matrix: new THREE.Matrix4(), point: new THREE.Vector3() }), []);

  const loose = useMemo(() => PROPS.filter((p) => p.kind !== 'brick'), []);
  const bricks = useMemo(() => PROPS.filter((p) => p.kind === 'brick'), []);
  const visuals = useMemo(
    () => loose.map((p) => enableShadows(gltf.scene.getObjectByName(`prop_${p.kind}`)!.clone(), true, true)),
    [gltf, loose],
  );
  const brickMesh = useMemo(() => {
    const source = gltf.scene.getObjectByName('prop_brick') as THREE.Mesh;
    source.updateMatrix();
    // The node's own transform carries the meshopt dequantization scale and offset, so keep it per instance.
    return { geometry: source.geometry, material: source.material as THREE.Material, local: source.matrix.clone() };
  }, [gltf]);
  // Bricks are plain bodies drawn through one instanced mesh, synced each frame while awake.
  const brickBodies = useRef<(RapierRigidBody | null)[]>([]);
  const brickInstances = useRef<THREE.InstancedMesh>(null);
  const brickMatrix = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(1, 1, 1) }), []);

  const onImpact = (kind: PropPlacement['kind'], payload: ContactForcePayload) => {
    const spec = PROP_SPECS[kind];
    const intensity = impactIntensity(payload.maxForceMagnitude, spec.mass);
    if (intensity < MIN_IMPACT) return;
    const body = payload.target.rigidBody;
    if (!body) return;
    const last = lastImpact.current.get(body.handle) ?? -1;
    if (clock.current - last < IMPACT_COOLDOWN) return;
    lastImpact.current.set(body.handle, clock.current);
    const p = body.translation();
    emit({ type: 'impact', material: spec.material, intensity, position: [p.x, p.y, p.z], source: `${kind}-${body.handle}` });
  };

  // Start everything asleep so the stacks don't jitter before the car arrives.
  useEffect(() => {
    const timer = setTimeout(() => tracked.current.forEach((t) => t.body.isValid() && t.body.sleep()), 300);
    return () => clearTimeout(timer);
  }, []);

  // Put disturbed props back once they have been still for a while and the visitor isn't looking.
  useFrame((_, dt) => {
    clock.current += dt;
    const mesh = brickInstances.current;
    if (mesh) {
      let moved = false;
      brickBodies.current.forEach((body, i) => {
        if (!body?.isValid() || (body.isSleeping() && mesh.userData.synced)) return;
        const t = body.translation();
        const r = body.rotation();
        brickMatrix.m.compose(brickMatrix.p.set(t.x, t.y, t.z), brickMatrix.q.set(r.x, r.y, r.z, r.w), brickMatrix.s);
        mesh.setMatrixAt(i, brickMatrix.m.multiply(brickMesh.local));
        moved = true;
      });
      if (moved) mesh.instanceMatrix.needsUpdate = true;
      mesh.userData.synced = true;
    }
    sinceReset.current += dt;
    if (sinceReset.current < 1) return;
    const elapsed = sinceReset.current;
    sinceReset.current = 0;
    scratch.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    scratch.frustum.setFromProjectionMatrix(scratch.matrix);
    for (const t of tracked.current) {
      if (!t.body.isValid()) continue;
      const p = t.body.translation();
      const v = t.body.linvel();
      const moving = Math.hypot(v.x, v.y, v.z) > 0.05;
      t.idle = moving ? 0 : t.idle + elapsed;
      const rest = restCenter(t.rest);
      const q = t.body.rotation();
      const tilt = 2 * (q.x * q.x + q.z * q.z); // 0 upright, 2 upside down
      const visible = scratch.frustum.containsPoint(scratch.point.set(p.x, p.y, p.z));
      if (shouldReset({ displaced: Math.hypot(p.x - rest[0], p.y - rest[1], p.z - rest[2]), tilt, idleSeconds: t.idle, visible })) {
        t.body.setTranslation({ x: rest[0], y: rest[1], z: rest[2] }, false);
        t.body.setRotation({ x: 0, y: Math.sin(t.rest.rotationY / 2), z: 0, w: Math.cos(t.rest.rotationY / 2) }, false);
        t.body.setLinvel({ x: 0, y: 0, z: 0 }, false);
        t.body.setAngvel({ x: 0, y: 0, z: 0 }, false);
        t.body.sleep();
        t.idle = 0;
        if (mesh) mesh.userData.synced = false; // sleeping bricks are skipped, so redraw them all once
      }
    }
  });

  return (
    <>
      {loose.map((p, i) => (
        <RigidBody
          key={p.id}
          ref={(body) => {
            if (!body) return;
            tracked.current.push({ body, rest: p, idle: 0 });
            return () => {
              tracked.current = tracked.current.filter((t) => t.body !== body);
            };
          }}
          colliders={false}
          position={restCenter(p)}
          rotation={[0, p.rotationY, 0]}
          onContactForce={(payload) => onImpact(p.kind, payload)}
          linearDamping={0.1}
          angularDamping={0.3}
        >
          <Collider kind={p.kind} />
          <primitive object={visuals[i]} />
        </RigidBody>
      ))}
      {bricks.map((b, i) => (
        <RigidBody
          key={b.id}
          ref={(body) => {
            brickBodies.current[i] = body;
            if (!body) return;
            tracked.current.push({ body, rest: b, idle: 0 });
            return () => {
              brickBodies.current[i] = null;
              tracked.current = tracked.current.filter((t) => t.body !== body);
            };
          }}
          colliders={false}
          position={restCenter(b)}
          rotation={[0, b.rotationY, 0]}
          onContactForce={(payload) => onImpact('brick', payload)}
          linearDamping={0.1}
          angularDamping={0.3}
        >
          <Collider kind="brick" />
        </RigidBody>
      ))}
      <instancedMesh ref={brickInstances} args={[brickMesh.geometry, brickMesh.material, bricks.length]} castShadow receiveShadow frustumCulled={false} />
    </>
  );
}
