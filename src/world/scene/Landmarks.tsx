import { useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { projects } from '../../content/portfolio';
import { usePortfolio } from '../../state/store';
import { CAMPUS, PROJECTS_HALL, ROBOT, SECTION_LETTERS, zoneFor } from '../district/layout';
import { telemetry } from '../events';
import { bubbleElement, useRoadsideCaption } from '../roadsideCaptions';
import { dissolveTargets, makeDissolvable } from './dissolve';
import { enableShadows, MODEL_URLS, useModel } from './District';
import { robotPose } from './robotMotion';
import { Selectable } from './Selectable';
import { loadImage, paintHallSign, paintHeader } from './signPaint';

const ROBOT_ZONE = zoneFor('research');
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
  useFrame(({ clock, camera, size }) => {
    const state = usePortfolio.getState();
    const captions = useRoadsideCaption.getState();
    const [cx, , cz] = telemetry.position;
    const pose = robotPose({
      toCar: [cx - ROBOT.position[0], cz - ROBOT.position[1]],
      facing: ROBOT.facing,
      time: clock.elapsedTime,
      inZone: state.nearStop?.name === ROBOT_ZONE.name,
      reducedMotion: state.reducedMotion,
      greeting: captions.bubble,
    });
    robotGroup.position.y = pose.bob;
    if (parts.head) parts.head.rotation.y = pose.headYaw;
    if (parts.armRight) parts.armRight.rotation.z = pose.armAngle;
    captions.setBubble(pose.greeting);

    // Pin the greeting bubble just above the robot's head, or beside it (left, away from the oncoming car) when the
    // top bar leaves no room above.
    const element = bubbleElement.current;
    if (!pose.greeting || !element) return;
    point.set(ROBOT.position[0], ROBOT.height + 0.9 + pose.bob, ROBOT.position[1]).project(camera);
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
        <group position={[ROBOT.position[0], 0, ROBOT.position[1]]} rotation={[0, ROBOT.facing, 0]}>
          <primitive object={robotGroup}>
            <primitive object={parts.robot} />
          </primitive>
        </group>
      </Selectable>
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
