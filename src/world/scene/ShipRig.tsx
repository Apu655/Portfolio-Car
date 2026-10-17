import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createSpaceship, SHIP_FLAME } from '../../models/ship';
import { usePortfolio } from '../../state/store';
import {
  createShipState,
  damp,
  FLIGHT,
  forwardVector,
  isIdle,
  stepAutopilot,
  stepFlight,
  yawToward,
  type AutopilotGoal,
  type FlightEnvironment,
  type ShipState,
} from '../flight/flightModel';
import { readFlightInput, useFlightKeys } from '../flight/input';
import { floorAt, OBSTACLES, SHIP_START, targetFor } from '../layout';

const ENVIRONMENT: FlightEnvironment = { floorAt, obstacles: OBSTACLES };

/** Matches the CSS breakpoint where the info panel becomes a bottom sheet. */
const NARROW_WIDTH = 640;

const CAMERA = {
  distance: 18,
  minDistance: 9,
  maxDistance: 70,
  elevation: 0.28,
  positionResponse: 6,
  lookResponse: 10,
} as const;

interface OrbitState {
  yaw: number;
  pitch: number;
  distance: number;
  dragging: boolean;
  lastX: number;
  lastY: number;
}

/** How far (px) to slide the rendered frame so the target stays clear of the open info panel. */
function panelOffset(width: number, height: number, panelOpen: boolean): [number, number] {
  if (!panelOpen) return [0, 0];
  if (width < NARROW_WIDTH) return [0, height * 0.27]; // bottom sheet: move the scene up
  return [Math.min(230, width * 0.22), 0]; // side panel: move the scene left
}

/** Where the chase camera wants to be for a ship state and orbit offset. */
function chasePosition(ship: ShipState, orbit: OrbitState, pullBack: number, out: THREE.Vector3): THREE.Vector3 {
  const distance = orbit.distance * (1 + pullBack * 2.5);
  const elevation = Math.min(1.3, CAMERA.elevation + orbit.pitch + pullBack * 0.7);
  const yaw = ship.yaw + orbit.yaw;
  const [x, y, z] = ship.position;
  out.set(
    x + Math.sin(yaw) * Math.cos(elevation) * distance,
    y + 2 + Math.sin(elevation) * distance,
    z + Math.cos(yaw) * Math.cos(elevation) * distance,
  );
  out.y = Math.max(out.y, floorAt(out.x, out.z) + 1);
  return out;
}

/** The player's ship: keyboard flight, menu/click autopilot, and the chase camera with mouse orbit. */
export function ShipRig() {
  const ship = useMemo(createSpaceship, []);
  const flames = useMemo(() => {
    const found: THREE.Object3D[] = [];
    ship.traverse((o) => o.name === SHIP_FLAME && found.push(o));
    return found;
  }, [ship]);

  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const narrow = size.width < NARROW_WIDTH;
  const viewOffset = useRef<[number, number]>([0, 0]);
  const canvas = useThree((s) => s.gl.domElement);
  const keys = useFlightKeys();
  const state = useRef<ShipState>(createShipState(SHIP_START.position, SHIP_START.yaw));
  const autopilot = useRef<AutopilotGoal | null>(null);
  const orbit = useRef<OrbitState>({ yaw: 0, pitch: 0, distance: CAMERA.distance, dragging: false, lastX: 0, lastY: 0 });
  const pullBack = useRef(0);
  const lookTarget = useRef(new THREE.Vector3());
  const scratch = useMemo(() => new THREE.Vector3(), []);
  const placed = useRef(false);
  const navToken = usePortfolio((s) => s.navToken);

  // Each navigation request (menu, click, URL, view switch) sets an autopilot destination.
  useEffect(() => {
    const target = targetFor(usePortfolio.getState().selection, narrow ? 'narrow' : 'wide');
    if (!placed.current) {
      placed.current = true;
      if (target) {
        // Arriving in 3D at a specific place: start pulled back from it, then fly in.
        const { position, lookAt } = target.viewpoint;
        const yaw = yawToward(position, lookAt);
        const [fx, , fz] = forwardVector(yaw);
        state.current = createShipState([position[0] - fx * 70, position[1] + 25, position[2] - fz * 70], yaw);
      }
      camera.position.copy(chasePosition(state.current, orbit.current, 0, scratch));
      lookTarget.current.set(...state.current.position);
      camera.lookAt(lookTarget.current);
    }
    autopilot.current = target ? target.viewpoint : null;
    // Re-frame only on navigation; resizing mid-visit shouldn't move the ship.
  }, [navToken, camera, scratch]);

  // Mouse/touch drag orbits the camera around the ship; the wheel zooms.
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
      o.pitch = THREE.MathUtils.clamp(o.pitch + (e.clientY - o.lastY) * 0.004, -0.22, 0.95);
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
    const input = readFlightInput(keys.current);
    if (autopilot.current && !isIdle(input)) autopilot.current = null; // any key takes back control
    if (autopilot.current) {
      const step = stepAutopilot(state.current, autopilot.current, dt, ENVIRONMENT);
      state.current = step.state;
      if (step.arrived) autopilot.current = null;
    } else {
      state.current = stepFlight(state.current, input, dt, ENVIRONMENT);
    }

    const s = state.current;
    ship.position.set(...s.position);
    ship.rotation.set(s.pitch, s.yaw, s.bank, 'YXZ');
    const throttle = Math.min(1, Math.abs(s.speed) / FLIGHT.maxSpeed);
    const flicker = 0.92 + Math.random() * 0.16;
    for (const flame of flames) flame.scale.set(1, 1, (0.25 + throttle * 1.6) * flicker);

    const o = orbit.current;
    if (!o.dragging && Math.abs(s.speed) > 4) {
      o.yaw = damp(o.yaw, 0, 1.4, dt);
      o.pitch = damp(o.pitch, 0, 1.4, dt);
    }
    const { transition, panelOpen } = usePortfolio.getState();
    pullBack.current = damp(pullBack.current, transition === 'leaving' ? 1 : 0, 4, dt);

    const [targetX, targetY] = panelOffset(size.width, size.height, panelOpen);
    const offset = viewOffset.current;
    const nextX = damp(offset[0], targetX, 5, dt);
    const nextY = damp(offset[1], targetY, 5, dt);
    if (Math.abs(nextX - offset[0]) > 0.05 || Math.abs(nextY - offset[1]) > 0.05 || camera.view?.fullWidth !== size.width || camera.view?.fullHeight !== size.height) {
      offset[0] = nextX;
      offset[1] = nextY;
      camera.setViewOffset(size.width, size.height, nextX, nextY, size.width, size.height);
      camera.updateProjectionMatrix();
    }

    chasePosition(s, o, pullBack.current, scratch);
    camera.position.lerp(scratch, 1 - Math.exp(-CAMERA.positionResponse * dt));
    const [fx, , fz] = forwardVector(s.yaw);
    scratch.set(s.position[0] + fx * 4, s.position[1] + 1.5, s.position[2] + fz * 4);
    lookTarget.current.lerp(scratch, 1 - Math.exp(-CAMERA.lookResponse * dt));
    camera.lookAt(lookTarget.current);
  });

  return <primitive object={ship} />;
}
