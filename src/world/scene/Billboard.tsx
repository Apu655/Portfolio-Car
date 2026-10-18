import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { usePortfolio } from '../../state/store';
import { BILLBOARD } from '../district/layout';
import { BillboardFlicker } from '../lighting/billboardFlicker';
import { billboardState, lightingState } from '../lighting/state';
import { MODEL_URLS, enableShadows, useModel } from './District';

const LETTERS = BILLBOARD.text.replace(/\s/g, '').length;
/** The sign counts as seen within this distance (m); the reveal's opening wide shot is farther. */
const SEEN_DISTANCE = 110;

/** The APU ISLAM bulb sign: letters strike on unevenly the first time it comes into view, then glow (brighter at night). */
export function Billboard() {
  const gltf = useModel(MODEL_URLS.billboard);
  const reducedMotion = usePortfolio((s) => s.reducedMotion);
  const flicker = useMemo(() => new BillboardFlicker(LETTERS, 11, reducedMotion), [reducedMotion]);
  const started = useRef<number | null>(null);
  const glow = useRef<THREE.PointLight>(null);
  const view = useMemo(() => ({ frustum: new THREE.Frustum(), matrix: new THREE.Matrix4(), sign: new THREE.Vector3(BILLBOARD.position[0], 7.5, BILLBOARD.position[2]) }), []);

  const letters = useMemo(() => {
    enableShadows(gltf.scene, true, true);
    return Array.from({ length: LETTERS }, (_, i) => {
      const letter = gltf.scene.getObjectByName(`letter_${i}`)!;
      let material: THREE.MeshStandardMaterial | null = null;
      letter.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        // One material per letter so each can flicker on its own.
        material ??= (mesh.material as THREE.MeshStandardMaterial).clone();
        mesh.material = material;
        mesh.castShadow = false;
      });
      return { material: material!, base: material!.color.clone() };
    });
  }, [gltf]);

  const front = useMemo(() => {
    const r = BILLBOARD.rotationY;
    return new THREE.Vector3(BILLBOARD.position[0] + Math.sin(r) * 3, 7.5, BILLBOARD.position[2] + Math.cos(r) * 3);
  }, []);

  useFrame(({ clock, camera }) => {
    // Start the warm-up the first time the sign is on screen and close enough to read (the opening reveal
    // reaches it a few seconds in), so visitors actually see the letters strike on. Until then it stays dark.
    if (started.current === null && camera.position.distanceTo(view.sign) < SEEN_DISTANCE) {
      view.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      if (view.frustum.setFromProjectionMatrix(view.matrix).containsPoint(view.sign)) started.current = clock.elapsedTime;
    }
    const t = started.current === null ? 0 : clock.elapsedTime - started.current;
    const brightness = flicker.brightness(t);
    const base = 1.4 + lightingState.night * 3.2;
    letters.forEach(({ material, base: color }, i) => {
      material.emissiveIntensity = base * brightness[i];
      material.color.copy(color).multiplyScalar(0.55 + 0.45 * brightness[i]);
    });
    billboardState.flickering = started.current !== null && flicker.flickering(t);
    if (glow.current) {
      const lit = brightness.reduce((a, b) => a + b, 0) / brightness.length;
      glow.current.intensity = lit * (40 + lightingState.night * 260);
    }
  });

  return (
    <>
      <primitive object={gltf.scene} />
      <pointLight ref={glow} position={front} color="#ffcf80" distance={34} decay={1.6} intensity={0} />
    </>
  );
}
