import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { usePortfolio } from '../../state/store';
import { BILLBOARD } from '../district/layout';
import { BillboardFlicker } from '../lighting/billboardFlicker';
import { billboardState, lightingState } from '../lighting/state';
import { MODEL_URLS, enableShadows, useModel } from './District';

const LETTERS = BILLBOARD.text.replace(/\s/g, '').length;


/** The APU ISLAM bulb sign: letters strike on unevenly when the city appears, then glow (brighter at night). */
export function Billboard() {
  const gltf = useModel(MODEL_URLS.billboard);
  const reducedMotion = usePortfolio((s) => s.reducedMotion);
  const flicker = useMemo(() => new BillboardFlicker(LETTERS, 11, reducedMotion), [reducedMotion]);
  const started = useRef<number | null>(null);
  const glow = useRef<THREE.PointLight>(null);

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
      return material!;
    });
  }, [gltf]);

  const front = useMemo(() => {
    const r = BILLBOARD.rotationY;
    return new THREE.Vector3(BILLBOARD.position[0] + Math.sin(r) * 3, 7.5, BILLBOARD.position[2] + Math.cos(r) * 3);
  }, []);

  useFrame(({ clock }) => {
    started.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - started.current;
    const brightness = flicker.brightness(t);
    const base = 1.4 + lightingState.night * 3.2;
    letters.forEach((m, i) => {
      m.emissiveIntensity = base * brightness[i];
      m.color.setScalar(0.55 + 0.45 * brightness[i]);
    });
    billboardState.flickering = flicker.flickering(t);
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
