import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { player, usePlayer } from '../player';
import { blockingOccluders } from '../district/occluders';
import { dissolveTargets } from '../scene/dissolve';

/** About a quarter second to dissolve or restore, so passing behind a building never flickers. */
const FADE_RESPONSE = 12;
/** The car is checked at its middle and toward each end, so it never half-vanishes behind a corner; the walker is small. */
const CAR_REACH = 2;
const WALKER_REACH = 0.3;
const CAR_HEIGHT = 1;

/** Dissolves whatever stands between the camera and the player (car or walker), and restores it once clear (R3). */
export function OcclusionFade() {
  const camera = useThree((s) => s.camera);
  const scratch = useMemo(() => ({ car: new THREE.Vector3() }), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const visual = player.follow;
    if (!visual) return;
    visual.getWorldPosition(scratch.car);
    const reach = usePlayer.getState().mode === 'foot' ? WALKER_REACH : CAR_REACH;
    const fx = -Math.sin(player.heading) * reach;
    const fz = -Math.cos(player.heading) * reach;
    const eye: [number, number, number] = [camera.position.x, camera.position.y, camera.position.z];
    const { x, z } = scratch.car;
    const y = scratch.car.y + CAR_HEIGHT;
    const blocking = new Set([
      ...blockingOccluders(eye, [x, y, z]),
      ...blockingOccluders(eye, [x + fx, y, z + fz]),
      ...blockingOccluders(eye, [x - fx, y, z - fz]),
    ]);
    for (const [key, target] of dissolveTargets) {
      // Several parts can share one volume: "gate-research#header" follows "gate-research".
      const volume = key.split('#')[0];
      target.fade.value = THREE.MathUtils.damp(target.fade.value, blocking.has(volume) ? 1 : 0, FADE_RESPONSE, dt);
      if (target.fade.value < 0.002) target.fade.value = 0;
    }
  });

  return null;
}
