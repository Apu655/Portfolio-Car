import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { usePortfolio } from '../../state/store';
import { telemetry } from '../events';
import { AudioEngine, type Listener } from './AudioEngine';

/**
 * Runs the soundscape inside the canvas. Sounds are heard from the car, panned left and right as the camera sees
 * them: the fixed camera hovers 26–110 m up, and hearing from there turned every splash and knock into a whisper.
 */
export function AudioDriver() {
  const camera = useThree((s) => s.camera);
  const engine = useMemo(() => new AudioEngine(), []);
  const listener = useMemo<Listener & { scratch: THREE.Vector3 }>(() => ({ position: [0, 0, 0], right: [1, 0, 0], scratch: new THREE.Vector3() }), []);

  useEffect(() => engine.attach(), [engine]);
  useEffect(
    () =>
      usePortfolio.subscribe((s, prev) => {
        if (s.panelOpen !== prev.panelOpen) engine.ui(s.panelOpen ? 'open' : 'close');
        else if (s.menuOpen !== prev.menuOpen) engine.ui('toggle');
      }),
    [engine],
  );

  useFrame(() => {
    listener.position[0] = telemetry.position[0];
    listener.position[1] = telemetry.position[1];
    listener.position[2] = telemetry.position[2];
    const right = listener.scratch.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    listener.right[0] = right.x;
    listener.right[1] = right.y;
    listener.right[2] = right.z;
    engine.update(listener);
  });
  return null;
}
