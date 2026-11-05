import { COMPANION_HOMES, pondNorm, type Vec2 } from '../district/layout';
import { clearAt, COMPANION, companionPose, GADGET_RISE, routes, segmentClear, startCompanion, stepCompanion, threat, type CompanionKind, type CompanionState } from './companionSteer';

const KINDS: CompanionKind[] = ['critter', 'cat'];
const FAR: Vec2 = [500, 500];
const parked = { position: [500, 500] as Vec2, velocity: [0, 0] as Vec2 };
const DT = 1 / 60;

const inArea = (kind: CompanionKind, [x, z]: Vec2) =>
  COMPANION_HOMES[kind].areas.some((a) => Math.abs(x - a.center[0]) <= a.size[0] / 2 && Math.abs(z - a.center[1]) <= a.size[1] / 2);

describe('companion homes', () => {
  it.each(KINDS)('every %s idle spot lies in a home area, on dry ground clear of everything solid', (kind) => {
    for (const spot of COMPANION_HOMES[kind].spots) {
      expect(inArea(kind, spot), `${spot}`).toBe(true);
      expect(clearAt(...spot), `${spot}`).toBe(true);
      expect(pondNorm(...spot)).toBeGreaterThan(1);
    }
  });

  it.each(KINDS)('the %s route graph links every spot by clear straight paths', (kind) => {
    const spots = COMPANION_HOMES[kind].spots;
    const graph = routes(kind);
    for (const [i, neighbours] of graph.entries()) {
      expect(neighbours.length, `spot ${i}`).toBeGreaterThan(0);
      for (const j of neighbours) expect(segmentClear(spots[i], spots[j])).toBe(true);
    }
    // Connected: every spot is reachable from the first.
    const seen = new Set([0]);
    const queue = [0];
    while (queue.length) for (const j of graph[queue.shift()!]) if (!seen.has(j)) (seen.add(j), queue.push(j));
    expect(seen.size).toBe(spots.length);
  });
});

/** Run a car straight at a companion from `start` metres away at `speed` m/s; returns the closest approach. */
function carPass(kind: CompanionKind, spotIndex: number, heading: Vec2, speed: number) {
  const spot = COMPANION_HOMES[kind].spots[spotIndex];
  let state: CompanionState = { ...startCompanion(kind), position: [...spot] as Vec2, spot: spotIndex, until: Infinity };
  const start = speed * 3;
  const car = { position: [spot[0] - heading[0] * start, spot[1] - heading[1] * start] as Vec2, velocity: [heading[0] * speed, heading[1] * speed] as Vec2 };
  let closest = Infinity;
  let firstMove = Infinity;
  const landings: Vec2[] = [];
  for (let time = 0; time < 5; time += DT) {
    car.position = [car.position[0] + car.velocity[0] * DT, car.position[1] + car.velocity[1] * DT];
    const before = state.mode;
    state = stepCompanion(state, { time, dt: DT, car, player: FAR }).state;
    if (state.mode !== 'idle' && firstMove === Infinity) firstMove = Math.hypot(spot[0] - car.position[0], spot[1] - car.position[1]) / speed;
    if ((before === 'flee' || before === 'leap') && state.mode === 'idle') landings.push(state.position);
    closest = Math.min(closest, Math.hypot(state.position[0] - car.position[0], state.position[1] - car.position[1]));
  }
  return { closest, firstMove, landings };
}

describe('getting out of the car’s way (AE4)', () => {
  it('sees a car coming only when its path passes close', () => {
    expect(threat([0, 0], { position: [0, 20], velocity: [0, -10] }).eta).toBeCloseTo(2, 6);
    expect(threat([0, 0], { position: [6, 20], velocity: [0, -10] }).eta).toBe(Infinity);
    expect(threat([0, 0], { position: [0, -20], velocity: [0, -10] }).eta).toBe(Infinity);
    expect(threat([0, 0], parked).eta).toBe(Infinity);
  });

  it.each([10, 35])('at %s m/s the car moves it aside about 1.2 s out and never comes within 1 m', (speed) => {
    for (const kind of KINDS) {
      for (const [i] of COMPANION_HOMES[kind].spots.entries()) {
        for (const heading of [[1, 0], [0, 1], [-Math.SQRT1_2, Math.SQRT1_2]] as Vec2[]) {
          const { closest, firstMove, landings } = carPass(kind, i, heading, speed);
          expect(closest, `${kind} spot ${i}`).toBeGreaterThan(1);
          expect(firstMove).toBeGreaterThan(COMPANION.warnSeconds - 0.1);
          expect(firstMove).toBeLessThan(COMPANION.warnSeconds + 0.1 + COMPANION.warnDistance / speed);
          for (const landing of landings) expect(clearAt(...landing), `${landing}`).toBe(true);
        }
      }
    }
  });
});

describe('boxed in', () => {
  it('with nowhere clear to go, waits a moment before searching again', () => {
    // Standing in the middle of the pond leaves no clear escape point.
    const state: CompanionState = { ...startCompanion('critter'), position: [-35, -6], until: Infinity };
    const car = { position: [-35, 4] as Vec2, velocity: [0, -10] as Vec2 };
    const first = stepCompanion(state, { time: 0, dt: DT, car, player: FAR }).state;
    expect(first.mode).toBe('idle');
    expect(first.searchAfter).toBeCloseTo(0.25, 6);
  });
});

describe('reactions and roaming', () => {
  it('reacts once when the player comes near, and not again on a quick return', () => {
    let state = startCompanion('critter');
    const spot = state.position;
    const near: Vec2 = [spot[0] + 2, spot[1]];
    let reactions = 0;
    const visit = (from: number, to: number, player: Vec2) => {
      for (let time = from; time < to; time += DT) {
        const step = stepCompanion(state, { time, dt: DT, car: parked, player });
        state = step.state;
        if (step.reacted) reactions++;
      }
    };
    visit(0, 0.5, near);
    expect(reactions).toBe(1);
    visit(0.5, 2, FAR);
    visit(2, 3, [state.position[0] + 2, state.position[1]]);
    expect(reactions).toBe(1);
  });

  it('with no car near, walks to its next spot and idles there', () => {
    let state = startCompanion('cat', 7);
    const spots = COMPANION_HOMES.cat.spots;
    const visited = new Set<number>();
    for (let time = 0; time < 120; time += DT) {
      state = stepCompanion(state, { time, dt: DT, car: parked, player: FAR }).state;
      if (state.mode === 'idle' && Math.hypot(state.position[0] - spots[state.spot][0], state.position[1] - spots[state.spot][1]) < 1e-6) visited.add(state.spot);
      expect(state.speed).toBeLessThanOrEqual(COMPANION.walkSpeed.cat + 1e-6);
    }
    expect(visited.size).toBeGreaterThan(2);
  });
});

describe('companion poses', () => {
  const at = (kind: CompanionKind, extra: Partial<CompanionState>) => ({ ...startCompanion(kind), ...extra });

  it('stands still when idle, and patters its legs in turn when it walks', () => {
    const idle = companionPose(at('cat', { speed: 0 }), 1, false);
    expect([idle.legL, idle.armR, idle.gadget]).toEqual([0, 0, 0]);
    const walking = companionPose(at('cat', { speed: 1.2 }), 1.1, false);
    expect(Math.abs(walking.legL)).toBeGreaterThan(0.05);
    expect(walking.legR).toBeCloseTo(-walking.legL, 6);
  });

  it('while reacting the critter throws its arms up and the cat waves with its gadget out', () => {
    const critter = companionPose(at('critter', { reactUntil: 2 }), 1, false);
    expect(critter.armL).toBeGreaterThan(1.5);
    const cat = companionPose(at('cat', { reactUntil: 2 }), 1, false);
    expect(cat.armR).toBeGreaterThan(1.5);
    expect(cat.gadget).toBeCloseTo(GADGET_RISE, 6);
    // Back in the pack once the reaction is over.
    expect(companionPose(at('cat', { reactUntil: 2 }), 2.1, false).gadget).toBe(0);
  });

  it('under reduced motion drops the hop and the wag but keeps the reaction', () => {
    const pose = companionPose(at('critter', { speed: 1.7, reactUntil: 2 }), 1, true);
    expect(pose.bob).toBe(0);
    expect(pose.tail).toBe(0);
    expect(pose.armL).toBeGreaterThan(1.5);
  });
});
