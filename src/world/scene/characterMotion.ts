// How the character moves (U3 of the walking character plan), as a pure function of its ground speed and stride:
// it breathes while standing, swings its legs and arms in turn when it walks, swings harder and leans in when it
// runs, and lifts a foot and reaches forward while it steps into the car. Reduced motion keeps the limbs swinging,
// so walking still reads, but drops the bob and the lean.
import { WALK } from '../physics/walker';

/** Under this speed (m/s) the character is standing. */
export const STAND_SPEED = 0.2;
/** Largest leg swing (radians), reached at running speed. */
export const MAX_SWING = 0.85;

export interface CharacterPoseInput {
  /** Ground speed (m/s). */
  speed: number;
  /** Stride phase (radians), advanced by `stride`. */
  phase: number;
  time: number;
  reducedMotion: boolean;
  /** Progress (0 to 1) of the step into the car, or null when not getting in. */
  stepIn: number | null;
}

/** Rotations about each joint's local X (positive swings the limb forward, toward -Z), and body offsets. */
export interface CharacterPose {
  legL: number;
  legR: number;
  armL: number;
  armR: number;
  /** Head nod (positive looks down). */
  head: number;
  /** Height offset of the whole figure (m). */
  bob: number;
  /** Forward lean of the whole figure (radians). */
  lean: number;
}

/** Advance the stride phase: longer strides as the character speeds up, so a run is not a frantic walk. */
export function stride(phase: number, speed: number, dt: number): number {
  const cycle = 1.4 + 0.15 * speed; // metres per full step cycle
  return (phase + ((2 * Math.PI) / cycle) * speed * dt) % (2 * Math.PI);
}

export function characterPose({ speed, phase, time, reducedMotion, stepIn }: CharacterPoseInput): CharacterPose {
  if (stepIn !== null) {
    const t = Math.max(0, Math.min(1, stepIn));
    const lift = Math.sin(Math.PI * t);
    return { legL: 0, legR: 0.9 * lift, armL: 0.5 * lift, armR: 0.7 * lift, head: 0, bob: reducedMotion ? 0 : 0.04 * lift, lean: reducedMotion ? 0 : 0.15 * lift };
  }
  const moving = Math.abs(speed) >= STAND_SPEED;
  const pace = Math.min(1, Math.abs(speed) / WALK.runSpeed);
  const swing = moving ? MAX_SWING * pace : 0;
  const legL = swing * Math.sin(phase);
  const breath = moving ? 0 : 0.008 * Math.sin(time * 2.2);
  return {
    legL,
    legR: -legL,
    // Arms swing against the legs, and a standing character's arms hang still.
    armL: -0.8 * legL,
    armR: 0.8 * legL,
    head: moving ? 0.05 * pace : 0,
    bob: reducedMotion ? 0 : 0.05 * pace * Math.abs(Math.sin(phase)) + breath,
    lean: reducedMotion ? 0 : 0.14 * pace,
  };
}
