import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, RigidBody, useBeforePhysicsStep, useRapier, type RapierCollider, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { usePortfolio } from '../../state/store';
import { carRefs, walkerRefs } from '../carRef';
import { pondDepth, SPAWN, zoneAt, zoneSelection, type Zone } from '../district/layout';
import { readKeyboardInput, touchActions, touchInput, touchStick, useDriveKeys } from '../drive/input';
import { emit, telemetry } from '../events';
import { canEnter, doorPoint, pickExit, player, PLAYER, pressF, settle, travelTarget, usePlayer } from '../player';
import { headingOf } from '../physics/vehicle';
import { WALKER_GROUPS, WALKER_QUERY_GROUPS } from '../physics/groups';
import { kickImpulse, stepAllowed, WALK, walkVelocity } from '../physics/walker';
import { destinationFor } from './Car';
import { characterPose, stride } from './characterMotion';
import { MODEL_URLS, useModel } from './District';
import { toonify } from './toon';

const GRAVITY = 9.81;
/** How quickly the figure turns to face where it walks (1/s). */
const TURN_RESPONSE = 12;
/** The model stands on its origin; the capsule's centre is this far above its feet. */
const FEET = -(WALK.halfHeight + WALK.radius);
const isTyping = (target: EventTarget | null) => target instanceof Element && !!target.closest('input, textarea, select, [contenteditable="true"], [data-keyboard-scope]');

/** The visitor's feet (U1 of the walking character plan): walks the city, and gets in and out of the car with F. */
export function Walker() {
  const { world, rapier } = useRapier();
  const body = useRef<RapierRigidBody>(null);
  const collider = useRef<RapierCollider>(null);
  const figure = useRef<THREE.Group>(null);
  const keys = useDriveKeys();
  const fall = useRef(0);
  const facing = useRef(0);
  const modeSince = useRef(0);
  const clock = useRef(0);
  const lastZone = useRef<Zone | null>(null);
  const navToken = usePortfolio((s) => s.navToken);
  const mode = usePlayer((s) => s.mode);
  const gait = useRef({ phase: 0, entering: 0 });

  // The chibi character, toon-shaded, with the joints its walk swings (U3).
  const model = useModel(MODEL_URLS.character);
  const character = useMemo(() => {
    const root = model.scene.getObjectByName('character')!.clone();
    root.position.set(0, 0, 0);
    const materials = toonify(root);
    const joint = (name: string) => root.getObjectByName(name)!;
    return {
      root,
      materials,
      head: joint('character_head'),
      armL: joint('character_arm_l'),
      armR: joint('character_arm_r'),
      legL: joint('character_leg_l'),
      legR: joint('character_leg_r'),
    };
  }, [model]);
  useEffect(() => () => character.materials.forEach((m) => m.dispose()), [character]);

  // Created in an effect, not a memo: StrictMode runs effects twice, and the cleanup must not free a controller
  // the next mount still uses.
  const controllerRef = useRef<ReturnType<typeof world.createCharacterController> | null>(null);
  useEffect(() => {
    const c = world.createCharacterController(0.05);
    c.enableAutostep(0.3, 0.2, false);
    c.enableSnapToGround(0.3);
    c.setApplyImpulsesToDynamicBodies(false);
    c.setSlideEnabled(true);
    controllerRef.current = c;
    return () => {
      controllerRef.current = null;
      world.removeCharacterController(c);
    };
  }, [world]);
  useEffect(
    () => () => {
      walkerRefs.body = null;
    },
    [],
  );

  // Start on foot beside the parked car's driver's door (R1).
  const [start] = useState(() => {
    const spawn = destinationFor(usePortfolio.getState().selection?.section) ?? SPAWN;
    const [x, z] = doorPoint(spawn.position, spawn.heading, 1);
    return { x, z, heading: spawn.heading };
  });

  // F (or the touch Get in / Get out button) gets in near the car, and asks a driven car to stop and let them out.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyF' || e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (usePortfolio.getState().view !== '3d') return;
      touchActions.car = true;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Fast travel on foot moves the walker; the car stays put (R9).
  useEffect(() => {
    const b = body.current;
    const { selection, travel } = usePortfolio.getState();
    if (!b || !travel || travelTarget(usePlayer.getState().mode) !== 'walker') return;
    const destination = destinationFor(selection?.section);
    if (!destination) return;
    const [x, z] = doorPoint(destination.position, destination.heading, 1);
    b.setTranslation({ x, y: 0.1 + WALK.halfHeight + WALK.radius, z }, true);
  }, [navToken]);

  // In the car the walker's body is switched off, so nothing bumps into an invisible character (KTD3).
  useEffect(() => {
    const b = body.current;
    if (!b) return;
    const away = mode === 'driving' || mode === 'stopping';
    b.setEnabled(!away);
    if (figure.current) figure.current.visible = !away;
  }, [mode]);

  /** Whether the character can stand at (x, z): dry ground with nothing solid in the way. */
  const clearAt = (x: number, z: number) => {
    if (pondDepth(x, z) > 0) return false;
    const shape = new rapier.Capsule(WALK.halfHeight, WALK.radius);
    const hit = world.intersectionWithShape(
      { x, y: 0.15 + WALK.halfHeight + WALK.radius, z },
      { x: 0, y: 0, z: 0, w: 1 },
      shape,
      rapier.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      collider.current ?? undefined,
      carRefs.body ?? undefined,
    );
    return hit === null;
  };

  useBeforePhysicsStep((w) => {
    const b = body.current;
    const c = collider.current;
    const car = carRefs.body;
    const controller = controllerRef.current;
    if (!b || !c || !car || !controller) return;
    walkerRefs.body = b;
    const dt = w.timestep;
    clock.current += dt;
    const store = usePlayer.getState();
    const state = usePortfolio.getState();
    const carAt = car.translation();
    const carHeading = headingOf(car);

    // F: get in, or ask to get out.
    if (touchActions.car) {
      touchActions.car = false;
      const next = pressF(store.mode, store.nearCar);
      if (next !== store.mode) {
        store.setMode(next);
        modeSince.current = clock.current;
      }
    }
    const current = usePlayer.getState().mode;
    const exit = current === 'stopping' && Math.abs(telemetry.speed) < 0.5 ? pickExit([carAt.x, carAt.z], carHeading, clearAt) : null;
    const settled = settle(current, clock.current - modeSince.current, telemetry.speed, exit !== null);
    if (settled !== current) {
      if (settled === 'foot' && exit) {
        b.setEnabled(true);
        b.setTranslation({ x: exit[0], y: 0.15 + WALK.halfHeight + WALK.radius, z: exit[1] }, true);
        facing.current = carHeading;
      }
      store.setMode(settled);
      modeSince.current = clock.current;
    }
    if (settled !== 'foot' && settled !== 'entering') return;

    // Walk: screen-relative keys or the joystick; Shift (or the touch Boost button) runs.
    const pressed = readKeyboardInput(keys.current);
    const keyStick = { x: (keys.current.has('KeyD') || keys.current.has('ArrowRight') ? 1 : 0) - (keys.current.has('KeyA') || keys.current.has('ArrowLeft') ? 1 : 0), y: pressed.throttle };
    const stick = keyStick.x !== 0 || keyStick.y !== 0 ? keyStick : touchStick;
    const canWalk = settled === 'foot' && !state.revealing && !state.panelOpen && state.view === '3d';
    let [vx, vz] = canWalk ? walkVelocity(stick, pressed.boost || touchInput.boost) : [0, 0];
    const p = b.translation();
    // The pond stops the walker: a step onto water is dropped, axis by axis so the walker slides along the shore.
    if (!stepAllowed([p.x, p.z], [p.x + vx * dt, p.z + vz * dt])) {
      if (stepAllowed([p.x, p.z], [p.x + vx * dt, p.z])) vz = 0;
      else if (stepAllowed([p.x, p.z], [p.x, p.z + vz * dt])) vx = 0;
      else vx = vz = 0;
    }
    fall.current = controller.computedGrounded() ? 0 : fall.current + GRAVITY * dt;
    controller.computeColliderMovement(c, { x: vx * dt, y: -fall.current * dt - 0.02, z: vz * dt }, rapier.QueryFilterFlags.EXCLUDE_SENSORS, WALKER_QUERY_GROUPS);
    const move = controller.computedMovement();
    // Walking into a football kicks it (cones, crates and the rest just block the way).
    for (let i = 0; i < controller.numComputedCollisions(); i++) {
      const hit = controller.computedCollision(i)?.collider?.parent();
      if (!hit || typeof (hit.userData as { football?: number } | undefined)?.football !== 'number') continue;
      const [ix, iy, iz] = kickImpulse([vx, vz], hit.mass());
      hit.applyImpulse({ x: ix, y: iy, z: iz }, true);
    }
    b.setNextKinematicTranslation({ x: p.x + move.x, y: p.y + move.y, z: p.z + move.z });
    if (vx !== 0 || vz !== 0) {
      const target = Math.atan2(-vx, -vz);
      const delta = Math.atan2(Math.sin(target - facing.current), Math.cos(target - facing.current));
      facing.current += delta * Math.min(1, dt * TURN_RESPONSE);
    }
    b.setNextKinematicRotation({ x: 0, y: Math.sin(facing.current / 2), z: 0, w: Math.cos(facing.current / 2) });

    // The player focus while on foot, the get-in prompt, and the stop zones.
    player.position = [p.x, p.y, p.z];
    player.heading = facing.current;
    player.speed = Math.hypot(move.x, move.z) / dt;
    store.setNearCar(settled === 'foot' && canEnter([p.x, p.z], [carAt.x, carAt.z], carHeading));
  });

  // Stop zones follow the player, on foot or driving (KTD1).
  useBeforePhysicsStep(() => {
    const [x, , z] = player.position;
    const zone = zoneAt(x, z);
    if (zone === lastZone.current) return;
    if (lastZone.current) emit({ type: 'zoneExit', section: lastZone.current.section });
    if (zone) emit({ type: 'zoneEnter', section: zone.section });
    lastZone.current = zone;
    usePortfolio.getState().setNearStop(zone ? { selection: zoneSelection(zone), name: zone.name, verb: zone.verb } : null);
  });

  useFrame(({ clock }, dt) => {
    const m = usePlayer.getState().mode;
    const group = figure.current;
    const b = body.current;
    if ((m !== 'foot' && m !== 'entering') || !group || !b) {
      gait.current.entering = 0;
      return;
    }
    player.follow = group;
    const g = gait.current;
    g.entering = m === 'entering' ? g.entering + dt : 0;
    const stepIn = m === 'entering' ? Math.min(1, g.entering / PLAYER.enterSeconds) : null;
    g.phase = stride(g.phase, player.speed, dt);
    const pose = characterPose({ speed: player.speed, phase: g.phase, time: clock.elapsedTime, reducedMotion: usePortfolio.getState().reducedMotion, stepIn });
    character.legL.rotation.x = pose.legL;
    character.legR.rotation.x = pose.legR;
    character.armL.rotation.x = pose.armL;
    character.armR.rotation.x = pose.armR;
    character.head.rotation.x = -pose.head;
    character.root.position.y = pose.bob;
    character.root.rotation.x = -pose.lean;

    // Getting in, the figure glides from where it stood to the driver's door (in the body's own frame).
    const car = carRefs.body;
    if (stepIn !== null && car) {
      const at = car.translation();
      const [dx, dz] = doorPoint([at.x, at.z], headingOf(car), 1);
      const p = b.translation();
      const wx = (dx - p.x) * stepIn;
      const wz = (dz - p.z) * stepIn;
      const a = facing.current;
      group.position.set(wx * Math.cos(a) - wz * Math.sin(a), FEET, wx * Math.sin(a) + wz * Math.cos(a));
    } else {
      group.position.set(0, FEET, 0);
    }
  });

  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[start.x, 0.15 + WALK.halfHeight + WALK.radius, start.z]} rotation={[0, start.heading, 0]}>
      <CapsuleCollider ref={collider} args={[WALK.halfHeight, WALK.radius]} collisionGroups={WALKER_GROUPS} />
      <group ref={figure} position={[0, FEET, 0]}>
        <primitive object={character.root} />
      </group>
    </RigidBody>
  );
}
