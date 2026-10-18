import { useEffect, type ReactNode } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { Selection } from '../../state/route';
import { usePortfolio } from '../../state/store';
import { labelIdFor } from '../labels';

/** Pixels the pointer may move between press and release and still count as a click (not a camera drag). */
export const CLICK_TOLERANCE = 6;

/** Wraps a landmark so hovering highlights its label and clicking or tapping fast-travels there. */
export function Selectable({ selection, children }: { selection: Selection; children: ReactNode }) {
  const id = labelIdFor(selection);
  const navigate = usePortfolio((s) => s.navigate);
  const setHovered = usePortfolio((s) => s.setHovered);
  const hovered = usePortfolio((s) => s.hovered === id);

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
    <group onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
      {children}
    </group>
  );
}
