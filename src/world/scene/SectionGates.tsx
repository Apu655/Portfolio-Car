import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GATE_FRAME, SECTION_GATES, SECTION_LETTERS, SECTION_TITLES, zoneFor, type SectionGate } from '../district/layout';
import { dissolveTargets, makeDissolvable } from './dissolve';
import { HEADER_PX, paintHeader } from './signPaint';

/** One gate's lettered header sign (R3); the section's items stand along the road past it. */
function GateHeader({ gate }: { gate: SectionGate }) {
  const group = useRef<THREE.Group>(null);
  const accent = zoneFor(gate.section).accent;

  const materials = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = HEADER_PX.width;
    canvas.height = HEADER_PX.height;
    paintHeader(canvas.getContext('2d')!, SECTION_LETTERS[gate.section], SECTION_TITLES[gate.section], accent);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return {
      face: new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
      backing: new THREE.MeshStandardMaterial({ color: '#1b2233', roughness: 0.5 }),
    };
  }, [gate.section, accent]);

  // The header dissolves with its frame when they hide the car (R14).
  useEffect(() => {
    if (!group.current) return;
    const key = `gate-${gate.section}#header`;
    dissolveTargets.set(key, makeDissolvable(group.current, { cloneMaterials: false }));
    return () => {
      dissolveTargets.delete(key);
    };
  }, [gate.section]);

  const hd = GATE_FRAME.header;
  return (
    <group ref={group} position={[gate.center[0], 0, gate.center[1]]} rotation={[0, gate.rotationY, 0]}>
      <group position={[0, hd.centerY, hd.z]} rotation={[-hd.tilt, 0, 0]}>
        <mesh material={materials.face}>
          <planeGeometry args={[hd.width, hd.height]} />
        </mesh>
        <mesh position={[0, 0, -0.16]} material={materials.backing}>
          <boxGeometry args={[hd.width + 0.3, hd.height + 0.3, 0.28]} />
        </mesh>
      </group>
    </group>
  );
}

/** The five section gates' header signs; the frames themselves come from the kiosks model. */
export function SectionGates() {
  return (
    <>
      {SECTION_GATES.map((gate) => (
        <GateHeader key={gate.section} gate={gate} />
      ))}
    </>
  );
}
