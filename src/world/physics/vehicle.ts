// The physics car: a Rapier raycast vehicle on a dynamic chassis (KTD1). Plain functions over Rapier objects,
// shared by the R3F component and the headless tests so handling is tested on the real physics engine.
import type RAPIER from '@dimforge/rapier3d-compat';
import { MathUtils } from 'three';
import type { DriveInput } from '../drive/input';
import { BOOST } from './boost';

type Rapier = typeof RAPIER;
type World = RAPIER.World;
type RigidBody = RAPIER.RigidBody;
type Controller = RAPIER.DynamicRayCastVehicleController;

/** Handling and geometry. Units: meters, kilograms, newtons, seconds. */
export const CAR_TUNING = {
  mass: 950,
  /** Chassis collider half extents (x, y, z); the body rides on top of the wheels. */
  chassisHalf: [0.92, 0.36, 2.15] as const,
  /** Chassis collider center relative to the rigid body origin. */
  chassisOffsetY: 0.18,
  wheelX: 0.84,
  wheelZ: 1.32,
  wheelY: -0.05,
  wheelRadius: 0.36,
  suspensionRestLength: 0.32,
  suspensionStiffness: 24,
  /** Firmer damping so the body settles quickly after bumps and turns. */
  suspensionCompression: 3.2,
  suspensionRelaxation: 4.2,
  maxSuspensionTravel: 0.28,
  maxSuspensionForce: 60000,
  frictionSlip: 2.1,
  /** Rear grip drops with the handbrake so the car can slide. */
  handbrakeFrictionSlip: 0.75,
  sideFrictionStiffness: 1,
  /** Peak engine force per driven (rear) wheel. */
  engineForce: 2600,
  reverseForce: 1300,
  maxSpeed: 26,
  reverseMaxSpeed: 8,
  brakeForce: 45,
  rollingBrake: 3.5,
  maxSteer: 0.52,
  /** Speed (m/s) at which the steering lock has halved, for stability at speed. */
  steerFalloffSpeed: 12,
  /** How quickly the wheels follow the steering input (1/s): unhurried, so turns feel smooth. */
  steerResponse: 5.5,
  /** How quickly the throttle eases toward the pedal (1/s): in when pressing, a little faster out. */
  throttleRise: 9,
  throttleFall: 14,
  linearDamping: 0.05,
  angularDamping: 1,
  /** Spawn height of the chassis origin above the ground. */
  spawnHeight: 0.85,
} as const;

/** Wheel order used everywhere: front-left, front-right, rear-left, rear-right. */
export const WHEELS = ['FL', 'FR', 'RL', 'RR'] as const;

export interface DriveState {
  /** Smoothed steering in [-1, 1]. */
  steer: number;
  /** Smoothed throttle in [-1, 1] (negative brakes, then reverses); starts at 0. */
  throttle?: number;
}

export function createChassis(world: World, rapier: Rapier, position: [number, number, number], heading: number): RigidBody {
  const t = CAR_TUNING;
  const body = world.createRigidBody(
    rapier.RigidBodyDesc.dynamic()
      .setTranslation(position[0], position[1] + t.spawnHeight, position[2])
      .setRotation(headingQuat(heading))
      .setLinearDamping(t.linearDamping)
      .setAngularDamping(t.angularDamping)
      .setCcdEnabled(true),
  );
  world.createCollider(
    rapier.ColliderDesc.cuboid(...t.chassisHalf)
      .setTranslation(0, t.chassisOffsetY, 0)
      .setMass(t.mass)
      .setFriction(0.4)
      .setRestitution(0.1)
      .setActiveEvents(rapier.ActiveEvents.COLLISION_EVENTS | rapier.ActiveEvents.CONTACT_FORCE_EVENTS),
    body,
  );
  return body;
}

export function headingQuat(heading: number): { x: number; y: number; z: number; w: number } {
  return { x: 0, y: Math.sin(heading / 2), z: 0, w: Math.cos(heading / 2) };
}

/** Attach four raycast wheels to a chassis. Forward is local -Z (the car's nose). */
export function createVehicle(world: World, chassis: RigidBody): Controller {
  const t = CAR_TUNING;
  const vehicle = world.createVehicleController(chassis);
  vehicle.setIndexForwardAxis = 2;
  const positions: Array<[number, number]> = [
    [-t.wheelX, -t.wheelZ],
    [t.wheelX, -t.wheelZ],
    [-t.wheelX, t.wheelZ],
    [t.wheelX, t.wheelZ],
  ];
  positions.forEach(([x, z], i) => {
    vehicle.addWheel({ x, y: t.wheelY, z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, t.suspensionRestLength, t.wheelRadius);
    vehicle.setWheelSuspensionStiffness(i, t.suspensionStiffness);
    vehicle.setWheelSuspensionCompression(i, t.suspensionCompression);
    vehicle.setWheelSuspensionRelaxation(i, t.suspensionRelaxation);
    vehicle.setWheelMaxSuspensionTravel(i, t.maxSuspensionTravel);
    vehicle.setWheelMaxSuspensionForce(i, t.maxSuspensionForce);
    vehicle.setWheelFrictionSlip(i, t.frictionSlip);
    vehicle.setWheelSideFrictionStiffness(i, t.sideFrictionStiffness);
  });
  return vehicle;
}

/** Signed speed along the car's nose (m/s); negative when reversing. */
export function forwardSpeed(vehicle: Controller): number {
  // The controller measures along +Z (its forward axis); the nose points -Z.
  return -vehicle.currentVehicleSpeed();
}

/**
 * Translate player input into engine force, brakes, and steering for one physics step. While `boosting`, the
 * engine pulls harder and tops out higher (KTD5 of the knock-overs and boost plan).
 * S brakes while moving forward, then reverses; W does the mirror when rolling backward.
 */
export function applyDrive(vehicle: Controller, input: DriveInput, state: DriveState, dt: number, boosting = false): DriveState {
  const t = CAR_TUNING;
  const force = boosting ? t.engineForce * BOOST.force : t.engineForce;
  const topSpeed = boosting ? t.maxSpeed * BOOST.topSpeed : t.maxSpeed;
  const speed = forwardSpeed(vehicle);
  // Ease the pedal so a key press builds power over a moment instead of jolting the car.
  const previous = state.throttle ?? 0;
  const rising = Math.abs(input.throttle) > Math.abs(previous);
  const throttle = MathUtils.damp(previous, input.throttle, rising ? t.throttleRise : t.throttleFall, dt);
  input = { ...input, throttle: Math.abs(throttle) < 0.01 && input.throttle === 0 ? 0 : throttle };
  let engine = 0;
  let brake = input.throttle === 0 ? t.rollingBrake : 0;
  if (input.throttle > 0) {
    if (speed < -0.5) brake = t.brakeForce * input.throttle;
    // Full force through the middle of the range, easing off only near top speed.
    else engine = -force * input.throttle * Math.max(0, 1 - Math.pow(Math.max(0, speed) / topSpeed, 3));
  } else if (input.throttle < 0) {
    if (speed > 0.5) brake = t.brakeForce * -input.throttle;
    else engine = t.reverseForce * -input.throttle * Math.max(0, 1 + speed / t.reverseMaxSpeed);
  }
  const steer = MathUtils.damp(state.steer, input.steer, t.steerResponse, dt);
  const angle = (steer * t.maxSteer) / (1 + Math.abs(speed) / t.steerFalloffSpeed);
  for (let i = 0; i < 4; i++) {
    const front = i < 2;
    vehicle.setWheelSteering(i, front ? angle : 0);
    vehicle.setWheelEngineForce(i, front ? 0 : engine);
    const handbrake = input.handbrake && !front;
    vehicle.setWheelBrake(i, handbrake ? t.brakeForce * 0.8 : brake);
    vehicle.setWheelFrictionSlip(i, handbrake ? t.handbrakeFrictionSlip : t.frictionSlip);
  }
  return { steer, throttle: input.throttle };
}

/** How upright the chassis is: 1 = level, 0 = on its side, -1 = upside down. */
export function uprightness(body: RigidBody): number {
  const q = body.rotation();
  // Local +Y rotated into world space; we only need its y component.
  return 1 - 2 * (q.x * q.x + q.z * q.z);
}

export function headingOf(body: RigidBody): number {
  const q = body.rotation();
  // Yaw of the nose (-Z) projected onto the ground plane.
  const fx = -2 * (q.x * q.z + q.w * q.y);
  const fz = -(1 - 2 * (q.x * q.x + q.y * q.y));
  return Math.atan2(-fx, -fz);
}

/** Put the car back on its wheels at its current spot and heading, a little above the ground. */
export function recoverChassis(body: RigidBody, groundY = 0): void {
  const p = body.translation();
  body.setTranslation({ x: p.x, y: groundY + CAR_TUNING.spawnHeight + 0.6, z: p.z }, true);
  body.setRotation(headingQuat(headingOf(body)), true);
  body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  body.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

/** Teleport (fast travel): place the car at a parking spot facing `heading`, at rest. */
export function placeChassis(body: RigidBody, position: [number, number], heading: number, groundY = 0): void {
  body.setTranslation({ x: position[0], y: groundY + CAR_TUNING.spawnHeight, z: position[1] }, true);
  body.setRotation(headingQuat(heading), true);
  body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  body.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

/** Tracks how long the car has been upside down or on its side; returns true when it should auto-recover. */
export class FlipWatch {
  private seconds = 0;
  constructor(private readonly threshold = 2) {}
  update(upright: number, speed: number, dt: number): boolean {
    this.seconds = upright < 0.35 && Math.abs(speed) < 3 ? this.seconds + dt : 0;
    if (this.seconds >= this.threshold) {
      this.seconds = 0;
      return true;
    }
    return false;
  }
}
