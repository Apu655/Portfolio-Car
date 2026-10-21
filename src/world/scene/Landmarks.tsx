import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { CylinderCollider, RigidBody, type IntersectionEnterPayload, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { projects } from '../../content/portfolio';
import { ROBOT_LINES } from '../../content/robotLines';
import { usePortfolio } from '../../state/store';
import { carRefs } from '../carRef';
import { distanceToCollider, STATIC_COLLIDERS } from '../district/colliders';
import { CAMPUS, PROJECTS_HALL, ROBOT, SECTION_LETTERS, zoneFor } from '../district/layout';
import { emit, telemetry } from '../events';
import { bubbleElement, useRoadsideCaption } from '../roadsideCaptions';
import { dissolveTargets, makeDissolvable } from './dissolve';
import { enableShadows, MODEL_URLS, useModel } from './District';
import { robotPose } from './robotMotion';
import { AT_HOME, hitRobot, REACTION, stepReaction } from './robotReaction';
import { Selectable } from './Selectable';
import { loadImage, paintHallSign, paintHeader } from './signPaint';

const ROBOT_ZONE = zoneFor('research');
/** Share of its speed the car keeps after bumping the robot: a jolt, not a stop. */
const BUMP_KEEP = 0.85;
/** How close (m) the car may be to the robot's way home before it waits for the car to move. */
const BLOCK_RANGE = ROBOT.radius + 2;

/** Whether the robot can stand at this offset from home: clear of every wall, post, and building. */
const clearAt = (x: number, z: number) =>
  STATIC_COLLIDERS.every((c) => distanceToCollider(c, ROBOT.position[0] + x, ROBOT.position[1] + z) > ROBOT.radius * 0.8);

/** Distance from point p to the segment a–b (x, z). */
function toSegment(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length2 = dx * dx + dz * dz;
  const t = length2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / length2)) : 0;
  return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dz * t));
}
/** Pixels at the top of the screen the HUD's top bar covers. */
const BUBBLE_TOP_ROOM = 90;

/** A model node, cloned so the source stays findable (StrictMode builds twice), and moved to the origin. */
function cloneAtOrigin(scene: THREE.Object3D, name: string): THREE.Object3D {
  const clone = enableShadows(scene.getObjectByName(name)!.clone(), true, true);
  clone.position.set(0, 0, 0);
  clone.rotation.set(0, 0, 0);
  return clone;
}

/** A painted sign plane on a building's front (local -Z face at `front`), drawn once. */
function useSign(width: number, height: number, paint: (ctx: CanvasRenderingContext2D, size: { width: number; height: number }) => void, deps: unknown[]) {
  const sign = useMemo(() => {
    const size = { width: 1024, height: Math.round((1024 * height) / width) };
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return { ctx: canvas.getContext('2d')!, size, texture, material: new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }) };
  }, [width, height]);
  useEffect(() => {
    paint(sign.ctx, sign.size);
    sign.texture.needsUpdate = true;
    // `paint` is rebuilt every render; `deps` says when its output changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sign, ...deps]);
  return sign.material;
}

/** The SeCAREly robot in the east road, the Projects Hall, and the campus (R7–R11). */
export function Landmarks() {
  const landmarks = useModel(MODEL_URLS.landmarks);
  const [shots, setShots] = useState<Array<HTMLImageElement | null>>(() => projects.map(() => null));

  const parts = useMemo(() => {
    const robot = cloneAtOrigin(landmarks.scene, 'robot');
    return {
      robot,
      head: robot.getObjectByName('robot_head'),
      armRight: robot.getObjectByName('robot_arm_r'),
      hall: cloneAtOrigin(landmarks.scene, 'projects_hall'),
      campus: cloneAtOrigin(landmarks.scene, 'campus'),
    };
  }, [landmarks]);

  useEffect(() => {
    const entries: Array<[string, THREE.Object3D]> = [
      ['robot', parts.robot],
      ['projects-hall', parts.hall],
      ['campus', parts.campus],
    ];
    for (const [key, root] of entries) dissolveTargets.set(key, makeDissolvable(root, { cloneMaterials: true }));
    return () => entries.forEach(([key]) => dissolveTargets.delete(key));
  }, [parts]);

  useEffect(() => {
    let live = true;
    projects.forEach((p, i) => {
      if (!p.image) return;
      loadImage(p.image)
        .then((img) => live && setShots((prev) => prev.map((s, j) => (j === i ? img : s))))
        .catch(() => undefined);
    });
    return () => {
      live = false;
    };
  }, []);

  const hallSign = useSign(PROJECTS_HALL.sign.width, PROJECTS_HALL.sign.height, (ctx, size) => paintHallSign(ctx, shots, zoneFor('projects').accent, size), [shots]);
  const campusSign = useSign(CAMPUS.sign.width, CAMPUS.sign.height, (ctx, size) => paintHeader(ctx, SECTION_LETTERS.education, 'Campus', zoneFor('education').accent, size), []);

  const point = useMemo(() => new THREE.Vector3(), []);
  const robotGroup = useMemo(() => new THREE.Group(), []);
  const turn = useMemo(() => ({ yaw: ROBOT.facing, lean: new THREE.Quaternion(), spin: new THREE.Quaternion(), axis: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }), []);
  const robotBody = useRef<RapierRigidBody>(null);
  const reaction = useRef(AT_HOME);
  const quipUntil = useRef(0);
  const now = useRef(0);

  // The car ran into the robot (KTD4 of the knock-overs and boost plan): shove it, jolt the car, and maybe quip.
  const onBump = ({ other }: IntersectionEnterPayload) => {
    const car = carRefs.body;
    if (!car || other.rigidBody?.handle !== car.handle) return;
    const p = car.translation();
    const v = car.linvel();
    const [ox, oz] = reaction.current.offset;
    const result = hitRobot(reaction.current, {
      time: now.current,
      toCar: [p.x - (ROBOT.position[0] + ox), p.z - (ROBOT.position[1] + oz)],
      carVelocity: [v.x, v.z],
      lines: ROBOT_LINES.length,
      clear: clearAt,
    });
    if (!result.hit) return;
    reaction.current = result.state;
    car.setLinvel({ x: v.x * BUMP_KEEP, y: v.y, z: v.z * BUMP_KEEP }, true);
    emit({ type: 'robotHit', position: [ROBOT.position[0] + ox, 1.5, ROBOT.position[1] + oz] });
    if (result.line !== null) {
      useRoadsideCaption.getState().setQuip(ROBOT_LINES[result.line]);
      quipUntil.current = now.current + REACTION.quipSeconds;
    }
  };

  useFrame(({ clock, camera, size }, dt) => {
    now.current = clock.elapsedTime;
    const state = usePortfolio.getState();
    const captions = useRoadsideCaption.getState();
    const [cx, , cz] = telemetry.position;

    // Where the bump has left the robot, waiting on its way home while the car sits in the way.
    const [ox, oz] = reaction.current.offset;
    const carBlocks = toSegment([cx - ROBOT.position[0], cz - ROBOT.position[1]], [ox, oz], [0, 0]) < BLOCK_RANGE;
    const step = stepReaction(reaction.current, { time: clock.elapsedTime, carBlocks, reducedMotion: state.reducedMotion });
    reaction.current = step.state;
    const { offset, tilt, lean, walkHeading } = step.pose;
    const x = ROBOT.position[0] + offset[0];
    const z = ROBOT.position[1] + offset[1];
    robotBody.current?.setNextKinematicTranslation({ x, y: 0, z });
    if (quipUntil.current && clock.elapsedTime > quipUntil.current) {
      quipUntil.current = 0;
      captions.setQuip(null);
    }
    const quipping = captions.quip !== null;

    // Turn to walk home, then back to face the road; lean away from the car while stumbling.
    const targetYaw = walkHeading ?? ROBOT.facing;
    const delta = Math.atan2(Math.sin(targetYaw - turn.yaw), Math.cos(targetYaw - turn.yaw));
    turn.yaw += delta * Math.min(1, dt * 8);
    turn.spin.setFromAxisAngle(turn.up, turn.yaw);
    const leaning = tilt !== 0 && (lean[0] !== 0 || lean[1] !== 0);
    if (leaning) turn.lean.setFromAxisAngle(turn.axis.set(lean[1], 0, -lean[0]), tilt);
    robotGroup.quaternion.copy(leaning ? turn.lean.multiply(turn.spin) : turn.spin);

    const pose = robotPose({
      toCar: [cx - x, cz - z],
      facing: turn.yaw,
      time: clock.elapsedTime,
      inZone: state.nearStop?.name === ROBOT_ZONE.name,
      reducedMotion: state.reducedMotion,
      greeting: captions.bubble,
    });
    robotGroup.position.set(offset[0], pose.bob, offset[1]);
    if (parts.head) parts.head.rotation.y = pose.headYaw;
    if (parts.armRight) parts.armRight.rotation.z = pose.armAngle;
    const showing = pose.greeting || quipping;
    captions.setBubble(showing);

    // Pin the bubble just above the robot's head, or beside it (left, away from the oncoming car) when the top
    // bar leaves no room above.
    const element = bubbleElement.current;
    if (!showing || !element) return;
    point.set(x, ROBOT.height + 0.9 + pose.bob, z).project(camera);
    const hidden = point.z > 1 || Math.abs(point.x) > 1.1 || Math.abs(point.y) > 1.1;
    element.style.visibility = hidden ? 'hidden' : '';
    if (hidden) return;
    const px = ((point.x + 1) / 2) * size.width;
    const py = ((1 - point.y) / 2) * size.height;
    const beside = py - element.offsetHeight < BUBBLE_TOP_ROOM;
    element.classList.toggle('is-beside', beside);
    element.style.transform = beside
      ? `translate(calc(-100% - 28px), -30%) translate(${px.toFixed(1)}px, ${(py + element.offsetHeight * 0.3).toFixed(1)}px)`
      : `translate(-50%, -100%) translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
  });

  const front = (depth: number) => -depth / 2 - 0.04;
  return (
    <>
      <Selectable selection={{ section: 'research', itemId: ROBOT_ZONE.itemId }}>
        <group position={[ROBOT.position[0], 0, ROBOT.position[1]]}>
          <primitive object={robotGroup}>
            <primitive object={parts.robot} />
          </primitive>
        </group>
      </Selectable>
      {/* A sensor that follows the robot: the car passes through and bumps it instead of stopping against it. */}
      <RigidBody ref={robotBody} type="kinematicPosition" colliders={false} position={[ROBOT.position[0], 0, ROBOT.position[1]]}>
        <CylinderCollider sensor args={[ROBOT.height / 2, ROBOT.radius]} position={[0, ROBOT.height / 2, 0]} onIntersectionEnter={onBump} />
      </RigidBody>
      <Selectable selection={{ section: 'projects' }}>
        <group position={[PROJECTS_HALL.center[0], 0, PROJECTS_HALL.center[1]]} rotation={[0, PROJECTS_HALL.facing, 0]}>
          <primitive object={parts.hall} />
          {/* The hall is built facing north, so its world depth (z) is its local depth. */}
          <mesh position={[0, PROJECTS_HALL.sign.centerY, front(PROJECTS_HALL.size[1])]} rotation={[0, Math.PI, 0]} material={hallSign}>
            <planeGeometry args={[PROJECTS_HALL.sign.width, PROJECTS_HALL.sign.height]} />
          </mesh>
        </group>
      </Selectable>
      <Selectable selection={{ section: 'education' }}>
        <group position={[CAMPUS.center[0], 0, CAMPUS.center[1]]} rotation={[0, CAMPUS.facing, 0]}>
          <primitive object={parts.campus} />
          {/* The campus turns to face west, so its world width (x) is its local depth. */}
          <mesh position={[0, CAMPUS.sign.centerY, front(CAMPUS.size[0])]} rotation={[0, Math.PI, 0]} material={campusSign}>
            <planeGeometry args={[CAMPUS.sign.width, CAMPUS.sign.height]} />
          </mesh>
        </group>
      </Selectable>
    </>
  );
}
