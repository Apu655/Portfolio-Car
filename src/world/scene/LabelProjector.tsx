import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { labelElements, WORLD_LABELS } from '../labels';

/** Moves the DOM labels to their objects' screen positions every frame (no React re-render involved). */
export function LabelProjector() {
  const point = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const label of WORLD_LABELS) {
      const element = labelElements.get(label.id);
      if (!element) continue;
      point.set(...label.position).project(camera);
      const behindCamera = point.z > 1;
      element.style.visibility = behindCamera ? 'hidden' : '';
      if (behindCamera) continue;
      const x = ((point.x + 1) / 2) * size.width;
      const y = ((1 - point.y) / 2) * size.height;
      element.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  });
  return null;
}
