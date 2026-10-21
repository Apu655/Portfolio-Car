import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { usePortfolio } from '../../state/store';
import { telemetry } from '../events';

/** Exhaust tips in car-model space (assets/blender/models/car.py): four pipes under the ducktail. */
const EXHAUSTS: Array<[number, number, number]> = [-0.52, -0.38, 0.38, 0.52].map((x) => [x, 0.33, 2.29]);
/** Seconds for the flame to grow in or die away. */
const FADE = 0.15;

/**
 * The nitro flame (R14 of the knock-overs and boost plan): a hot core inside an orange plume from each exhaust
 * while the boost fires. Additive and unlit so the bloom picks it up at night; reduced motion holds it steady.
 * Mount it in car-model space, alongside the model.
 */
export function NitroFlame() {
  const group = useRef<THREE.Group>(null);
  const strength = useRef(0);
  const parts = useMemo(() => {
    // A cone pointing back along +Z with its base at the pipe.
    const geometry = new THREE.ConeGeometry(1, 1, 10, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
    const material = (color: string, opacity: number) =>
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    return { geometry, plume: material('#ff7a1f', 0.75), core: material('#b9e6ff', 0.95) };
  }, []);

  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    const target = telemetry.boosting ? 1 : 0;
    strength.current += Math.sign(target - strength.current) * Math.min(Math.abs(target - strength.current), dt / FADE);
    const s = strength.current;
    g.visible = s > 0.01;
    if (!g.visible) return;
    const steady = usePortfolio.getState().reducedMotion;
    const t = clock.elapsedTime;
    g.children.forEach((pipe, i) => {
      const flicker = steady ? 1 : 0.8 + 0.2 * Math.sin(t * 47 + i * 1.7) + 0.12 * Math.sin(t * 83 + i * 3.1);
      const [plume, core] = pipe.children;
      plume.scale.set(0.13 * s, 0.13 * s, 1.5 * s * flicker);
      core.scale.set(0.06 * s, 0.06 * s, 0.8 * s * flicker);
    });
  });

  return (
    <group ref={group} visible={false}>
      {EXHAUSTS.map((position, i) => (
        <group key={i} position={position}>
          <mesh geometry={parts.geometry} material={parts.plume} renderOrder={2} />
          <mesh geometry={parts.geometry} material={parts.core} renderOrder={3} />
        </group>
      ))}
    </group>
  );
}
