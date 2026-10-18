import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  CuboidCollider,
  CylinderCollider,
  RigidBody,
  useRapier,
  type ContactForcePayload,
  type RapierRigidBody,
} from '@react-three/rapier';
import * as THREE from 'three';
import { PROPS, type PropPlacement } from '../district/layout';
import { emit } from '../events';
import { impactIntensity, impactThreshold, MIN_IMPACT, PROP_SPECS, shouldReset } from '../physics/props';
import { MODEL_URLS, enableShadows, useModel } from './District';

/** Minimum seconds between impact sounds from the same object. */
const IMPACT_COOLDOWN = 0.15;

/** Tag stored on each prop's physics body, so bodies are always looked up live from the world. */
interface PropTag {
  prop: number;
  brick?: number;
}

/** The body's prop tag, or undefined for any other body (the car, footballs, the ground). */
const tagOf = (body: RapierRigidBody): PropTag | undefined => {
  const data = body.userData as Partial<PropTag> | undefined;
  return typeof data?.prop === 'number' ? (data as PropTag) : undefined;
};

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
  const rapier = useRapier();
  // Seconds each prop has been still, by index into PROPS.
  const idle = useMemo(() => new Float32Array(PROPS.length), []);
  const lastImpact = useRef(new Map<number, number>());
  const clock = useRef(0);
  const sinceReset = useRef(0);
  const scratch = useMemo(() => ({ frustum: new THREE.Frustum(), matrix: new THREE.Matrix4(), point: new THREE.Vector3() }), []);

  const loose = useMemo(() => PROPS.map((p, index) => ({ p, index })).filter(({ p }) => p.kind !== 'brick'), []);
  const bricks = useMemo(() => PROPS.map((p, index) => ({ p, index })).filter(({ p }) => p.kind === 'brick'), []);
  const visuals = useMemo(
    () => loose.map(({ p }) => enableShadows(gltf.scene.getObjectByName(`prop_${p.kind}`)!.clone(), true, true)),
    [gltf, loose],
  );
  const brickMesh = useMemo(() => {
    const source = gltf.scene.getObjectByName('prop_brick') as THREE.Mesh;
    source.updateMatrix();
    // The node's own transform carries the meshopt dequantization scale and offset, so keep it per instance.
    return { geometry: source.geometry, material: source.material as THREE.Material, local: source.matrix.clone() };
  }, [gltf]);
  // Bricks are plain bodies drawn through one instanced mesh, synced each frame while awake.
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

  // Start everything asleep so the stacks don't jitter before the car arrives, and let Rapier drop resting and
  // sliding contacts natively (below the impact threshold they would only be discarded in JavaScript).
  useEffect(() => {
    const timer = setTimeout(
      () =>
        rapier.world.forEachRigidBody((body) => {
          const tag = tagOf(body);
          if (!tag) return;
          const threshold = impactThreshold(PROP_SPECS[PROPS[tag.prop].kind].mass);
          for (let i = 0; i < body.numColliders(); i++) body.collider(i).setContactForceEventThreshold(threshold);
          body.sleep();
        }),
      300,
    );
    return () => clearTimeout(timer);
  }, [rapier]);

  useFrame((_, dt) => {
    clock.current += dt;
    const world = rapier.world;

    // Draw bricks where their bodies are: every brick once after (re)placement, then only the awake ones.
    const mesh = brickInstances.current;
    if (mesh) {
      let moved = false;
      const sync = (body: RapierRigidBody) => {
        const brick = tagOf(body)?.brick;
        if (brick === undefined) return;
        const t = body.translation();
        const r = body.rotation();
        brickMatrix.m.compose(brickMatrix.p.set(t.x, t.y, t.z), brickMatrix.q.set(r.x, r.y, r.z, r.w), brickMatrix.s);
        mesh.setMatrixAt(brick, brickMatrix.m.multiply(brickMesh.local));
        moved = true;
      };
      if (mesh.userData.synced) world.forEachActiveRigidBody(sync);
      else world.forEachRigidBody(sync);
      if (moved) mesh.instanceMatrix.needsUpdate = true;
      mesh.userData.synced = true;
    }

    // Once a second, put disturbed props back once they have been still for a while and the visitor isn't looking.
    sinceReset.current += dt;
    if (sinceReset.current < 1) return;
    const elapsed = sinceReset.current;
    sinceReset.current = 0;
    scratch.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    scratch.frustum.setFromProjectionMatrix(scratch.matrix);
    world.forEachRigidBody((body) => {
      const tag = tagOf(body);
      if (!tag) return;
      const rest = PROPS[tag.prop];
      const p = body.translation();
      const v = body.linvel();
      idle[tag.prop] = Math.hypot(v.x, v.y, v.z) > 0.05 ? 0 : idle[tag.prop] + elapsed;
      const home = restCenter(rest);
      const q = body.rotation();
      const tilt = 2 * (q.x * q.x + q.z * q.z); // 0 upright, 2 upside down
      const visible = scratch.frustum.containsPoint(scratch.point.set(p.x, p.y, p.z));
      if (!shouldReset({ displaced: Math.hypot(p.x - home[0], p.y - home[1], p.z - home[2]), tilt, idleSeconds: idle[tag.prop], visible })) return;
      body.setTranslation({ x: home[0], y: home[1], z: home[2] }, false);
      body.setRotation({ x: 0, y: Math.sin(rest.rotationY / 2), z: 0, w: Math.cos(rest.rotationY / 2) }, false);
      body.setLinvel({ x: 0, y: 0, z: 0 }, false);
      body.setAngvel({ x: 0, y: 0, z: 0 }, false);
      body.sleep();
      idle[tag.prop] = 0;
      if (mesh && tag.brick !== undefined) mesh.userData.synced = false; // sleeping bricks are skipped, so redraw them all once
    });
  });

  return (
    <>
      {loose.map(({ p, index }, i) => (
        <RigidBody
          key={p.id}
          userData={{ prop: index } satisfies PropTag}
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
      {bricks.map(({ p, index }, brick) => (
        <RigidBody
          key={p.id}
          userData={{ prop: index, brick } satisfies PropTag}
          colliders={false}
          position={restCenter(p)}
          rotation={[0, p.rotationY, 0]}
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
