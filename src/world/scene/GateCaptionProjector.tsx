import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GATE_FRAME, gatePoint, SECTION_GATES } from '../district/layout';
import { telemetry } from '../events';
import { CAPTION_RANGE, captionElement, useGateCaptions } from '../gateCaptions';

/** Picks the gate the car is nearest to and pins its caption card just under it. */
export function GateCaptionProjector() {
  const point = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    const [cx, , cz] = telemetry.position;
    let nearest: (typeof SECTION_GATES)[number] | null = null;
    let best = CAPTION_RANGE;
    for (const g of SECTION_GATES) {
      const d = Math.hypot(g.center[0] - cx, g.center[1] - cz);
      if (d < best) {
        best = d;
        nearest = g;
      }
    }
    const state = useGateCaptions.getState();
    state.setNearest(nearest?.section ?? null);
    if (!nearest) return;
    const element = captionElement.current;
    if (!element) return;
    // Under the middle of the gate's beam, a little toward the road side the camera sees.
    const [x, z] = gatePoint(nearest, 0, GATE_FRAME.screen.z + 1.2);
    point.set(x, GATE_FRAME.beamBottom - 0.8, z).project(camera);
    const hidden = point.z > 1 || Math.abs(point.x) > 1.1 || Math.abs(point.y) > 1.1;
    element.style.visibility = hidden ? 'hidden' : '';
    if (hidden) return;
    const px = ((point.x + 1) / 2) * size.width;
    const py = ((1 - point.y) / 2) * size.height;
    element.style.transform = `translate(-50%, 0) translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
  });
  return null;
}
