// How the SeCAREly robot moves (R7, R9), as a pure function of where the car is: it bobs while idle, turns its
// head toward the car, greets it within range, and waves while the car is in its zone. Reduced motion holds it
// still; the greeting still shows.

/** The greeting bubble appears inside GREET_SHOW m and goes beyond GREET_HIDE m, so it never flickers at the edge. */
export const GREET_SHOW = 14;
export const GREET_HIDE = 16;
/** How far the head turns either way from the robot's facing (radians). */
export const HEAD_LIMIT = (70 * Math.PI) / 180;

export interface RobotPoseInput {
  /** Car position relative to the robot (x, z). */
  toCar: [number, number];
  /** The robot's heading (0 faces north, -Z; positive turns left). */
  facing: number;
  time: number;
  inZone: boolean;
  reducedMotion: boolean;
  /** Whether it was greeting last frame. */
  greeting: boolean;
}

export interface RobotPose {
  /** Head turn relative to the body, same convention as rotation.y. */
  headYaw: number;
  /** Height offset of the whole robot. */
  bob: number;
  /** How far the arm is raised from hanging (radians). */
  armAngle: number;
  greeting: boolean;
}

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function robotPose({ toCar: [dx, dz], facing, time, inZone, reducedMotion, greeting }: RobotPoseInput): RobotPose {
  const distance = Math.hypot(dx, dz);
  const greets = greeting ? distance <= GREET_HIDE : distance < GREET_SHOW;
  if (reducedMotion) return { headYaw: 0, bob: 0, armAngle: 0, greeting: greets };
  const toward = Math.atan2(-dx, -dz);
  const headYaw = Math.max(-HEAD_LIMIT, Math.min(HEAD_LIMIT, wrapAngle(toward - facing)));
  const bob = 0.08 * Math.sin(time * 1.6);
  const armAngle = inZone ? 2.3 + 0.35 * Math.sin(time * 6) : 0;
  return { headYaw, bob, armAngle, greeting: greets };
}
