import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody, useBeforePhysicsStep, useRapier, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { usePortfolio } from '../../state/store';
import { carRefs } from '../carRef';
import { SPAWN, zoneAt, zoneFor, zoneSelection, type Zone } from '../district/layout';
import { combineInputs, readKeyboardInput, touchActions, touchInput, touchStick, useDriveKeys, wantsRecover } from '../drive/input';
import { stickToDrive } from '../drive/screenSteer';
import { emit, telemetry } from '../events';
import { lightingState } from '../lighting/state';
import { FULL_TANK, tickBoost } from '../physics/boost';
import { WaterContact } from '../physics/water';
import {
  applyDrive,
  CAR_TUNING,
  createVehicle,
  FlipWatch,
  forwardSpeed,
  headingOf,
  placeChassis,
  recoverChassis,
  uprightness,
  WHEELS,
  type DriveState,
} from '../physics/vehicle';
import { MODEL_URLS, enableShadows, useModel } from './District';
import { NitroFlame } from './NitroFlame';

/** The car model's origin is on the ground; the chassis origin rides this far above it at rest. */
const VISUAL_OFFSET_Y = -0.7;

const NO_INPUT = { throttle: 0, steer: 0, handbrake: false, boost: false };

function destinationFor(section: string | undefined): { position: [number, number]; heading: number } | null {
  if (!section) return null;
  if (section === 'about') return SPAWN;
  const zone: Zone = zoneFor(section as Zone['section']);
  return zone.parking;
}

/** The player's car: Rapier raycast vehicle, input, zones, fast travel, recovery, and its lights. */
export function Car() {
  const { world, rapier } = useRapier();
  const gltf = useModel(MODEL_URLS.car);
  const body = useRef<RapierRigidBody>(null);
  const visual = useRef<THREE.Group>(null);
  const vehicle = useRef<ReturnType<typeof createVehicle> | null>(null);
  const drive = useRef<DriveState>({ steer: 0 });
  const boost = useRef(FULL_TANK);
  const keys = useDriveKeys();
  const flip = useMemo(() => new FlipWatch(2), []);
  const throttleArmed = useRef(true);
  /** After the reveal, ignore driving keys until they are all released (the skip key must not launch the car). */
  const inputArmed = useRef(true);
  const recoverHeld = useRef(false);
  const lastZone = useRef<Zone | null>(null);
  const water = useMemo(() => new WaterContact(), []);
  const navToken = usePortfolio((s) => s.navToken);

  const model = useMemo(() => {
    const scene = enableShadows(gltf.scene, true, false);
    const wheels = WHEELS.map((w) => {
      const node = scene.getObjectByName(`wheel_${w}`)!;
      return { node, baseY: node.position.y };
    });
    const materials: Record<string, THREE.MeshStandardMaterial> = {};
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m?.name) materials[m.name] = m;
    });
    return { scene, wheels, materials };
  }, [gltf]);

  const headlightTargets = useMemo(() => [-0.62, 0.62].map((x) => new THREE.Object3D().translateX(x).translateY(0.4).translateZ(-20)), []);
  const headlights = useRef<THREE.SpotLight[]>([]);

  // Create the raycast vehicle once the chassis exists.
  useEffect(() => {
    const chassis = body.current;
    if (!chassis) return;
    const v = createVehicle(world, chassis);
    vehicle.current = v;
    carRefs.body = chassis;
    return () => {
      world.removeVehicleController(v);
      vehicle.current = null;
      carRefs.body = null;
    };
  }, [world]);

  // Navigation requests (menu, click, URL, view switch) move the car to the destination's curb.
  useEffect(() => {
    const chassis = body.current;
    if (!chassis) return;
    const { selection, travel } = usePortfolio.getState();
    throttleArmed.current = false;
    if (!travel) return;
    const destination = destinationFor(selection?.section);
    if (destination) placeChassis(chassis, destination.position, destination.heading);
  }, [navToken]);

  useBeforePhysicsStep((w) => {
    const chassis = body.current;
    const v = vehicle.current;
    if (!chassis || !v) return;
    const dt = w.timestep;
    const state = usePortfolio.getState();
    const heading = headingOf(chassis);
    const touch = { ...stickToDrive(touchStick, heading), handbrake: touchInput.handbrake, boost: touchInput.boost };
    let input = combineInputs(readKeyboardInput(keys.current), touch);
    const anyInput = input.throttle !== 0 || input.steer !== 0 || input.handbrake;
    if (state.revealing) inputArmed.current = false;
    else if (!inputArmed.current && !anyInput) inputArmed.current = true;
    if (!inputArmed.current) input = NO_INPUT;

    if (state.panelOpen || state.view !== '3d') {
      // Parked while a panel is open; a fresh throttle press closes the panel and drives off.
      if (input.throttle === 0) throttleArmed.current = true;
      else if (throttleArmed.current && state.panelOpen) state.closePanel();
      if (state.panelOpen) input = { ...NO_INPUT, handbrake: true };
    } else if (input.throttle === 0) {
      throttleArmed.current = true;
    }
    // The nitro boost fires only while driving forward (R11); Shift alone, or with S, does nothing.
    boost.current = tickBoost(boost.current, dt, input.boost && input.throttle > 0 && forwardSpeed(v) > -0.5);
    drive.current = applyDrive(v, input, drive.current, dt, boost.current.active);

    const wet = water.update(chassis, v, dt);
    v.updateVehicle(dt, rapier.QueryFilterFlags.EXCLUDE_SENSORS);

    // Recovery: R (or the touch button) right away; automatically after 2 s upside down.
    const speed = forwardSpeed(v);
    const recover = wantsRecover(keys.current) || touchActions.recover;
    touchActions.recover = false;
    if ((recover && !recoverHeld.current) || flip.update(uprightness(chassis), speed, dt)) {
      recoverChassis(chassis);
      emit({ type: 'recover' });
    }
    recoverHeld.current = recover;

    // Telemetry for audio, VFX, and the HUD.
    const p = chassis.translation();
    let side = 0;
    let onGround = 0;
    for (let i = 0; i < 4; i++) {
      if (v.wheelIsInContact(i)) onGround++;
      side += Math.abs(v.wheelSideImpulse(i) ?? 0);
    }
    const inWater = wet.wheelsInWater > 0;
    telemetry.speed = speed;
    telemetry.throttle = input.throttle;
    telemetry.braking = (input.throttle < 0 && speed > 0.5) || (input.throttle > 0 && speed < -0.5) || input.handbrake;
    telemetry.reversing = speed < -0.3 && input.throttle < 0;
    telemetry.rpm = Math.min(1, Math.abs(speed) / CAR_TUNING.maxSpeed + Math.abs(input.throttle) * 0.25);
    telemetry.slip = Math.min(1, side / 900);
    telemetry.wheelsOnGround = onGround;
    telemetry.position = [p.x, p.y, p.z];
    telemetry.heading = heading;
    telemetry.boost = boost.current.level;
    telemetry.boosting = boost.current.active;
    telemetry.boostLocked = boost.current.locked;
    for (const [slot, wheel] of [[0, 2], [1, 3]] as const) {
      const contact = v.wheelIsInContact(wheel) ? v.wheelContactPoint(wheel) : null;
      telemetry.rearContacts[slot] = contact ? [contact.x, contact.y, contact.z] : null;
    }
    if (wet.entered) emit({ type: 'waterEnter', speed: Math.abs(speed) });
    if (wet.exited) emit({ type: 'waterExit' });
    if (wet.splash) emit({ type: 'splash', intensity: wet.splash.intensity, position: wet.splash.position });
    telemetry.wet = inWater ? 4 : Math.max(0, telemetry.wet - dt);
    telemetry.inWater = inWater;

    // Entrance zones drive the E prompt.
    const zone = zoneAt(p.x, p.z);
    if (zone !== lastZone.current) {
      if (lastZone.current) emit({ type: 'zoneExit', section: lastZone.current.section });
      if (zone) emit({ type: 'zoneEnter', section: zone.section });
      lastZone.current = zone;
      state.setNearStop(zone ? { selection: zoneSelection(zone), name: zone.name, verb: zone.verb } : null);
    }
  });

  useFrame(() => {
    const v = vehicle.current;
    if (!v) return;
    carRefs.visual = visual.current;
    // Wheels: suspension travel, spin, and steering.
    model.wheels.forEach((wheel, i) => {
      const length = v.wheelSuspensionLength(i) ?? CAR_TUNING.suspensionRestLength;
      wheel.node.position.y = CAR_TUNING.wheelY - length - VISUAL_OFFSET_Y;
      wheel.node.rotation.set(-(v.wheelRotation(i) ?? 0), v.wheelSteering(i) ?? 0, 0, 'YXZ');
    });
    // Lights: brake and reverse lights respond to driving; headlights follow the night.
    const night = lightingState.night;
    const m = model.materials;
    if (m.brakelight) m.brakelight.emissiveIntensity = telemetry.braking ? 4 : 0.3 + night * 1.2;
    if (m.reverselight) m.reverselight.emissiveIntensity = telemetry.reversing ? 3 : 0.05;
    if (m.headlight) m.headlight.emissiveIntensity = 0.5 + night * 3;
    for (const light of headlights.current) if (light) light.intensity = night * 90;
  });

  // Initial pose only. react-three-rapier re-applies changed position/rotation props to the body, so these must
  // stay fixed after mount; fast travel moves the car through placeChassis instead.
  const [spawn] = useState(() => destinationFor(usePortfolio.getState().selection?.section) ?? SPAWN);
  return (
    <RigidBody
      ref={body}
      colliders={false}
      position={[spawn.position[0], CAR_TUNING.spawnHeight, spawn.position[1]]}
      rotation={[0, spawn.heading, 0]}
      linearDamping={CAR_TUNING.linearDamping}
      angularDamping={CAR_TUNING.angularDamping}
      ccd
      canSleep={false}
    >
      <CuboidCollider args={[...CAR_TUNING.chassisHalf]} position={[0, CAR_TUNING.chassisOffsetY, 0]} mass={CAR_TUNING.mass} friction={0.4} restitution={0.1} />
      <group ref={visual}>
        <primitive object={model.scene} position={[0, VISUAL_OFFSET_Y, 0]} />
        <group position={[0, VISUAL_OFFSET_Y, 0]}>
          <NitroFlame />
        </group>
        {headlightTargets.map((target, i) => (
          <group key={i}>
            <primitive object={target} />
            <spotLight
              ref={(light) => {
                if (light) headlights.current[i] = light;
              }}
              position={[i === 0 ? -0.62 : 0.62, 0, -2.3]}
              target={target}
              angle={0.45}
              penumbra={0.7}
              distance={45}
              decay={1.3}
              intensity={0}
              color="#ffe9c4"
            />
          </group>
        ))}
      </group>
    </RigidBody>
  );
}
