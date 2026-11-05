import { VIEW } from '../district/layout';
import { POND } from '../district/layout';
import { kickImpulse, stepAllowed, WALK, walkVelocity } from './walker';

describe('walking on foot', () => {
  it('pushing up on screen walks toward the top of the screen, at walking speed', () => {
    const [vx, vz] = walkVelocity({ x: 0, y: 1 }, false);
    // The top of the screen is the view's heading: forward (-sin h, -cos h).
    expect(vx).toBeCloseTo(-Math.sin(VIEW.heading) * WALK.walkSpeed, 6);
    expect(vz).toBeCloseTo(-Math.cos(VIEW.heading) * WALK.walkSpeed, 6);
  });

  it('runs with Shift, and stands still with no input', () => {
    expect(Math.hypot(...walkVelocity({ x: 1, y: 0 }, true))).toBeCloseTo(WALK.runSpeed, 6);
    expect(walkVelocity({ x: 0, y: 0 }, false)).toEqual([0, 0]);
  });

  it('a diagonal key press walks no faster than a straight one', () => {
    expect(Math.hypot(...walkVelocity({ x: 1, y: 1 }, false))).toBeCloseTo(WALK.walkSpeed, 6);
  });
});

describe('the pond stops the walker', () => {
  const shore: [number, number] = [POND.center[0], POND.center[1] + POND.radiusZ + 1]; // dry, just south of the water
  const shallow: [number, number] = [POND.center[0], POND.center[1] + POND.radiusZ - 1];
  const deep: [number, number] = [POND.center[0], POND.center[1]];

  it('allows walking along dry ground and refuses a step onto the water', () => {
    expect(stepAllowed(shore, [shore[0] + 0.3, shore[1]])).toBe(true);
    expect(stepAllowed(shore, shallow)).toBe(false);
  });

  it('always lets the walker step out of the water, never further in', () => {
    expect(stepAllowed(deep, shallow)).toBe(true);
    expect(stepAllowed(shallow, shore)).toBe(true);
    expect(stepAllowed(shallow, deep)).toBe(false);
  });
});

describe('kicking a football on foot', () => {
  it('sends the ball along the walker’s motion, harder at a run', () => {
    const walk = kickImpulse([WALK.walkSpeed, 0], 2);
    const run = kickImpulse([WALK.runSpeed, 0], 2);
    expect(walk[0]).toBeGreaterThan(0);
    expect(Math.abs(walk[2])).toBeLessThan(1e-9);
    expect(walk[1]).toBeGreaterThan(0); // a little lift
    expect(run[0]).toBeGreaterThan(walk[0]);
  });

  it('a standing walker does not kick', () => {
    expect(kickImpulse([0, 0], 2)).toEqual([0, 0, 0]);
  });
});
