import { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { footprintMask, landmarkFootprints, MASK, type Footprint } from '../lighting/groundMask';
import { lightingState } from '../lighting/state';
import { installLamps, patchSurface, surfaceUniforms } from '../lighting/surfaceShaders';

/**
 * Give the district's ground its surface detail (U3 of the golden-hour city plan): patch every named ground
 * material under `root`, draw the contact-shading mask from the buildings and landmarks, load the streetlights,
 * and keep the night level current.
 */
export function useSurfaceDetail(root: THREE.Object3D, buildings: readonly Footprint[]): void {
  useEffect(() => {
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(patchSurface);
    });
    installLamps();
    const mask = footprintMask([...landmarkFootprints(), ...buildings]);
    const bytes = new Uint8Array(mask.length);
    mask.forEach((v, i) => (bytes[i] = Math.round(Math.min(1, v) * 255)));
    const texture = new THREE.DataTexture(bytes, MASK.size, MASK.size, THREE.RedFormat, THREE.UnsignedByteType);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    surfaceUniforms.uGroundMask.value = texture;
    return () => {
      texture.dispose();
      if (surfaceUniforms.uGroundMask.value === texture) surfaceUniforms.uGroundMask.value = null;
    };
  }, [root, buildings]);

  useFrame(() => {
    surfaceUniforms.uNight.value = lightingState.night;
  });
}
