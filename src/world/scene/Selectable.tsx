import { useEffect, useRef, type ReactNode } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { Selection } from '../../state/route';
import { usePortfolio } from '../../state/store';
import { isLabelActive, labelIdFor } from '../labels';

interface SelectableProps {
  selection: Selection;
  /** Highlight only for this exact selection, not for anything else in its section. */
  exact?: boolean;
  children: ReactNode;
}

/** Pixels the pointer may move between press and release and still count as a click (not a camera drag). */
const CLICK_TOLERANCE = 6;

const HOVER_BOOST = 0.9;
const ACTIVE_BOOST = 0.45;

function setHighlight(root: THREE.Object3D, boost: number): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      material.userData.baseEmissive ??= material.emissiveIntensity;
      material.emissiveIntensity = (material.userData.baseEmissive as number) + boost;
    }
  });
}

/** Wraps scene objects so they highlight on hover and open their portfolio entry on click or tap. */
export function Selectable({ selection, exact = false, children }: SelectableProps) {
  const group = useRef<THREE.Group>(null);
  const id = labelIdFor(selection);
  const navigate = usePortfolio((s) => s.navigate);
  const setHovered = usePortfolio((s) => s.setHovered);
  const hovered = usePortfolio((s) => s.hovered === id);
  const active = usePortfolio((s) => s.panelOpen && isLabelActive({ selection, exact }, s.selection));

  useEffect(() => {
    if (group.current) setHighlight(group.current, hovered ? HOVER_BOOST : active ? ACTIVE_BOOST : 0);
  }, [hovered, active]);

  useEffect(() => {
    if (!hovered) return;
    document.body.style.cursor = 'pointer';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hovered]);

  const onOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(id);
  };
  const onOut = () => {
    if (usePortfolio.getState().hovered === id) setHovered(null);
  };
  const onClick = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > CLICK_TOLERANCE) return;
    event.stopPropagation();
    navigate(selection);
  };

  return (
    <group ref={group} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
      {children}
    </group>
  );
}
