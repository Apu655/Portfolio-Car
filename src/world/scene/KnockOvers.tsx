import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { CylinderCollider, RigidBody, type IntersectionEnterPayload } from '@react-three/rapier';
import * as THREE from 'three';
import { usePortfolio } from '../../state/store';
import { carRefs } from '../carRef';
import { BREAKABLE_COLLIDERS } from '../district/colliders';
import { emit, telemetry } from '../events';
import { THROWN_GROUPS, WALKER_BLOCKER_GROUPS } from '../physics/groups';
import { carAfterKnock, copyFade, KNOCK, knockIntensity, throwOf, type KnockKind } from '../physics/knock';
import { cutObject, HIDEABLE, isKnocked, knock, lampId, treeId } from './breakables';
import { MODEL_URLS, useModel } from './District';

type Breakable = (typeof BREAKABLE_COLLIDERS)[number];

const idOf = (c: Breakable) => (c.object === 'lamp' ? lampId(c.index) : treeId(c.index));

/** A thrown copy's body: a slim pole for a lamp, a trunk wide enough to keep the canopy off the ground for a tree. */
const COPY_SHAPE: Record<KnockKind, { halfHeight: number; radius: number }> = {
  lamp: { halfHeight: 3.2, radius: 0.25 },
  tree: { halfHeight: 2.3, radius: 0.9 },
};

interface Copy {
  key: number;
  kind: KnockKind;
  scale: number;
  origin: [number, number, number];
  group: THREE.Group;
  linvel: [number, number, number];
  angvel: [number, number, number];
  still: boolean;
  age: number;
}

function dispose(copy: Copy) {
  copy.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });
}

/** One thrown lamp or tree: flies, lies a while, fades, then asks to be removed. */
function ThrownCopy({ copy, onDone }: { copy: Copy; onDone: (key: number) => void }) {
  useFrame((_, dt) => {
    copy.age += dt;
    const { opacity, done } = copyFade(copy.age);
    copy.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) (mesh.material as THREE.Material).opacity = opacity;
    });
    if (done) onDone(copy.key);
  });
  const { halfHeight, radius } = COPY_SHAPE[copy.kind];
  return (
    <RigidBody
      type={copy.still ? 'fixed' : 'dynamic'}
      colliders={false}
      position={copy.origin}
      linearVelocity={copy.linvel}
      angularVelocity={copy.angvel}
      collisionGroups={THROWN_GROUPS}
      linearDamping={0.2}
      angularDamping={0.4}
    >
      <CylinderCollider args={[halfHeight * copy.scale, radius * copy.scale]} position={[0, halfHeight * copy.scale, 0]} mass={copy.kind === 'lamp' ? 60 : 140} friction={0.8} />
      <primitive object={copy.group} />
    </RigidBody>
  );
}

/**
 * Lamp posts and trees the car knocks over (U2 of the knock-overs and boost plan). Each stands as a sensor the car
 * drives through: on contact it vanishes from the city (breakables.ts), the car loses a little speed, a copy cut
 * from the city model is thrown along the car's path with a clang or a crack, lies a few seconds, and fades.
 */
export function KnockOvers() {
  const district = useModel(MODEL_URLS.district);
  const [standing, setStanding] = useState(() => BREAKABLE_COLLIDERS.filter((c) => !isKnocked(idOf(c))));
  const [copies, setCopies] = useState<Copy[]>([]);
  const nextKey = useRef(0);
  const live = useRef<Copy[]>([]);
  live.current = copies;

  useEffect(() => () => live.current.forEach(dispose), []);

  const onEnter = (c: Breakable) => ({ other }: IntersectionEnterPayload) => {
    const car = carRefs.body;
    if (!car || other.rigidBody?.handle !== car.handle) return;
    const id = idOf(c);
    if (!knock(id)) return;
    const v = car.linvel();
    const velocity: [number, number, number] = [v.x, v.y, v.z];
    const [x, y, z] = carAfterKnock(velocity, c.object);
    car.setLinvel({ x, y, z }, true);
    const origin: [number, number, number] = [c.position[0], 0, c.position[2]];
    const still = usePortfolio.getState().reducedMotion;
    const { linvel, angvel } = throwOf(velocity, telemetry.heading, c.object, still);
    emit({ type: 'knock', kind: c.object, intensity: knockIntensity(Math.hypot(v.x, v.z)), position: [origin[0], 1.5, origin[2]] });
    const copy: Copy = {
      key: nextKey.current++,
      kind: c.object,
      scale: c.object === 'tree' ? c.radius / 0.28 : 1,
      origin,
      group: cutObject(district.scene, HIDEABLE, id, origin),
      linvel,
      angvel,
      still,
      age: 0,
    };
    setStanding((list) => list.filter((s) => s !== c));
    setCopies((list) => {
      const next = [...list, copy];
      // Too many in the air at once: the oldest goes early.
      next.splice(0, Math.max(0, next.length - KNOCK.maxCopies)).forEach(dispose);
      return next;
    });
  };

  const onDone = (key: number) =>
    setCopies((list) => {
      const done = list.find((c) => c.key === key);
      if (!done) return list;
      dispose(done);
      return list.filter((c) => c.key !== key);
    });

  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        {standing.map((c) => (
          <CylinderCollider key={c.name} sensor args={[c.halfHeight, c.radius]} position={c.position} onIntersectionEnter={onEnter(c)} />
        ))}
        {/* The same posts and trunks stop someone walking into them; only the car knocks them over. */}
        {standing.map((c) => (
          <CylinderCollider key={`${c.name}-walker`} args={[c.halfHeight, c.radius]} position={c.position} collisionGroups={WALKER_BLOCKER_GROUPS} />
        ))}
      </RigidBody>
      {copies.map((copy) => (
        <ThrownCopy key={copy.key} copy={copy} onDone={onDone} />
      ))}
    </>
  );
}
