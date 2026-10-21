// The nitro boost's tank (KTD5 of the knock-overs and boost plan): a few seconds of boost that drains while held
// and refills after release. Pure state, ticked in the car's physics step and published through telemetry.

export const BOOST = {
  /** Seconds of boost in a full tank. */
  seconds: 3,
  /** Seconds after release before the tank starts refilling. */
  refillDelay: 0.4,
  /** Seconds to refill from empty to full. */
  refillSeconds: 2.5,
  /** Share of the tank an emptied tank must refill to before it boosts again. */
  rearm: 0.2,
  /** Engine force and top speed multipliers while boosting. */
  force: 1.6,
  topSpeed: 1.33,
} as const;

export interface BoostState {
  /** 0 empty .. 1 full. */
  level: number;
  /** Boosting this step. */
  active: boolean;
  /** Ran dry and has not refilled to the re-arm level yet. */
  locked: boolean;
  /** Seconds since boost was last applied. */
  idle: number;
}

export const FULL_TANK: BoostState = { level: 1, active: false, locked: false, idle: BOOST.refillDelay };

/** Advance the tank one step. `wanted` is whether the driver is asking for boost while driving forward. */
export function tickBoost(state: BoostState, dt: number, wanted: boolean): BoostState {
  if (wanted && !state.locked && state.level > 0) {
    const level = Math.max(0, state.level - dt / BOOST.seconds);
    return { level, active: level > 0, locked: level === 0, idle: 0 };
  }
  const idle = state.idle + dt;
  // Hold the boost key on an empty tank and it stays empty: refilling starts once the key is released.
  const refilling = !wanted && idle >= BOOST.refillDelay;
  const level = refilling ? Math.min(1, state.level + dt / BOOST.refillSeconds) : state.level;
  return { level, active: false, locked: state.locked && level < BOOST.rearm, idle: wanted ? 0 : idle };
}
