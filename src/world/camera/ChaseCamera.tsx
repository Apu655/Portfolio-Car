import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { usePortfolio } from '../../state/store';
import { carRefs } from '../carRef';
import { distanceToCollider, STATIC_COLLIDERS } from '../district/colliders';
import { zoneFor, type Zone } from '../district/layout';
import { telemetry } from '../events';
import { headingOf } from '../physics/vehicle';
import { revealPose, REVEAL_SECONDS } from './reveal';

/** Matches the CSS breakpoint where the info panel becomes a bottom sheet. */
const NARROW_WIDTH = 640;

const CAMERA = {
  distance: 8.5,
  minDistance: 5,
  maxDistance: 24,
  elevation: 0.24,
  yawResponse: 3,
  positionResponse: 6,
  lookResponse: 10,
} as const;

const { damp } = THREE.MathUtils;
const dampAngle = (current: number, target: number, lambda: number, dt: number) =>
  current + Math.atan2(Math.sin(target - current), Math.cos(target - current)) * (1 - Math.exp(-lambda * dt));

const BLOCKERS = STATIC_COLLIDERS.filter((c) => !c.name.startsWith('wall-') && (c.kind === 'box' ? c.half[1] * 2 > 3 : true));

/** Pull the camera in front of anything solid between it and the car. */
function unblock(from: THREE.Vector3, to: THREE.Vector3): void {
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    const z = from.z + (to.z - from.z) * t;
    const hit = BLOCKERS.some((c) => {
      const top = c.kind === 'box' ? c.position[1] + c.half[1] : c.position[1] + c.halfHeight;
      return y < top + 0.5 && distanceToCollider(c, x, z) < 0.6;
    });
    if (hit) {
      const back = Math.max(0, t - 1 / steps);
      to.set(from.x + (to.x - from.x) * back, from.y + (to.y - from.y) * back + 1.2, from.z + (to.z - from.z) * back);
      return;
    }
  }
}

/** Where the camera stands to frame a stop while its panel is open. */
export function panelShot(zone: Zone): { position: THREE.Vector3; target: THREE.Vector3 } {
  const [fx, fy, fz] = zone.focus;
  const [px, pz] = zone.parking.position;
  const dx = px - fx;
  const dz = pz - fz;
  const length = Math.hypot(dx, dz) || 1;
  const tall = fy > 20;
  const back = tall ? 30 : 8;
  const along: [number, number] = [-dz / length, dx / length];
  return {
    position: new THREE.Vector3(px + (dx / length) * back + along[0] * (tall ? 10 : 3), tall ? 14 : 4.2, pz + (dz / length) * back + along[1] * (tall ? 10 : 3)),
    target: new THREE.Vector3(fx, tall ? fy * 0.82 : fy, fz),
  };
}

/** How far (px) to slide the rendered frame so the subject stays clear of the open info panel. */
function panelOffset(width: number, height: number, panelOpen: boolean): [number, number] {
  if (!panelOpen) return [0, 0];
  if (width < NARROW_WIDTH) return [0, height * 0.27];
  return [Math.min(230, width * 0.22), 0];
}

/** Chase camera with mouse orbit, collision, the opening reveal, and panel framing. */
export function ChaseCamera({ revealing, onRevealDone }: { revealing: boolean; onRevealDone: () => void }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const canvas = useThree((s) => s.gl.domElement);
  const orbit = useRef({ yaw: 0, pitch: 0, distance: CAMERA.distance as number, dragging: false, lastX: 0, lastY: 0 });
  const yaw = useRef<number | null>(null);
  const shotBlend = useRef(0);
  const look = useRef(new THREE.Vector3());
  const offset = useRef<[number, number]>([0, 0]);
  const revealTime = useRef(0);
  const s = useMemo(() => ({ car: new THREE.Vector3(), chase: new THREE.Vector3(), target: new THREE.Vector3(), head: new THREE.Vector3() }), []);

  useEffect(() => {
    const o = orbit.current;
    const onDown = (e: PointerEvent) => {
      o.dragging = true;
      o.lastX = e.clientX;
      o.lastY = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (!o.dragging) return;
      o.yaw -= (e.clientX - o.lastX) * 0.006;
      o.pitch = THREE.MathUtils.clamp(o.pitch + (e.clientY - o.lastY) * 0.004, -0.15, 0.9);
      o.lastX = e.clientX;
      o.lastY = e.clientY;
    };
    const onUp = () => {
      o.dragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      o.distance = THREE.MathUtils.clamp(o.distance * (1 + e.deltaY * 0.001), CAMERA.minDistance, CAMERA.maxDistance);
    };
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [canvas]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const visual = carRefs.visual;
    const body = carRefs.body;
    if (!visual || !body) return;
    visual.getWorldPosition(s.car);
    const heading = headingOf(body);
    if (yaw.current === null) yaw.current = heading;
    const state = usePortfolio.getState();

    // --- Chase position behind the car ---
    const o = orbit.current;
    if (!o.dragging && Math.abs(telemetry.speed) > 2) {
      o.yaw = damp(o.yaw, 0, 1.5, dt);
      o.pitch = damp(o.pitch, 0, 1.5, dt);
    }
    yaw.current = dampAngle(yaw.current, heading, CAMERA.yawResponse, dt);
    const a = yaw.current + o.yaw;
    const elevation = Math.min(1.2, CAMERA.elevation + o.pitch);
    const distance = o.distance + Math.abs(telemetry.speed) * 0.07;
    s.chase.set(
      s.car.x + Math.sin(a) * Math.cos(elevation) * distance,
      s.car.y + 1.2 + Math.sin(elevation) * distance,
      s.car.z + Math.cos(a) * Math.cos(elevation) * distance,
    );
    s.head.set(s.car.x, s.car.y + 1.4, s.car.z);
    unblock(s.head, s.chase);
    s.target.set(s.car.x - Math.sin(heading) * 4, s.car.y + 1.1, s.car.z - Math.cos(heading) * 4);

    // --- Panel framing ---
    const section = state.panelOpen && state.selection && state.selection.section !== 'about' ? state.selection.section : null;
    shotBlend.current = damp(shotBlend.current, section ? 1 : 0, state.reducedMotion ? 30 : 2.2, dt);
    const t = THREE.MathUtils.smoothstep(shotBlend.current, 0, 1);
    if (section && t > 0.001) {
      const shot = panelShot(zoneFor(section));
      s.chase.lerp(shot.position, t);
      s.target.lerp(shot.target, t);
    }

    // --- Opening reveal (skippable) ---
    let response: number = state.reducedMotion ? 30 : CAMERA.positionResponse;
    if (revealing) {
      revealTime.current += dt;
      const pose = revealPose(revealTime.current, s.chase, s.target);
      s.chase.copy(pose.position);
      s.target.copy(pose.target);
      response = 1000;
      if (revealTime.current >= REVEAL_SECONDS) onRevealDone();
    }

    camera.position.lerp(s.chase, 1 - Math.exp(-response * dt));
    look.current.lerp(s.target, 1 - Math.exp(-(revealing ? 1000 : CAMERA.lookResponse) * dt));
    camera.lookAt(look.current);

    const fov = 55 + (Math.abs(telemetry.speed) / 26) * 9;
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov = damp(camera.fov, fov, 3, dt);
      camera.updateProjectionMatrix();
    }
    const [tx, ty] = panelOffset(size.width, size.height, state.panelOpen);
    const nx = damp(offset.current[0], tx, 5, dt);
    const ny = damp(offset.current[1], ty, 5, dt);
    if (Math.abs(nx - offset.current[0]) > 0.05 || Math.abs(ny - offset.current[1]) > 0.05 || camera.view?.fullWidth !== size.width || camera.view?.fullHeight !== size.height) {
      offset.current = [nx, ny];
      camera.setViewOffset(size.width, size.height, nx, ny, size.width, size.height);
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
