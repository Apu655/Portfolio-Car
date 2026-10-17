// Pure, frame-rate-independent flight model. No three.js or React here, so it is unit-testable.

export type Vec3 = [number, number, number];

export interface ShipState {
  position: Vec3;
  /** Heading in radians; 0 faces -Z. */
  yaw: number;
  /** Forward speed (negative = reversing). */
  speed: number;
  /** Vertical speed. */
  climb: number;
  yawRate: number;
  /** Cosmetic lean into turns and climbs. */
  bank: number;
  pitch: number;
}

/** Each axis is in [-1, 1]. */
export interface FlightInput {
  thrust: number;
  /** Positive turns left. */
  turn: number;
  lift: number;
}

export interface Obstacle {
  x: number;
  z: number;
  radius: number;
  height: number;
}

export interface FlightEnvironment {
  floorAt(x: number, z: number): number;
  obstacles: Obstacle[];
}

export const FLIGHT = {
  maxSpeed: 55,
  reverseSpeed: 16,
  /** How quickly speed eases toward the throttle target (1/s). */
  acceleration: 1.8,
  turnRate: 1.5,
  turnResponse: 6,
  climbSpeed: 24,
  climbResponse: 4,
  maxAltitude: 260,
  boundaryRadius: 480,
  floorResponse: 7,
  autopilotSpeed: 95,
} as const;

export const NO_INPUT: FlightInput = { thrust: 0, turn: 0, lift: 0 };

export function isIdle(input: FlightInput): boolean {
  return input.thrust === 0 && input.turn === 0 && input.lift === 0;
}

/** Exponential smoothing that behaves the same at 30 or 144 fps. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt);
}

export function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  return current + wrapAngle(target - current) * (1 - Math.exp(-lambda * dt));
}

export function forwardVector(yaw: number): Vec3 {
  return [-Math.sin(yaw), 0, -Math.cos(yaw)];
}

/** Heading that faces from `from` toward `to` on the horizontal plane. */
export function yawToward(from: Vec3, to: Vec3): number {
  return Math.atan2(-(to[0] - from[0]), -(to[2] - from[2]));
}

export function createShipState(position: Vec3, yaw = 0): ShipState {
  return { position: [...position], yaw, speed: 0, climb: 0, yawRate: 0, bank: 0, pitch: 0 };
}

/** Keeps the ship inside the world: above the floor, below the ceiling, inside the boundary, out of obstacles. */
function constrain(state: ShipState, env: FlightEnvironment, dt: number): void {
  const p = state.position;
  const floor = env.floorAt(p[0], p[2]);
  if (p[1] < floor) {
    // Glide up over rooftops instead of snapping, but never sink more than a little below the floor.
    p[1] = Math.max(damp(p[1], floor, FLIGHT.floorResponse, dt), floor - 1.5);
    if (state.climb < 0) state.climb = 0;
  }
  if (p[1] > FLIGHT.maxAltitude) {
    p[1] = FLIGHT.maxAltitude;
    if (state.climb > 0) state.climb = 0;
  }
  const r = Math.hypot(p[0], p[2]);
  if (r > FLIGHT.boundaryRadius) {
    p[0] *= FLIGHT.boundaryRadius / r;
    p[2] *= FLIGHT.boundaryRadius / r;
  }
  for (const o of env.obstacles) {
    if (p[1] > o.height) continue;
    const dx = p[0] - o.x;
    const dz = p[2] - o.z;
    const d = Math.hypot(dx, dz);
    if (d < o.radius) {
      const nx = d > 1e-6 ? dx / d : 0;
      const nz = d > 1e-6 ? dz / d : 1;
      p[0] = o.x + nx * o.radius;
      p[2] = o.z + nz * o.radius;
    }
  }
}

function updateCosmetics(state: ShipState, dt: number): void {
  const speedFactor = Math.min(1, Math.abs(state.speed) / 20) * 0.7 + 0.3;
  state.bank = damp(state.bank, -state.yawRate * 0.55 * speedFactor, 6, dt);
  state.pitch = damp(state.pitch, (state.climb / FLIGHT.climbSpeed) * 0.3, 5, dt);
}

/** Advance manual flight by `dt` seconds. Returns a new state; the input state is not modified. */
export function stepFlight(previous: ShipState, input: FlightInput, dt: number, env: FlightEnvironment): ShipState {
  const s: ShipState = { ...previous, position: [...previous.position] };
  const targetSpeed = input.thrust >= 0 ? input.thrust * FLIGHT.maxSpeed : input.thrust * FLIGHT.reverseSpeed;
  s.speed = damp(s.speed, targetSpeed, FLIGHT.acceleration, dt);
  s.yawRate = damp(s.yawRate, input.turn * FLIGHT.turnRate, FLIGHT.turnResponse, dt);
  s.yaw = wrapAngle(s.yaw + s.yawRate * dt);
  s.climb = damp(s.climb, input.lift * FLIGHT.climbSpeed, FLIGHT.climbResponse, dt);

  const [fx, , fz] = forwardVector(s.yaw);
  s.position[0] += fx * s.speed * dt;
  s.position[1] += s.climb * dt;
  s.position[2] += fz * s.speed * dt;

  constrain(s, env, dt);
  updateCosmetics(s, dt);
  return s;
}

export interface AutopilotGoal {
  position: Vec3;
  lookAt: Vec3;
}

export interface AutopilotStep {
  state: ShipState;
  arrived: boolean;
}

/** Fly toward a parking spot, easing in on arrival and turning to face what we came to see. */
export function stepAutopilot(previous: ShipState, goal: AutopilotGoal, dt: number, env: FlightEnvironment): AutopilotStep {
  const s: ShipState = { ...previous, position: [...previous.position] };
  const p = s.position;
  const d: Vec3 = [goal.position[0] - p[0], goal.position[1] - p[1], goal.position[2] - p[2]];
  const distance = Math.hypot(d[0], d[1], d[2]);

  const desiredSpeed = Math.min(FLIGHT.autopilotSpeed, distance * 1.4);
  s.speed = damp(Math.max(0, s.speed), desiredSpeed, 2.4, dt);
  const stepLength = Math.min(s.speed * dt, distance);
  if (distance > 1e-6) {
    p[0] += (d[0] / distance) * stepLength;
    p[1] += (d[1] / distance) * stepLength;
    p[2] += (d[2] / distance) * stepLength;
  }

  const horizontal = Math.hypot(d[0], d[2]);
  const facingTarget = distance < 14 || horizontal < 4 ? yawToward(p, goal.lookAt) : yawToward(p, goal.position);
  const previousYaw = s.yaw;
  s.yaw = wrapAngle(dampAngle(s.yaw, facingTarget, 3.2, dt));
  s.yawRate = dt > 0 ? wrapAngle(s.yaw - previousYaw) / dt : 0;
  s.climb = distance > 1e-6 ? (d[1] / distance) * s.speed : 0;

  constrain(s, env, dt);
  updateCosmetics(s, dt);

  const headingError = Math.abs(wrapAngle(yawToward(p, goal.lookAt) - s.yaw));
  const remaining = Math.hypot(goal.position[0] - p[0], goal.position[1] - p[1], goal.position[2] - p[2]);
  const arrived = remaining < 0.75 && headingError < 0.06;
  if (arrived) {
    s.speed = 0;
    s.climb = 0;
    s.yawRate = 0;
  }
  return { state: s, arrived };
}
