// How the SeCAREly robot reacts to being bumped (KTD4 of the knock-overs and boost plan): a scripted stumble away
// from the car, a dazed moment, and a walk back to its spot, so it always ends home and its career stop keeps
// working. Pure functions of time; the scene feeds in hits and reads back the pose. Offsets are world x/z meters
// from the robot's home spot.

export const REACTION = {
  /** Farthest the robot is shoved (m), and how fast the car must close on it to count as a hit (m/s). */
  shove: 3,
  minClosing: 2,
  shoveSeconds: 0.6,
  dazeSeconds: 1.5,
  /** Walking speed home (m/s). */
  walkSpeed: 1.2,
  /** Lean at the height of the stumble (radians). */
  tilt: 0.5,
  /** Seconds before another hit earns a new line, and how long a line shows. */
  lineCooldown: 3,
  quipSeconds: 3,
} as const;

type Vec2 = [number, number];

export type ReactionPhase = 'home' | 'shoved' | 'dazed' | 'walking';

export interface ReactionState {
  phase: ReactionPhase;
  /** When the current phase started. */
  since: number;
  /** The shove's start and end. */
  from: Vec2;
  to: Vec2;
  /** Where the robot was at the last step, and when that was. */
  offset: Vec2;
  time: number;
  /** When it last said a line, and which line comes next. */
  lastLine: number;
  nextLine: number;
}

export interface RobotReactionPose {
  offset: Vec2;
  /** Lean away from the car (radians) and the ground direction it leans toward. */
  tilt: number;
  lean: Vec2;
  /** World heading while walking home (0 faces north, positive turns left); null when it should face the road. */
  walkHeading: number | null;
}

export const AT_HOME: ReactionState = {
  phase: 'home',
  since: 0,
  from: [0, 0],
  to: [0, 0],
  offset: [0, 0],
  time: 0,
  lastLine: Number.NEGATIVE_INFINITY,
  nextLine: 0,
};

export interface HitInput {
  time: number;
  /** From the robot to the car, and the car's ground velocity (x, z). */
  toCar: Vec2;
  carVelocity: Vec2;
  /** How many lines the robot has to rotate through. */
  lines: number;
  /** Whether the robot can stand at this offset from home (nothing solid there). */
  clear: (x: number, z: number) => boolean;
}

/**
 * A contact between the car and the robot. It counts as a hit only when the car closes on the robot quickly
 * enough, so a parked or creeping car never sets it off. A hit starts a shove from wherever the robot is, along
 * the car's direction of travel, stopped short of anything solid. Returns the line index to say, or null while
 * the last line is still cooling down.
 */
export function hitRobot(state: ReactionState, { time, toCar, carVelocity, lines, clear }: HitInput): { state: ReactionState; hit: boolean; line: number | null } {
  const distance = Math.hypot(toCar[0], toCar[1]) || 1;
  const closing = -(carVelocity[0] * toCar[0] + carVelocity[1] * toCar[1]) / distance;
  if (closing < REACTION.minClosing) return { state, hit: false, line: null };
  const speed = Math.hypot(carVelocity[0], carVelocity[1]);
  const dir: Vec2 = [carVelocity[0] / speed, carVelocity[1] / speed];
  const reach = Math.min(REACTION.shove, 1 + closing * 0.15);
  const from = state.offset;
  let travel = 0;
  for (let s = 0.25; s <= reach + 1e-9; s += 0.25) {
    if (!clear(from[0] + dir[0] * s, from[1] + dir[1] * s)) break;
    travel = s;
  }
  const speaks = time - state.lastLine >= REACTION.lineCooldown;
  const line = speaks ? state.nextLine % lines : null;
  return {
    hit: true,
    line,
    state: {
      phase: 'shoved',
      since: time,
      from,
      to: [from[0] + dir[0] * travel, from[1] + dir[1] * travel],
      offset: from,
      time,
      lastLine: speaks ? time : state.lastLine,
      nextLine: speaks ? (state.nextLine + 1) % lines : state.nextLine,
    },
  };
}

export interface StepInput {
  time: number;
  /** The car sits on the robot's way home, so it waits. */
  carBlocks: boolean;
  reducedMotion: boolean;
}

/** Advance the reaction to `time` and return where and how the robot stands. */
export function stepReaction(state: ReactionState, { time, carBlocks, reducedMotion }: StepInput): { state: ReactionState; pose: RobotReactionPose } {
  const shoveDir = direction(state.from, state.to);
  const pose = (offset: Vec2, tilt = 0, walkHeading: number | null = null): RobotReactionPose => ({
    offset,
    tilt: reducedMotion ? 0 : tilt,
    lean: shoveDir,
    walkHeading,
  });

  switch (state.phase) {
    case 'home':
      return { state: { ...state, time }, pose: pose([0, 0]) };
    case 'shoved': {
      const u = Math.min(1, (time - state.since) / REACTION.shoveSeconds);
      const ease = 1 - (1 - u) * (1 - u);
      const offset: Vec2 = [state.from[0] + (state.to[0] - state.from[0]) * ease, state.from[1] + (state.to[1] - state.from[1]) * ease];
      const next: ReactionState = u >= 1 ? { ...state, phase: 'dazed', since: time, offset, time } : { ...state, offset, time };
      return { state: next, pose: pose(offset, REACTION.tilt * Math.sin(Math.PI * u)) };
    }
    case 'dazed': {
      const elapsed = time - state.since;
      const wobble = 0.08 * Math.sin(elapsed * 9) * Math.max(0, 1 - elapsed / REACTION.dazeSeconds);
      const next: ReactionState = elapsed >= REACTION.dazeSeconds ? { ...state, phase: 'walking', since: time, time } : { ...state, time };
      return { state: next, pose: pose(state.offset, wobble) };
    }
    case 'walking': {
      const [x, z] = state.offset;
      const remaining = Math.hypot(x, z);
      const heading = Math.atan2(x, z); // facing home: the direction (-x, -z)
      if (carBlocks) return { state: { ...state, time }, pose: pose(state.offset, 0, heading) };
      const step = REACTION.walkSpeed * Math.max(0, time - state.time);
      if (step >= remaining) return { state: { ...state, phase: 'home', since: time, offset: [0, 0], time }, pose: pose([0, 0]) };
      const offset: Vec2 = [x - (x / remaining) * step, z - (z / remaining) * step];
      return { state: { ...state, offset, time }, pose: pose(offset, 0, heading) };
    }
  }
}

function direction(a: Vec2, b: Vec2): Vec2 {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const d = Math.hypot(dx, dz);
  return d > 1e-6 ? [dx / d, dz / d] : [0, 0];
}
