import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { usePortfolio } from '../../state/store';
import { carRefs } from '../carRef';
import { ROADSIDE_FRAME, zoneFor } from '../district/layout';
import { boardFor } from '../roadside';
import { telemetry } from '../events';
import { clampZoom, framing, shouldSnap, ZOOM } from './framing';
import { arrivalBlend, REVEAL_SECONDS } from './reveal';

/** Matches the CSS breakpoint where the info panel becomes a bottom sheet. */
const NARROW_WIDTH = 640;
/** How quickly the camera catches up with the car, and with zoom changes. */
const FOLLOW_RESPONSE = 6;
const ZOOM_RESPONSE = 10;

const { damp } = THREE.MathUtils;

/** How far (px) to slide the rendered frame so the subject stays clear of the open info panel. */
function panelOffset(width: number, height: number, panelOpen: boolean): [number, number] {
  if (!panelOpen) return [0, 0];
  if (width < NARROW_WIDTH) return [0, height * 0.27];
  return [Math.min(230, width * 0.22), 0];
}

/**
 * The fixed-view follow camera: it looks at the car from the south-west at a fixed angle and never rotates (R1).
 * Scroll and pinch zoom (R4); dragging does nothing (R5). The opening and panel framing stay in the same view.
 */
export function FollowCamera({ revealing, onRevealDone }: { revealing: boolean; onRevealDone: () => void }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const canvas = useThree((s) => s.gl.domElement);
  const zoom = useRef<number>(ZOOM.default);
  const shownZoom = useRef<number>(ZOOM.default);
  const follow = useRef<THREE.Vector3 | null>(null);
  const speed = useRef(0);
  const panelBlend = useRef(0);
  const revealTime = useRef(0);
  const offset = useRef<[number, number]>([0, 0]);
  const scratch = useMemo(() => ({ car: new THREE.Vector3(), position: new THREE.Vector3(), target: new THREE.Vector3() }), []);

  // Zoom: scroll wheel and trackpad pinch (wheel events), and two-finger pinch on touch screens.
  useEffect(() => {
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStart = 0;
    let zoomAtPinch: number = zoom.current;
    const spread = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom.current = clampZoom(zoom.current * (1 + e.deltaY * 0.0015));
    };
    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        pinchStart = spread();
        zoomAtPinch = zoom.current;
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinchStart > 0) zoom.current = clampZoom(zoomAtPinch * (pinchStart / Math.max(1, spread())));
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStart = 0;
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [canvas]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const visual = carRefs.visual;
    if (!visual) return;
    const state = usePortfolio.getState();
    visual.getWorldPosition(scratch.car);

    // Follow the car, but cut on a teleport (fast travel, deep links, recovery) instead of gliding across the city.
    if (!follow.current || shouldSnap(follow.current.toArray() as [number, number, number], scratch.car.toArray() as [number, number, number])) {
      follow.current = scratch.car.clone();
    } else {
      follow.current.set(
        damp(follow.current.x, scratch.car.x, FOLLOW_RESPONSE, dt),
        damp(follow.current.y, scratch.car.y, FOLLOW_RESPONSE, dt),
        damp(follow.current.z, scratch.car.z, FOLLOW_RESPONSE, dt),
      );
    }
    speed.current = damp(speed.current, Math.abs(telemetry.speed), 2, dt);
    shownZoom.current = damp(shownZoom.current, zoom.current, ZOOM_RESPONSE, dt);

    // Opening: runs while revealing. The camera sits exactly on the framing every frame, so a skip (or reduced
    // motion) lands straight on the driving view.
    let arrival: number | undefined;
    if (revealing) {
      revealTime.current += dt;
      arrival = arrivalBlend(revealTime.current, state.reducedMotion);
      if (revealTime.current >= REVEAL_SECONDS || arrival >= 1) onRevealDone();
    }

    // An open panel eases the camera toward its stop and in a little (R8); reduced motion moves at once (R15).
    const section = state.panelOpen && state.selection && state.selection.section !== 'about' ? state.selection.section : null;
    panelBlend.current = state.reducedMotion ? (section ? 1 : 0) : damp(panelBlend.current, section ? 1 : 0, 2.2, dt);
    // An item opened in place from its roadside billboard frames that board rather than the section's stop (KTD5).
    const board = section && !state.travel ? boardFor(state.selection) : undefined;
    const zone = section ? zoneFor(section) : null;
    const focus = board ? { at: board.position, height: ROADSIDE_FRAME.centerY } : zone ? { at: [zone.focus[0], zone.focus[2]] as [number, number], height: zone.focus[1] } : null;
    const panel = focus ? { focus: focus.at, height: focus.height, blend: THREE.MathUtils.smoothstep(panelBlend.current, 0, 1) } : undefined;

    const shot = framing({
      follow: follow.current.toArray() as [number, number, number],
      zoom: shownZoom.current,
      speed: speed.current,
      aspect: size.width / Math.max(1, size.height),
      arrival,
      panel,
    });
    scratch.position.set(...shot.position);
    scratch.target.set(...shot.target);
    camera.position.copy(scratch.position);
    camera.lookAt(scratch.target);

    const [tx, ty] = panelOffset(size.width, size.height, state.panelOpen);
    const nx = state.reducedMotion ? tx : damp(offset.current[0], tx, 5, dt);
    const ny = state.reducedMotion ? ty : damp(offset.current[1], ty, 5, dt);
    if (Math.abs(nx - offset.current[0]) > 0.05 || Math.abs(ny - offset.current[1]) > 0.05 || camera.view?.fullWidth !== size.width || camera.view?.fullHeight !== size.height) {
      offset.current = [nx, ny];
      camera.setViewOffset(size.width, size.height, nx, ny, size.width, size.height);
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
