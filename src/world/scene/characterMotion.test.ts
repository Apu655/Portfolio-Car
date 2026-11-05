import { WALK } from '../physics/walker';
import { characterPose, MAX_SWING, stride, type CharacterPoseInput } from './characterMotion';

const base: CharacterPoseInput = { speed: 0, phase: Math.PI / 2, time: 1.3, reducedMotion: false, stepIn: null };
const pose = (extra: Partial<CharacterPoseInput> = {}) => characterPose({ ...base, ...extra });

describe('character motion', () => {
  it('stands still with no limb swing, breathing gently', () => {
    const standing = pose();
    expect([standing.legL, standing.legR, standing.armL, standing.armR]).toEqual([0, -0, -0, 0]);
    expect(Math.abs(standing.bob)).toBeLessThan(0.02);
    expect(standing.lean).toBe(0);
  });

  it('swings the legs in turn, harder the faster it goes, with the arms against them', () => {
    const walk = pose({ speed: WALK.walkSpeed });
    const run = pose({ speed: WALK.runSpeed });
    expect(walk.legL).toBeGreaterThan(0.3);
    expect(walk.legR).toBeCloseTo(-walk.legL, 6);
    expect(run.legL).toBeGreaterThan(walk.legL);
    expect(run.legL).toBeCloseTo(MAX_SWING, 6);
    expect(Math.sign(walk.armL)).toBe(-Math.sign(walk.legL));
    // Half a stride later the legs have swapped.
    expect(pose({ speed: WALK.walkSpeed, phase: -Math.PI / 2 }).legL).toBeCloseTo(-walk.legL, 6);
  });

  it('leans into a run and bobs as it walks', () => {
    expect(pose({ speed: WALK.runSpeed }).lean).toBeGreaterThan(pose({ speed: WALK.walkSpeed }).lean);
    expect(pose({ speed: WALK.walkSpeed }).bob).toBeGreaterThan(0.01);
  });

  it('keeps the legs moving under reduced motion, without the bob or lean', () => {
    const still = pose({ speed: WALK.walkSpeed, reducedMotion: true });
    expect(still.legL).toBeGreaterThan(0.3);
    expect(still.bob).toBe(0);
    expect(still.lean).toBe(0);
  });

  it('lifts a foot and reaches forward while stepping into the car, and settles by the end', () => {
    const mid = pose({ stepIn: 0.5 });
    expect(mid.legR).toBeGreaterThan(0.5);
    expect(mid.armR).toBeGreaterThan(0.3);
    expect(pose({ stepIn: 1 }).legR).toBeCloseTo(0, 6);
  });

  it('takes longer strides at a run, so the step rate rises less than the speed', () => {
    const rate = (speed: number) => stride(0, speed, 0.01) / 0.01;
    expect(rate(0)).toBe(0);
    expect(rate(WALK.runSpeed) / rate(WALK.walkSpeed)).toBeLessThan(WALK.runSpeed / WALK.walkSpeed);
    expect(rate(WALK.runSpeed)).toBeGreaterThan(rate(WALK.walkSpeed));
  });
});
