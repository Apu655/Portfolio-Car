import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LANDMARK_BUILDERS } from '../../models/landmarks';
import { radialTexture, verticalFadeTexture } from '../../models/textures';
import { usePortfolio } from '../../state/store';
import { ENTRANCE_RADIUS, TOWERS, type TowerSite } from '../city/cityLayout';
import { Selectable } from './Selectable';

function Landmark({ site }: { site: TowerSite }) {
  const landmark = useMemo(() => LANDMARK_BUILDERS[site.section](site), [site]);
  useFrame(({ clock }, dt) => landmark.animate?.(clock.elapsedTime, Math.min(dt, 0.1)));
  // Front (+Z in model space) faces the boulevard.
  const rotation = Math.atan2(-site.outward[0], -site.outward[1]);
  return (
    <group position={[site.center[0], 0.2, site.center[1]]} rotation-y={rotation}>
      <Selectable selection={{ section: site.section }}>
        <primitive object={landmark.group} />
      </Selectable>
    </group>
  );
}

/** Glowing ring, floor glow, and a soft light curtain marking where to stop and press E. */
function EntranceZone({ site }: { site: TowerSite }) {
  const parts = useMemo(() => {
    const ringMaterial = new THREE.MeshBasicMaterial({ color: site.accent, transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false });
    const floorMaterial = new THREE.MeshBasicMaterial({
      color: site.accent,
      map: radialTexture(),
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const curtainMaterial = new THREE.MeshBasicMaterial({
      color: site.accent,
      alphaMap: verticalFadeTexture(),
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return { ringMaterial, floorMaterial, curtainMaterial };
  }, [site]);
  const active = usePortfolio((s) => s.nearTower === site.section);

  useFrame(({ clock }) => {
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.6);
    parts.ringMaterial.opacity = active ? 1 : 0.55 + pulse * 0.35;
    parts.floorMaterial.opacity = active ? 0.55 : 0.18 + pulse * 0.12;
    parts.curtainMaterial.opacity = active ? 0.42 : 0.16 + pulse * 0.08;
  });

  return (
    <group position={[site.entrance[0], 0, site.entrance[1]]}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.07} material={parts.ringMaterial}>
        <ringGeometry args={[ENTRANCE_RADIUS - 0.6, ENTRANCE_RADIUS, 64]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.065} material={parts.floorMaterial}>
        <circleGeometry args={[ENTRANCE_RADIUS, 48]} />
      </mesh>
      <mesh position-y={2.5} material={parts.curtainMaterial}>
        <cylinderGeometry args={[ENTRANCE_RADIUS - 0.3, ENTRANCE_RADIUS - 0.3, 5, 48, 1, true]} />
      </mesh>
    </group>
  );
}

export function Landmarks() {
  return (
    <>
      {TOWERS.map((site) => (
        <group key={site.section}>
          <Landmark site={site} />
          <EntranceZone site={site} />
        </group>
      ))}
    </>
  );
}
