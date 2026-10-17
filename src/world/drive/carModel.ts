// Pure, frame-rate-independent arcade car model (no three.js, no React), so handling is unit-testable.
import type { Box, Vec2 } from '../city/cityLayout';

export interface CarState {
  position: Vec2;
  /** Radians; 0 faces -Z, positive turns left. */
  heading: number;
  /** Signed speed along the heading (m/s); negative is reversing. */
  speed: number;
  /** Smoothed steering input in [-1, 1]. */
  steer: number;
  yawRate: number;
  /** Cosmetic body lean (roll into turns, pitch under acceleration and braking). */
  roll: number;
  pitch: number;
  /** Accumulated wheel rotation for rendering. */
  wheelSpin: number;
}

/** Each axis in [-1, 1]. Positive throttle drives forward; positive steer turns left. */
export interface DriveInput {
  throttle: number;
  steer: number;
  handbrake: boolean;
}

export interface DriveEnvironment {
  obstacles: Box[];
  /** The car stays within |x|, |z| <= bound. */
  bound: number;
}

export const CAR = {
  maxSpeed: 24,
  reverseSpeed: 7,
  acceleration: 8.5,
  braking: 20,
  rollingDrag: 2.2,
  handbrakeDrag: 13,
  wheelBase: 2.55,
  maxSteerAngle: 0.6,
  steerResponse: 7,
  /** Speed at which steering lock has halved, so it stays stable at speed. */
  steerFalloffSpeed: 17,
  wheelRadius: 0.36,
  /** Two circles (front and rear) approximate the body for collisions. */
  colliderOffset: 1.25,
  colliderRadius: 1.05,
} as const;

export const NO_DRIVE_INPUT: DriveInput = { throttle: 0, steer: 0, handbrake: false };

export function damp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt);
}

export function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  return current + wrapAngle(target - current) * (1 - Math.exp(-lambda * dt));
}

export function forward(heading: number): Vec2 {
  return [-Math.sin(heading), -Math.cos(heading)];
}

export function createCarState(position: Vec2, heading = 0): CarState {
  return { position: [...position], heading, speed: 0, steer: 0, yawRate: 0, roll: 0, pitch: 0, wheelSpin: 0 };
}

/** Move toward zero by `amount` without crossing it. */
function toward0(value: number, amount: number): number {
  return Math.abs(value) <= amount ? 0 : value - Math.sign(value) * amount;
}

function nextSpeed(speed: number, input: DriveInput, dt: number): number {
  if (input.handbrake) return toward0(speed, CAR.handbrakeDrag * dt);
  const t = input.throttle;
  if (t > 0) {
    if (speed < -0.05) return Math.min(0, speed + CAR.braking * t * dt); // braking out of reverse
    // Eases off near top speed instead of hitting a wall.
    return Math.min(CAR.maxSpeed, speed + CAR.acceleration * t * (1 - speed / CAR.maxSpeed) * dt);
  }
  if (t < 0) {
    if (speed > 0.05) return Math.max(0, speed + CAR.braking * t * dt); // S brakes first...
    return Math.max(-CAR.reverseSpeed, speed + CAR.acceleration * 0.6 * t * (1 + speed / CAR.reverseSpeed) * dt); // ...then reverses
  }
  return toward0(speed, (CAR.rollingDrag + Math.abs(speed) * 0.04) * dt);
}

/** Push the circle at (x, z) out of a box; returns the push normal when it collided. */
function resolveCircle(p: Vec2, radius: number, b: Box): Vec2 | null {
  const cx = Math.min(Math.max(p[0], b.minX), b.maxX);
  const cz = Math.min(Math.max(p[1], b.minZ), b.maxZ);
  let dx = p[0] - cx;
  let dz = p[1] - cz;
  const d = Math.hypot(dx, dz);
  if (d >= radius) return null;
  if (d < 1e-6) {
    // Center inside the box: leave through the nearest face.
    const exits: Array<[number, Vec2]> = [
      [p[0] - b.minX, [-1, 0]],
      [b.maxX - p[0], [1, 0]],
      [p[1] - b.minZ, [0, -1]],
      [b.maxZ - p[1], [0, 1]],
    ];
    exits.sort((a, c) => a[0] - c[0]);
    const [depth, n] = exits[0];
    p[0] += n[0] * (depth + radius);
    p[1] += n[1] * (depth + radius);
    return n;
  }
  dx /= d;
  dz /= d;
  const push = radius - d;
  p[0] += dx * push;
  p[1] += dz * push;
  return [dx, dz];
}

/**
 * Speed kept after touching a wall: only the part of the motion pointing into it is lost, so a glancing contact
 * slides along and a head-on one stops. `head` is |cos| of the angle between heading and the wall's normal.
 */
function slideFactor(head: number): number {
  return Math.sqrt(Math.max(0, 1 - head * head));
}

/** Keep the car out of obstacles and inside the world; scrub only the speed that went into the wall. */
function collide(s: CarState, env: DriveEnvironment): void {
  for (let pass = 0; pass < 2; pass++) {
    for (const sign of [1, -1]) {
      const [fx, fz] = forward(s.heading);
      const c: Vec2 = [s.position[0] + fx * CAR.colliderOffset * sign, s.position[1] + fz * CAR.colliderOffset * sign];
      const before: Vec2 = [c[0], c[1]];
      const reach = CAR.colliderRadius + 0.01;
      for (const b of env.obstacles) {
        if (c[0] < b.minX - reach || c[0] > b.maxX + reach || c[1] < b.minZ - reach || c[1] > b.maxZ + reach) continue;
        const n = resolveCircle(c, CAR.colliderRadius, b);
        if (n) s.speed *= slideFactor(Math.abs(fx * n[0] + fz * n[1]));
      }
      const limit = env.bound - CAR.colliderRadius;
      if (Math.abs(c[0]) > limit) {
        c[0] = Math.sign(c[0]) * limit;
        s.speed *= slideFactor(Math.abs(fx));
      }
      if (Math.abs(c[1]) > limit) {
        c[1] = Math.sign(c[1]) * limit;
        s.speed *= slideFactor(Math.abs(fz));
      }
      s.position[0] += c[0] - before[0];
      s.position[1] += c[1] - before[1];
    }
  }
}

/** Advance the car by `dt` seconds. Returns a new state; the input state is not modified. */
export function stepCar(previous: CarState, input: DriveInput, dt: number, env: DriveEnvironment): CarState {
  const s: CarState = { ...previous, position: [...previous.position] };
  const oldSpeed = s.speed;
  s.speed = nextSpeed(s.speed, input, dt);

  s.steer = damp(s.steer, input.steer, CAR.steerResponse, dt);
  const lock = CAR.maxSteerAngle / (1 + Math.abs(s.speed) / CAR.steerFalloffSpeed);
  // Bicycle model: yaw rate follows speed and steering angle; a handbrake lets the rear step out a little.
  s.yawRate = (s.speed / CAR.wheelBase) * Math.tan(s.steer * lock) * (input.handbrake ? 1.35 : 1);
  s.heading = wrapAngle(s.heading + s.yawRate * dt);

  const [fx, fz] = forward(s.heading);
  s.position[0] += fx * s.speed * dt;
  s.position[1] += fz * s.speed * dt;
  collide(s, env);

  const longitudinal = dt > 0 ? (s.speed - oldSpeed) / dt : 0;
  s.roll = damp(s.roll, Math.max(-0.08, Math.min(0.08, -s.yawRate * s.speed * 0.01)), 8, dt);
  s.pitch = damp(s.pitch, Math.max(-0.05, Math.min(0.05, longitudinal * 0.004)), 8, dt);
  s.wheelSpin += (s.speed / CAR.wheelRadius) * dt;
  return s;
}

/** Bring the car to rest smoothly (used while an info panel is open). */
export function parkCar(previous: CarState, dt: number, env: DriveEnvironment): CarState {
  const s: CarState = { ...previous, position: [...previous.position] };
  s.speed = toward0(s.speed, CAR.braking * 1.5 * dt);
  const [fx, fz] = forward(s.heading);
  s.position[0] += fx * s.speed * dt;
  s.position[1] += fz * s.speed * dt;
  collide(s, env);
  s.steer = damp(s.steer, 0, CAR.steerResponse, dt);
  s.yawRate = 0;
  s.roll = damp(s.roll, 0, 8, dt);
  s.pitch = damp(s.pitch, 0, 8, dt);
  s.wheelSpin += (s.speed / CAR.wheelRadius) * dt;
  return s;
}
