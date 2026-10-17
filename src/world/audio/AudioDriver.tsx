import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { usePortfolio } from '../../state/store';
import { AudioEngine, type Listener } from './AudioEngine';

/** Runs the soundscape inside the canvas: the camera is the listener, and panel and menu changes click softly. */
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
    listener.position[0] = camera.position.x;
    listener.position[1] = camera.position.y;
    listener.position[2] = camera.position.z;
    const right = listener.scratch.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    listener.right[0] = right.x;
    listener.right[1] = right.y;
    listener.right[2] = right.z;
    engine.update(listener);
  });
  return null;
}
