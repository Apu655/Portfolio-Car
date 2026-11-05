import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { usePortfolio } from '../../state/store';
import { carRefs } from '../carRef';
import { emit } from '../events';
import { player } from '../player';
import { companionPose, startCompanion, stepCompanion, type CompanionKind, type CompanionState } from './companionSteer';
import { MODEL_URLS, useModel } from './District';
import { toonify } from './toon';

const KINDS: CompanionKind[] = ['critter', 'cat'];
const PARKED = { position: [1e4, 1e4] as [number, number], velocity: [0, 0] as [number, number] };
/** Spark particles in flight at most, how long one lives (s), and the bursts (s after the reaction starts). */
const SPARKS = 48;
const SPARK_LIFE = 0.6;
const BURSTS = [0, 0.45, 0.9];
/** The companions are modeled small; this sets their size beside the character. */
const SCALE = 1.3;

interface Figure {
  root: THREE.Object3D;
  materials: THREE.Material[];
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  tail: THREE.Object3D;
  gadget: THREE.Object3D | null;
  gadgetRest: number;
}

function figureOf(scene: THREE.Object3D, kind: CompanionKind): Figure {
  const root = scene.getObjectByName(kind)!.clone();
  root.position.set(0, 0, 0);
  const materials = toonify(root, 0.012);
  const joint = (name: string) => root.getObjectByName(`${kind}_${name}`)!;
  const legs = kind === 'critter' ? 'foot' : 'leg';
  const gadget = root.getObjectByName('cat_gadget') ?? null;
  return {
    root,
    materials,
    legL: joint(`${legs}_l`),
    legR: joint(`${legs}_r`),
    armL: joint('arm_l'),
    armR: joint('arm_r'),
    tail: joint('tail'),
    gadget,
    gadgetRest: gadget?.position.y ?? 0,
  };
}

/** A soft round dot for the sparks. */
function dotTexture(): THREE.DataTexture {
  const size = 16;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - (size - 1) / 2, y - (size - 1) / 2) / (size / 2);
      const a = Math.max(0, 1 - d) ** 1.6;
      data.set([255, 255, 255, Math.round(a * 255)], (y * size + x) * 4);
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Fizz the critter and Cogs the cat (U4 of the walking character plan): they roam their home areas, get out of
 * the car's way, and react when the player comes near, Fizz with a burst of sparks and a crackle, Cogs with a wave
 * and a gadget popped out of its backpack. The sparks are additive and unlit, so they glow at night.
 */
export function Companions() {
  const critterModel = useModel(MODEL_URLS.critter);
  const catModel = useModel(MODEL_URLS.cat);
  const figures = useMemo(() => [figureOf(critterModel.scene, 'critter'), figureOf(catModel.scene, 'cat')], [critterModel, catModel]);
  const groups = useRef<Array<THREE.Group | null>>([]);
  const states = useRef<CompanionState[]>(KINDS.map((kind, i) => startCompanion(kind, 11 + i * 7)));
  const burstAt = useRef<number | null>(null);

  const sparks = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
    const material = new THREE.PointsMaterial({
      size: 0.45,
      map: dotTexture(),
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    return { points, velocity: new Float32Array(SPARKS * 3), age: new Float32Array(SPARKS).fill(SPARK_LIFE), next: 0 };
  }, []);

  useEffect(
    () => () => {
      figures.forEach((f) => f.materials.forEach((m) => m.dispose()));
      sparks.points.geometry.dispose();
      (sparks.points.material as THREE.PointsMaterial).map?.dispose();
      (sparks.points.material as THREE.Material).dispose();
    },
    [figures, sparks],
  );

  const burst = (at: THREE.Vector3, still: boolean) => {
    const position = sparks.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let k = 0; k < 16; k++) {
      const i = sparks.next;
      sparks.next = (sparks.next + 1) % SPARKS;
      const a = Math.random() * Math.PI * 2;
      const up = 0.3 + Math.random() * 0.9;
      const speed = still ? 0 : 1.8 + Math.random() * 2.2;
      // Reduced motion: the sparks hang in a ring around the critter and fade, instead of flying out.
      const ring = still ? 0.35 : 0;
      position.setXYZ(i, at.x + Math.cos(a) * ring, at.y + (still ? up * 0.3 : 0), at.z + Math.sin(a) * ring);
      sparks.velocity.set([Math.cos(a) * speed, up * speed, Math.sin(a) * speed], i * 3);
      sparks.age[i] = 0;
    }
  };

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const time = clock.elapsedTime;
    const still = usePortfolio.getState().reducedMotion;
    const car = carRefs.body;
    let carInput = PARKED;
    if (car) {
      const p = car.translation();
      const v = car.linvel();
      carInput = { position: [p.x, p.z], velocity: [v.x, v.z] };
    }
    const focus: [number, number] = [player.position[0], player.position[2]];

    states.current = states.current.map((state, i) => {
      const { state: next, reacted } = stepCompanion(state, { time, dt, car: carInput, player: focus });
      const group = groups.current[i];
      const figure = figures[i];
      const pose = companionPose(next, time, still);
      if (group) {
        group.position.set(next.position[0], next.height + pose.bob, next.position[1]);
        group.rotation.y = next.heading;
      }
      figure.legL.rotation.x = pose.legL;
      figure.legR.rotation.x = pose.legR;
      figure.armL.rotation.x = pose.armL;
      figure.armR.rotation.x = pose.armR;
      figure.tail.rotation.y = pose.tail;
      if (figure.gadget) figure.gadget.position.y = figure.gadgetRest + pose.gadget;
      if (reacted) {
        emit({ type: 'companion', kind: next.kind, position: [next.position[0], 0.5, next.position[1]] });
        if (next.kind === 'critter') burstAt.current = time;
      }
      return next;
    });

    // The critter's sparks: a few bursts over its reaction, flying out from its antennae and falling away.
    const critter = states.current[0];
    if (burstAt.current !== null) {
      const since = time - burstAt.current;
      const due = BURSTS.filter((b) => b <= since && b > since - dt);
      for (const _ of due) burst(new THREE.Vector3(critter.position[0], critter.height + 0.7 * SCALE, critter.position[1]), still);
      if (since > BURSTS[BURSTS.length - 1]) burstAt.current = null;
    }
    const position = sparks.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const color = sparks.points.geometry.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i < SPARKS; i++) {
      if (sparks.age[i] >= SPARK_LIFE) {
        color.setXYZ(i, 0, 0, 0);
        continue;
      }
      const age = (sparks.age[i] = Math.min(SPARK_LIFE, sparks.age[i] + dt));
      const life = 1 - age / SPARK_LIFE;
      const v = sparks.velocity;
      v[i * 3 + 1] -= 6 * dt;
      position.setXYZ(i, position.getX(i) + v[i * 3] * dt, position.getY(i) + v[i * 3 + 1] * dt, position.getZ(i) + v[i * 3 + 2] * dt);
      // White-hot, cooling to cyan, then gone.
      color.setXYZ(i, life * (0.6 + 0.4 * life), life, life);
    }
    position.needsUpdate = true;
    color.needsUpdate = true;
  });

  return (
    <>
      {figures.map((figure, i) => (
        <group
          key={KINDS[i]}
          ref={(g) => {
            groups.current[i] = g;
          }}
          position={[states.current[i].position[0], 0, states.current[i].position[1]]}
          scale={SCALE}
        >
          <primitive object={figure.root} />
        </group>
      ))}
      <primitive object={sparks.points} />
    </>
  );
}
