import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createRetroCoupe } from '../../models/car';
import { radialTexture } from '../../models/textures';
import { usePortfolio } from '../../state/store';
import { CAMERA_BLOCKERS, OBSTACLES, SPAWN, towerAtZone, towerFor, WORLD_HALF, type TowerSite } from '../city/cityLayout';
import {
  CAR,
  createCarState,
  damp,
  dampAngle,
  parkCar,
  stepCar,
  type CarState,
  type DriveEnvironment,
} from '../drive/carModel';
import { combineInputs, readKeyboardInput, touchInput, useDriveKeys } from '../drive/input';

const ENVIRONMENT: DriveEnvironment = { obstacles: OBSTACLES, bound: WORLD_HALF };

/** Matches the CSS breakpoint where the info panel becomes a bottom sheet. */
const NARROW_WIDTH = 640;

const CAMERA = {
  distance: 9.5,
  minDistance: 6,
  maxDistance: 26,
  height: 3.3,
  /** How quickly the camera swings round behind the car (lower = lazier, wider on sharp turns). */
  yawResponse: 3.2,
  positionResponse: 7,
  lookResponse: 12,
} as const;

interface Orbit {
  yaw: number;
  pitch: number;
  distance: number;
  dragging: boolean;
  lastX: number;
  lastY: number;
}

/** How far (px) to slide the rendered frame so the subject stays clear of the open info panel. */
function panelOffset(width: number, height: number, panelOpen: boolean): [number, number] {
  if (!panelOpen) return [0, 0];
  if (width < NARROW_WIDTH) return [0, height * 0.27];
  return [Math.min(230, width * 0.22), 0];
}

/** Cinematic shot of a landmark from across the boulevard, used while its panel is open. */
function towerShot(site: TowerSite): { position: THREE.Vector3; target: THREE.Vector3 } {
  const [ox, oz] = site.outward;
  // Slightly off-axis (along the road) so the tower reads in three quarters.
  const along: [number, number] = [-oz, ox];
  // Raised and aimed high enough to keep each tower's signature top (clock, crown, spire, beacon) in frame.
  return {
    position: new THREE.Vector3(site.roadPoint[0] - ox * 26 + along[0] * 20, 18 + site.height * 0.08, site.roadPoint[1] - oz * 26 + along[1] * 20),
    target: new THREE.Vector3(site.center[0], site.height * 0.6, site.center[1]),
  };
}

/** Pull the camera in front of any building between it and the car. */
function unblock(from: THREE.Vector3, to: THREE.Vector3): void {
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    const z = from.z + (to.z - from.z) * t;
    const hit = CAMERA_BLOCKERS.some((b) => y < b.height + 1 && x > b.minX - 0.6 && x < b.maxX + 0.6 && z > b.minZ - 0.6 && z < b.maxZ + 0.6);
    if (hit) {
      const back = Math.max(0, t - 1 / steps);
      to.set(from.x + (to.x - from.x) * back, from.y + (to.y - from.y) * back + 1.5, from.z + (to.z - from.z) * back);
      return;
    }
  }
}

/** The player's car: driving, entrance-zone detection, fast travel, and the chase/panel camera. */
export function CarRig() {
  const coupe = useMemo(() => createRetroCoupe(), []);
  const contactShadow = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#000000', alphaMap: radialTexture(), transparent: true, opacity: 0.55, depthWrite: false }),
    [],
  );
  const headlightTargets = useMemo(() => coupe.headlights.map((h) => new THREE.Object3D().translateX(h.x).translateY(0.2).translateZ(-18)), [coupe]);
  const headlightRefs = useRef<THREE.SpotLight[]>([]);

  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const canvas = useThree((s) => s.gl.domElement);
  const keys = useDriveKeys();
  const car = useRef<CarState>(createCarState(SPAWN.position, SPAWN.heading));
  const orbit = useRef<Orbit>({ yaw: 0, pitch: 0, distance: CAMERA.distance, dragging: false, lastX: 0, lastY: 0 });
  const cameraYaw = useRef(SPAWN.heading);
  const shotBlend = useRef(0);
  const lookTarget = useRef(new THREE.Vector3());
  const viewOffset = useRef<[number, number]>([0, 0]);
  const throttleArmed = useRef(true);
  const placed = useRef(false);
  const scratch = useMemo(() => ({ chase: new THREE.Vector3(), look: new THREE.Vector3(), head: new THREE.Vector3() }), []);
  const navToken = usePortfolio((s) => s.navToken);

  const chasePosition = (out: THREE.Vector3) => {
    const s = car.current;
    const o = orbit.current;
    const yaw = cameraYaw.current + o.yaw;
    const elevation = Math.min(1.2, 0.2 + o.pitch);
    const distance = o.distance + Math.abs(s.speed) * 0.08;
    out.set(
      s.position[0] + Math.sin(yaw) * Math.cos(elevation) * distance,
      CAMERA.height * 0.4 + Math.sin(elevation) * distance + 0.4,
      s.position[1] + Math.cos(yaw) * Math.cos(elevation) * distance,
    );
    scratch.head.set(s.position[0], 1.6, s.position[1]);
    unblock(scratch.head, out);
    return out;
  };

  // Navigation requests (menu, click, URL, view switch) move the car to the destination's curb.
  useEffect(() => {
    const { selection, travel, reducedMotion } = usePortfolio.getState();
    const site = selection && selection.section !== 'about' ? towerFor(selection.section) : null;
    const destination = site ? site.parking : selection?.section === 'about' ? SPAWN : null;
    const first = !placed.current;
    placed.current = true;
    throttleArmed.current = false; // a held key must be released before it can close the panel
    if (destination && (travel || first)) {
      car.current = createCarState(destination.position, destination.heading);
      cameraYaw.current = destination.heading;
      if (first || reducedMotion) {
        camera.position.copy(chasePosition(scratch.chase));
      } else {
        // Fast-travel sweep: start high above and glide down into place.
        camera.position.set(destination.position[0], 70, destination.position[1] + 40);
      }
    } else if (first) {
      camera.position.copy(chasePosition(scratch.chase));
    }
    if (first) lookTarget.current.set(car.current.position[0], 1.2, car.current.position[1]);
    // chasePosition reads refs only; re-running on navigation is all that's needed.
  }, [navToken, camera, scratch]);

  // Mouse/touch drag orbits the camera; the wheel zooms.
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
      o.pitch = THREE.MathUtils.clamp(o.pitch + (e.clientY - o.lastY) * 0.004, -0.2, 0.9);
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
    const state = usePortfolio.getState();
    const input = combineInputs(readKeyboardInput(keys.current), touchInput);

    // --- Driving ---
    if (state.panelOpen) {
      if (input.throttle === 0) throttleArmed.current = true;
      else if (throttleArmed.current) state.closePanel(); // driving off closes the panel
      car.current = parkCar(car.current, dt, ENVIRONMENT);
    } else {
      if (input.throttle === 0) throttleArmed.current = true;
      car.current = stepCar(car.current, input, dt, ENVIRONMENT);
    }
    const s = car.current;
    state.setNearTower(towerAtZone(s.position[0], s.position[1])?.section ?? null);

    coupe.group.position.set(s.position[0], 0, s.position[1]);
    coupe.group.rotation.y = s.heading;
    coupe.body.rotation.set(s.pitch, 0, s.roll);
    const steerAngle = s.steer * (CAR.maxSteerAngle / (1 + Math.abs(s.speed) / CAR.steerFalloffSpeed));
    for (const wheel of coupe.wheels) {
      wheel.spin.rotation.x = -s.wheelSpin;
      if (wheel.steer) wheel.steer.rotation.y = steerAngle;
    }

    // --- Camera ---
    const o = orbit.current;
    if (!o.dragging && Math.abs(s.speed) > 2) {
      o.yaw = damp(o.yaw, 0, 1.5, dt);
      o.pitch = damp(o.pitch, 0, 1.5, dt);
    }
    // When reversing, keep looking forward over the car rather than flipping around.
    cameraYaw.current = dampAngle(cameraYaw.current, s.heading, CAMERA.yawResponse, dt);
    chasePosition(scratch.chase);
    scratch.look.set(s.position[0] - Math.sin(s.heading) * 5, 1.4, s.position[1] - Math.cos(s.heading) * 5);

    const site = state.panelOpen && state.selection && state.selection.section !== 'about' ? towerFor(state.selection.section) : null;
    shotBlend.current = damp(shotBlend.current, site ? 1 : 0, state.reducedMotion ? 30 : 2.2, dt);
    const t = THREE.MathUtils.smoothstep(shotBlend.current, 0, 1);
    if (site && t > 0.001) {
      const shot = towerShot(site);
      scratch.chase.lerp(shot.position, t);
      scratch.look.lerp(shot.target, t);
    }
    const response = state.reducedMotion ? 30 : CAMERA.positionResponse;
    camera.position.lerp(scratch.chase, 1 - Math.exp(-response * dt));
    lookTarget.current.lerp(scratch.look, 1 - Math.exp(-CAMERA.lookResponse * dt));
    camera.lookAt(lookTarget.current);

    const fov = 58 + (Math.abs(s.speed) / CAR.maxSpeed) * 8;
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov = damp(camera.fov, fov, 3, dt);
      camera.updateProjectionMatrix();
    }

    const [targetX, targetY] = panelOffset(size.width, size.height, state.panelOpen);
    const offset = viewOffset.current;
    const nextX = damp(offset[0], targetX, 5, dt);
    const nextY = damp(offset[1], targetY, 5, dt);
    if (
      Math.abs(nextX - offset[0]) > 0.05 ||
      Math.abs(nextY - offset[1]) > 0.05 ||
      camera.view?.fullWidth !== size.width ||
      camera.view?.fullHeight !== size.height
    ) {
      offset[0] = nextX;
      offset[1] = nextY;
      camera.setViewOffset(size.width, size.height, nextX, nextY, size.width, size.height);
      camera.updateProjectionMatrix();
    }

    // Beams come on with the lens glow the lighting system sets for the time of day.
    const [dayGlow, nightGlow] = coupe.lens.userData.emissiveByNight as [number, number];
    const night = THREE.MathUtils.clamp((coupe.lens.emissiveIntensity - dayGlow) / (nightGlow - dayGlow), 0, 1);
    for (const light of headlightRefs.current) if (light) light.intensity = night * 120;
  });

  return (
    <primitive object={coupe.group}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.06} material={contactShadow}>
        <planeGeometry args={[2.6, 5.4]} />
      </mesh>
      {coupe.headlights.map((h, i) => (
        <group key={i}>
          <primitive object={headlightTargets[i]} />
          <spotLight
            ref={(light) => {
              if (light) headlightRefs.current[i] = light;
            }}
            position={[h.x, h.y, h.z]}
            target={headlightTargets[i]}
            angle={0.42}
            penumbra={0.7}
            distance={60}
            decay={1.4}
            intensity={0}
            color="#ffe9c4"
          />
        </group>
      ))}
    </primitive>
  );
}
