// Knocking a lamp post or tree over (KTD2 and KTD3 of the knock-overs and boost plan). The car drives through it,
// losing a little speed, and the object is thrown along the car's path with an upward kick and a tumble. It lies
// where it lands for a few seconds, then fades away. Pure, so the feel can be tuned and tested here.

export type KnockKind = 'lamp' | 'tree';
type Vec3 = [number, number, number];

export const KNOCK = {
  /** Share of its ground speed the car keeps. */
  keep: { lamp: 0.92, tree: 0.88 },
  /** Throw speed along the car's path: this share of the car's speed, plus a base so a nudge still clears it. */
  throwScale: 0.8,
  throwBase: 2,
  lift: { lamp: 3, tree: 3.5 },
  /** Tumble rate (rad/s) about the axis that tips it away from the car. */
  spin: { lamp: 4, tree: 2.5 },
  lieSeconds: 4,
  fadeSeconds: 1,
  /** Most thrown copies alive at once; another knock retires the oldest. */
  maxCopies: 8,
  /** Car speed (m/s) that sounds as a full-strength knock. */
  fullSpeed: 18,
} as const;

/** The car's velocity after knocking `kind` over: its ground speed trimmed, its direction and fall unchanged. */
export function carAfterKnock([x, y, z]: Vec3, kind: KnockKind): Vec3 {
  const keep = KNOCK.keep[kind];
  return [x * keep, y, z * keep];
}

/**
 * How the knocked object flies: along the car's ground velocity (or its heading when it barely moves), up, and
 * tipping forward. Under reduced motion it stays put and only fades. `heading` uses the layout convention: 0 faces
 * north (-Z), positive turns left.
 */
export function throwOf(carVelocity: Vec3, heading: number, kind: KnockKind, reducedMotion: boolean): { linvel: Vec3; angvel: Vec3 } {
  if (reducedMotion) return { linvel: [0, 0, 0], angvel: [0, 0, 0] };
  const speed = Math.hypot(carVelocity[0], carVelocity[2]);
  const [dx, dz] = speed > 0.5 ? [carVelocity[0] / speed, carVelocity[2] / speed] : [-Math.sin(heading), -Math.cos(heading)];
  const along = speed * KNOCK.throwScale + KNOCK.throwBase;
  // Up × direction: the axis that turns the top toward where the car is going.
  const spin = KNOCK.spin[kind];
  return { linvel: [dx * along, KNOCK.lift[kind], dz * along], angvel: [dz * spin, 0, -dx * spin] };
}

/** How loud a knock at `speed` m/s sounds, 0..1. */
export function knockIntensity(speed: number): number {
  return Math.min(1, Math.max(0.15, speed / KNOCK.fullSpeed));
}

/** A thrown copy's opacity `age` seconds after the knock, and whether it can be removed. */
export function copyFade(age: number): { opacity: number; done: boolean } {
  const fading = (age - KNOCK.lieSeconds) / KNOCK.fadeSeconds;
  if (fading >= 1) return { opacity: 0, done: true };
  return { opacity: fading <= 0 ? 1 : 1 - fading, done: false };
}
