// How the companions get about (KTD5 and KTD6 of the walking character plan), as pure steps of time: each wanders
// between idle spots in its home areas along straight paths clear of buildings, posts, props and the pond; flees
// sideways when the car would reach it within about 1.2 s; leaps clear if the car still closes in; and reacts
// when the player comes near, at most once per cooldown. They have no physics bodies, so the car never hits them.
import { BREAKABLE_COLLIDERS, distanceToCollider, STATIC_COLLIDERS } from '../district/colliders';
import { COMPANION_HOMES, pondNorm, PROPS, WORLD_HALF, type Vec2 } from '../district/layout';

export type CompanionKind = keyof typeof COMPANION_HOMES;

export const COMPANION = {
  walkSpeed: { critter: 1.7, cat: 1.2 } as Record<CompanionKind, number>,
  fleeSpeed: 7,
  /** Flee once the car would arrive within this many seconds, or is closing inside this many metres. */
  warnSeconds: 1.2,
  warnDistance: 10,
  /** A car whose path passes farther than this to the side (m) is no threat. */
  pathHalfWidth: 3,
  /** Leap when the car is this close in time (s) or distance (m), and how long a leap takes. */
  leapSeconds: 0.35,
  leapDistance: 3,
  leapDuration: 0.4,
  leapHeight: 0.9,
  /** How far (m) a companion keeps from anything solid, and from the pond's edge (in pond radii). */
  clearance: 0.7,
  pondMargin: 0.08,
  /** Reactions: range (m), cooldown and duration (s). */
  reactRange: 4,
  reactCooldown: 8,
  reactSeconds: 1.6,
  /** Seconds it idles at a spot. */
  idle: [3, 7] as [number, number],
} as const;

const SOLIDS = [...STATIC_COLLIDERS, ...BREAKABLE_COLLIDERS];

/** Whether a companion can stand at (x, z): dry ground, inside the world, clear of colliders and props. */
export function clearAt(x: number, z: number): boolean {
  if (Math.abs(x) > WORLD_HALF - 2 || Math.abs(z) > WORLD_HALF - 2) return false;
  if (pondNorm(x, z) <= 1 + COMPANION.pondMargin) return false;
  if (PROPS.some((p) => Math.hypot(p.position[0] - x, p.position[2] - z) < COMPANION.clearance + 0.4)) return false;
  return SOLIDS.every((c) => distanceToCollider(c, x, z) > COMPANION.clearance);
}

/** Whether the straight path from `a` to `b` stays clear, sampled every half metre. */
export function segmentClear(a: Vec2, b: Vec2): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!clearAt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false;
  }
  return true;
}

const routeCache = new Map<CompanionKind, number[][]>();

/** For each idle spot, the other spots reachable along a clear straight path. */
export function routes(kind: CompanionKind): number[][] {
  let graph = routeCache.get(kind);
  if (!graph) {
    const spots = COMPANION_HOMES[kind].spots;
    graph = spots.map((a, i) => spots.flatMap((b, j) => (i !== j && segmentClear(a, b) ? [j] : [])));
    routeCache.set(kind, graph);
  }
  return graph;
}

export type CompanionMode = 'idle' | 'walk' | 'flee' | 'leap';

export interface CompanionState {
  kind: CompanionKind;
  position: Vec2;
  /** Height above the ground (a leap). */
  height: number;
  heading: number;
  mode: CompanionMode;
  /** The spot it is at or walking to. */
  spot: number;
  /** Points still to walk through, in order; the last is `spot`. */
  path: Vec2[];
  /** Flee or leap target, and the leap's start point and time. */
  target: Vec2;
  from: Vec2;
  since: number;
  /** When idling ends. */
  until: number;
  lastReact: number;
  reactUntil: number;
  /** When nowhere clear to escape to was found, the next search waits until this time (the search is costly). */
  searchAfter: number;
  /** Ground speed this step (m/s). */
  speed: number;
  seed: number;
}

export interface CompanionInput {
  time: number;
  dt: number;
  car: { position: Vec2; velocity: Vec2 };
  /** Where the player is: the character on foot, or the car. */
  player: Vec2;
}

/** A small deterministic random step (mulberry32), so a route is reproducible in tests. */
function random(seed: number): [number, number] {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const next = (t ^ (t >>> 14)) >>> 0;
  return [next / 4294967296, next];
}

export function startCompanion(kind: CompanionKind, seed = 1): CompanionState {
  const position = COMPANION_HOMES[kind].spots[0];
  return {
    kind,
    position: [...position] as Vec2,
    height: 0,
    heading: Math.PI,
    mode: 'idle',
    spot: 0,
    path: [],
    target: [...position] as Vec2,
    from: [...position] as Vec2,
    since: 0,
    until: 1,
    lastReact: Number.NEGATIVE_INFINITY,
    reactUntil: Number.NEGATIVE_INFINITY,
    searchAfter: Number.NEGATIVE_INFINITY,
    speed: 0,
    seed,
  };
}

/** How the car threatens a companion: seconds until it arrives (Infinity if it is not coming), and the distance. */
export function threat(position: Vec2, car: CompanionInput['car']): { eta: number; distance: number; side: number } {
  const dx = position[0] - car.position[0];
  const dz = position[1] - car.position[1];
  const distance = Math.hypot(dx, dz);
  const speed = Math.hypot(car.velocity[0], car.velocity[1]);
  if (speed < 1 || distance < 1e-6) return { eta: Infinity, distance, side: 1 };
  const ux = car.velocity[0] / speed;
  const uz = car.velocity[1] / speed;
  const ahead = dx * ux + dz * uz;
  // Which side of the car's path the companion is on (+1 right of travel, -1 left), and how far off it.
  const across = dx * -uz + dz * ux;
  const side = across >= 0 ? 1 : -1;
  if (ahead <= 0 || Math.abs(across) > COMPANION.pathHalfWidth) return { eta: Infinity, distance, side };
  return { eta: ahead / speed, distance, side };
}

const towards = (from: Vec2, to: Vec2, step: number): [Vec2, number] => {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const d = Math.hypot(dx, dz);
  if (d <= step) return [[to[0], to[1]], d];
  return [[from[0] + (dx / d) * step, from[1] + (dz / d) * step], step];
};

/**
 * A clear point off the car's path: straight to the side it is already on if that is clear, then the other side,
 * then the nearest clear point in any direction that leaves the path. Null if nothing within reach is clear.
 */
export function escapeTo(position: Vec2, car: CompanionInput['car'], side: number, distances: number[]): Vec2 | null {
  const speed = Math.hypot(car.velocity[0], car.velocity[1]) || 1;
  const ux = car.velocity[0] / speed;
  const uz = car.velocity[1] / speed;
  const across = (p: Vec2) => (p[0] - car.position[0]) * -uz + (p[1] - car.position[1]) * ux;
  const offPath = (p: Vec2) => Math.abs(across(p)) >= COMPANION.pathHalfWidth;
  // The point on the car's path level with the companion; side-step points are measured from there.
  const ahead = (position[0] - car.position[0]) * ux + (position[1] - car.position[1]) * uz;
  const base: Vec2 = [car.position[0] + ux * ahead, car.position[1] + uz * ahead];
  for (const s of [side, -side]) {
    for (const d of distances) {
      const point: Vec2 = [base[0] - uz * s * d, base[1] + ux * s * d];
      if (segmentClear(position, point)) return point;
    }
  }
  for (const radius of [...distances].sort((a, b) => a - b).concat(9)) {
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * 2 * Math.PI;
      const point: Vec2 = [position[0] + Math.cos(a) * radius, position[1] + Math.sin(a) * radius];
      if (offPath(point) && segmentClear(position, point)) return point;
    }
  }
  return null;
}

/**
 * Advance a companion by one step. Returns the new state, and whether it started a reaction this step (the scene
 * plays the sparks or the gadget and its sound).
 */
export function stepCompanion(state: CompanionState, { time, dt, car, player }: CompanionInput): { state: CompanionState; reacted: boolean } {
  const s: CompanionState = { ...state, position: [...state.position] as Vec2, path: [...state.path] };
  const before: Vec2 = [...s.position] as Vec2;
  const danger = threat(s.position, car);
  const closing = danger.eta < COMPANION.warnSeconds || (danger.eta < Infinity && danger.distance < COMPANION.warnDistance);
  const tooClose = danger.eta < COMPANION.leapSeconds || (danger.eta < Infinity && danger.distance < COMPANION.leapDistance);

  // A leap runs its course: sideways and up, landing on a clear point.
  if (s.mode === 'leap') {
    const t = Math.min(1, (time - s.since) / COMPANION.leapDuration);
    s.position = [s.from[0] + (s.target[0] - s.from[0]) * t, s.from[1] + (s.target[1] - s.from[1]) * t];
    s.height = COMPANION.leapHeight * Math.sin(Math.PI * t);
    if (t >= 1) {
      s.mode = 'idle';
      s.height = 0;
      s.until = time + 1;
    }
  } else if ((tooClose || (closing && s.mode !== 'flee')) && time >= s.searchAfter) {
    const target = escapeTo(s.position, car, danger.side, tooClose ? [3.5, 5, 2.5] : [5, 7, 3.5]);
    if (!target) s.searchAfter = time + 0.25;
    else {
      // Come back the way it went, then carry on to its spot.
      s.path.unshift([...s.position] as Vec2);
      s.target = target;
      if (tooClose) {
        s.mode = 'leap';
        s.from = [...s.position] as Vec2;
        s.since = time;
      } else {
        s.mode = 'flee';
      }
    }
  }

  if (s.mode === 'flee') {
    const [next] = towards(s.position, s.target, COMPANION.fleeSpeed * dt);
    s.position = next;
    if (next[0] === s.target[0] && next[1] === s.target[1]) {
      s.mode = 'idle';
      s.until = time + 1.5;
    }
  }

  // Reactions: the player comes within range, once per cooldown.
  let reacted = false;
  const near = Math.hypot(player[0] - s.position[0], player[1] - s.position[1]) <= COMPANION.reactRange;
  if (near && time - s.lastReact >= COMPANION.reactCooldown) {
    s.lastReact = time;
    s.reactUntil = time + COMPANION.reactSeconds;
    reacted = true;
  }
  const reacting = time < s.reactUntil;

  if (!reacting && s.mode === 'idle' && time >= s.until) {
    if (s.path.length === 0) {
      const options = routes(s.kind)[s.spot];
      if (options.length > 0) {
        const [r, seed] = random(s.seed);
        s.seed = seed;
        s.spot = options[Math.floor(r * options.length)];
        s.path = [[...COMPANION_HOMES[s.kind].spots[s.spot]] as Vec2];
      }
    }
    if (s.path.length > 0) s.mode = 'walk';
  }

  if (s.mode === 'walk' && !reacting) {
    let budget = COMPANION.walkSpeed[s.kind] * dt;
    while (budget > 1e-9 && s.path.length > 0) {
      const [next, moved] = towards(s.position, s.path[0], budget);
      s.position = next;
      budget -= moved;
      if (next[0] === s.path[0][0] && next[1] === s.path[0][1]) s.path.shift();
    }
    if (s.path.length === 0) {
      const [r, seed] = random(s.seed);
      s.seed = seed;
      s.mode = 'idle';
      s.until = time + COMPANION.idle[0] + r * (COMPANION.idle[1] - COMPANION.idle[0]);
    }
  }

  const mx = s.position[0] - before[0];
  const mz = s.position[1] - before[1];
  s.speed = dt > 0 ? Math.hypot(mx, mz) / dt : 0;
  if (reacting && s.mode !== 'flee' && s.mode !== 'leap') s.heading = Math.atan2(-(player[0] - s.position[0]), -(player[1] - s.position[1]));
  else if (s.speed > 0.05) s.heading = Math.atan2(-mx, -mz);
  return { state: s, reacted };
}

/** Joint rotations (radians, about local X unless noted) and offsets for a companion's figure. */
export interface CompanionPose {
  legL: number;
  legR: number;
  armL: number;
  armR: number;
  /** Tail wag about local Y. */
  tail: number;
  /** Extra hop height (m) on top of any leap. */
  bob: number;
  /** How far the cat's gadget has risen out of its backpack (m). */
  gadget: number;
}

export const GADGET_RISE = 0.4;

/**
 * How a companion looks this frame: legs that patter with its speed (the critter hops), a wagging tail, and while
 * it reacts, the critter throws its arms up and the cat waves with its gadget raised. Reduced motion keeps the legs
 * and the reaction poses but drops the hop and the wag.
 */
export function companionPose(state: CompanionState, time: number, reducedMotion: boolean): CompanionPose {
  const pace = Math.min(1, state.speed / 3);
  const swing = state.speed > 0.1 ? (0.3 + 0.4 * pace) * Math.sin(time * (9 + 3 * pace)) : 0;
  const reacting = time < state.reactUntil;
  const into = reacting ? Math.min(1, (time - (state.reactUntil - COMPANION.reactSeconds)) / 0.2) : 0;
  const out = reacting ? Math.min(1, (state.reactUntil - time) / 0.25) : 0;
  const shown = Math.min(into, out);
  const hop = state.kind === 'critter' && !reducedMotion ? 0.07 * Math.abs(Math.sin(time * (9 + 3 * pace))) * Math.min(1, state.speed) : 0;
  const pose: CompanionPose = {
    legL: swing,
    legR: -swing,
    armL: -0.6 * swing,
    armR: 0.6 * swing,
    tail: reducedMotion ? 0 : (reacting ? 0.6 : 0.35) * Math.sin(time * (reacting ? 9 : 3)),
    bob: hop,
    gadget: 0,
  };
  if (!reacting) return pose;
  if (state.kind === 'critter') {
    const wiggle = reducedMotion ? 0 : 0.25 * Math.sin(time * 18);
    pose.armL = pose.armR = shown * (2.4 + wiggle);
    pose.bob += reducedMotion ? 0 : 0.12 * shown * Math.abs(Math.sin(time * 7));
  } else {
    pose.armR = shown * (2.5 + (reducedMotion ? 0 : 0.4 * Math.sin(time * 10)));
    pose.gadget = GADGET_RISE * shown;
  }
  return pose;
}
