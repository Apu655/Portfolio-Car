import { AT_HOME, REACTION, hitRobot, stepReaction, type ReactionState } from './robotReaction';

const open = () => true;
const LINES = 5;

/** Advance the reaction from `from` to `to` seconds in 1/60 s steps. */
function run(state: ReactionState, from: number, to: number, carBlocks = false, reducedMotion = false) {
  let pose = stepReaction(state, { time: from, carBlocks, reducedMotion }).pose;
  for (let t = from; t <= to + 1e-9; t += 1 / 60) {
    const next = stepReaction(state, { time: t, carBlocks, reducedMotion });
    state = next.state;
    pose = next.pose;
  }
  return { state, pose };
}

/** A car 2 m south of the robot driving north at `speed` m/s. */
const fromSouth = (speed: number) => ({ toCar: [0, 2] as [number, number], carVelocity: [0, -speed] as [number, number] });

describe('the robot getting bumped', () => {
  it('a car driving into it from the south shoves it north, then it walks back to exactly its spot', () => {
    const hit = hitRobot(AT_HOME, { time: 0, ...fromSouth(12), lines: LINES, clear: open });
    expect(hit.hit).toBe(true);
    const shoved = run(hit.state, 0, REACTION.shoveSeconds + 0.2);
    expect(shoved.pose.offset[1]).toBeLessThan(-1.5);
    expect(shoved.pose.offset[1]).toBeGreaterThanOrEqual(-REACTION.shove - 1e-6);
    expect(Math.abs(shoved.pose.offset[0])).toBeLessThan(0.01);
    const home = run(shoved.state, REACTION.shoveSeconds + 0.2, 10);
    expect(home.state.phase).toBe('home');
    expect(home.pose.offset).toEqual([0, 0]);
    expect(home.pose.walkHeading).toBeNull();
    expect(home.pose.tilt).toBe(0);
  });

  it('tilts away while stumbling, and stays upright under reduced motion', () => {
    const { state } = hitRobot(AT_HOME, { time: 0, ...fromSouth(12), lines: LINES, clear: open });
    expect(Math.abs(run(state, 0, REACTION.shoveSeconds / 2).pose.tilt)).toBeGreaterThan(0.1);
    const steady = run(state, 0, REACTION.shoveSeconds / 2, false, true);
    expect(steady.pose.tilt).toBe(0);
    expect(steady.pose.offset[1]).toBeLessThan(0);
  });

  it('a car creeping into it, or parked against it, is not a hit', () => {
    expect(hitRobot(AT_HOME, { time: 0, ...fromSouth(1), lines: LINES, clear: open }).hit).toBe(false);
    expect(hitRobot(AT_HOME, { time: 0, toCar: [0, 2], carVelocity: [0, 0], lines: LINES, clear: open }).hit).toBe(false);
  });

  it('a car driving away from it is not a hit', () => {
    expect(hitRobot(AT_HOME, { time: 0, toCar: [0, 2], carVelocity: [0, 8], lines: LINES, clear: open }).hit).toBe(false);
  });

  it('stops short of anything solid in its path', () => {
    // A wall 1.5 m north of the robot.
    const clear = (_x: number, z: number) => z > -1.5;
    const { state } = hitRobot(AT_HOME, { time: 0, ...fromSouth(14), lines: LINES, clear });
    const shoved = run(state, 0, REACTION.shoveSeconds + 0.1);
    expect(shoved.pose.offset[1]).toBeGreaterThan(-1.5);
  });

  it('a hit on the walk home starts the shove from where it is, not from home', () => {
    const first = hitRobot(AT_HOME, { time: 0, ...fromSouth(12), lines: LINES, clear: open });
    const walking = run(first.state, 0, REACTION.shoveSeconds + REACTION.dazeSeconds + 0.3);
    expect(walking.state.phase).toBe('walking');
    const where = walking.pose.offset;
    const t = REACTION.shoveSeconds + REACTION.dazeSeconds + 0.3;
    // Hit from the east this time, by a car beside it.
    const second = hitRobot(walking.state, { time: t, toCar: [2, 0], carVelocity: [-10, 0], lines: LINES, clear: open });
    expect(second.hit).toBe(true);
    const start = stepReaction(second.state, { time: t, carBlocks: false, reducedMotion: false }).pose.offset;
    expect(start[0]).toBeCloseTo(where[0], 5);
    expect(start[1]).toBeCloseTo(where[1], 5);
    expect(run(second.state, t, t + REACTION.shoveSeconds + 0.1).pose.offset[0]).toBeLessThan(where[0] - 1);
  });

  it('waits on its walk home while the car blocks the way, then finishes once it moves', () => {
    const { state } = hitRobot(AT_HOME, { time: 0, ...fromSouth(12), lines: LINES, clear: open });
    const start = REACTION.shoveSeconds + REACTION.dazeSeconds;
    const waiting = run(state, 0, start + 3, true);
    expect(waiting.state.phase).toBe('walking');
    const stuck = waiting.pose.offset;
    const still = run(waiting.state, start + 3, start + 5, true);
    expect(still.pose.offset).toEqual(stuck);
    expect(run(still.state, start + 5, start + 12).state.phase).toBe('home');
  });
});

describe('what the robot says', () => {
  it('says a line on a hit, then nothing new for a hit inside the cooldown', () => {
    const first = hitRobot(AT_HOME, { time: 0, ...fromSouth(12), lines: LINES, clear: open });
    expect(first.line).toBe(0);
    const second = hitRobot(first.state, { time: 2, ...fromSouth(12), lines: LINES, clear: open });
    expect(second.hit).toBe(true);
    expect(second.line).toBeNull();
    const third = hitRobot(second.state, { time: 2 + REACTION.lineCooldown, ...fromSouth(12), lines: LINES, clear: open });
    expect(third.line).toBe(1);
  });

  it('goes through every line before repeating one', () => {
    let state = AT_HOME;
    const said: number[] = [];
    for (let i = 0; i < LINES + 1; i++) {
      const hit = hitRobot(state, { time: i * (REACTION.lineCooldown + 1), ...fromSouth(12), lines: LINES, clear: open });
      state = hit.state;
      said.push(hit.line!);
    }
    expect(said).toEqual([0, 1, 2, 3, 4, 0]);
  });
});
