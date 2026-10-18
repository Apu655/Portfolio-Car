import { GREET_HIDE, GREET_SHOW, HEAD_LIMIT, robotPose } from './robotMotion';

const base = { facing: Math.PI, time: 1.3, inZone: false, reducedMotion: false, greeting: false };
/** The robot at the origin facing south; the car at (x, z). */
const at = (x: number, z: number, extra: Partial<typeof base> = {}) => robotPose({ ...base, ...extra, toCar: [x, z] });

describe('robot motion', () => {
  it('greets within about 14 m, keeps greeting to 16 m, and stops beyond, so the bubble never flickers', () => {
    expect(GREET_SHOW).toBeLessThan(GREET_HIDE);
    expect(at(0, 13).greeting).toBe(true);
    expect(at(0, 15, { greeting: true }).greeting).toBe(true);
    expect(at(0, 15, { greeting: false }).greeting).toBe(false);
    expect(at(0, 17, { greeting: true }).greeting).toBe(false);
  });

  it('turns its head toward the car, within its neck limit', () => {
    // Car straight ahead (south): no turn.
    expect(at(0, 10).headYaw).toBeCloseTo(0, 5);
    // Car to the south-east: ahead and to the robot's left (it faces south, so east is its left).
    const yaw = at(10, 10).headYaw;
    expect(yaw).toBeCloseTo(Math.PI / 4, 5);
    // Car behind it (north): clamped.
    expect(Math.abs(at(1, -10).headYaw)).toBeCloseTo(HEAD_LIMIT, 5);
  });

  it('waves only while the car is in its zone', () => {
    expect(at(0, 5, { inZone: true }).armAngle).toBeGreaterThan(0.4);
    expect(at(0, 5, { inZone: false }).armAngle).toBe(0);
  });

  it('holds still with reduced motion, but still greets', () => {
    const pose = at(6, 6, { inZone: true, reducedMotion: true });
    expect(pose.bob).toBe(0);
    expect(pose.armAngle).toBe(0);
    expect(pose.headYaw).toBe(0);
    expect(pose.greeting).toBe(true);
  });

  it('bobs gently while idle', () => {
    const heights = [0, 0.5, 1, 1.5, 2].map((time) => at(0, 30, { time }).bob);
    expect(Math.max(...heights.map(Math.abs))).toBeLessThan(0.15);
    expect(new Set(heights.map((h) => h.toFixed(3))).size).toBeGreaterThan(1);
  });
});
