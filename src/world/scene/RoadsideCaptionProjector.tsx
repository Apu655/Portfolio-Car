import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ROADSIDE_FRAME, roadsidePoint } from '../district/layout';
import { telemetry } from '../events';
import { ROADSIDE_BOARDS } from '../roadside';
import { captionElement, nearestBoard, shownBoard, useRoadsideCaption } from '../roadsideCaptions';

/**
 * Picks the board the car is nearest to and pins its caption card at the face's lower left corner, hanging toward
 * the road: the next boards along the road stand lower right on screen, so the card never covers them (KTD7).
 */
export function RoadsideCaptionProjector() {
  const point = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    const [cx, , cz] = telemetry.position;
    const state = useRoadsideCaption.getState();
    state.setNearest(nearestBoard(ROADSIDE_BOARDS, cx, cz));
    const key = shownBoard(useRoadsideCaption.getState());
    const element = captionElement.current;
    if (!key || !element) return;
    const board = ROADSIDE_BOARDS.find((b) => b.key === key)!;
    // The face's lower left corner; its bottom edge leans toward the camera.
    const { centerY, height, tilt, width } = ROADSIDE_FRAME;
    const [x, z] = roadsidePoint(board.position, -width / 2, (height / 2) * Math.sin(tilt));
    point.set(x, centerY - (height / 2) * Math.cos(tilt) - 0.3, z).project(camera);
    const hidden = point.z > 1 || Math.abs(point.x) > 1.1 || Math.abs(point.y) > 1.1;
    element.style.visibility = hidden ? 'hidden' : '';
    if (hidden) return;
    const px = ((point.x + 1) / 2) * size.width;
    const py = ((1 - point.y) / 2) * size.height;
    element.style.transform = `translate(-100%, 0) translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
  });
  return null;
}
