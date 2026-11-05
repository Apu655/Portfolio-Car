import { CAR_GROUPS, THROWN_GROUPS, WALKER_BLOCKER_GROUPS, WALKER_GROUPS, WALKER_QUERY_GROUPS, WHEEL_RAY_GROUPS } from './groups';

/** Rapier's rule: two groups interact when each one's membership is in the other's filter. */
const interact = (a: number, b: number) => ((a >>> 16) & (b & 0xffff)) !== 0 && ((b >>> 16) & (a & 0xffff)) !== 0;
const DEFAULT = 0xffffffff | 0;

describe('collision groups for walking', () => {
  it('the car’s body and wheels never touch the walker or its blockers', () => {
    for (const g of [WALKER_GROUPS, WALKER_BLOCKER_GROUPS]) {
      expect(interact(CAR_GROUPS, g)).toBe(false);
      expect(interact(WHEEL_RAY_GROUPS, g)).toBe(false);
    }
  });

  it('the walker’s movement is stopped by the city and by its own blockers, not by thrown copies', () => {
    expect(interact(WALKER_QUERY_GROUPS, DEFAULT)).toBe(true);
    expect(interact(WALKER_QUERY_GROUPS, WALKER_BLOCKER_GROUPS)).toBe(true);
    expect(interact(WALKER_QUERY_GROUPS, THROWN_GROUPS)).toBe(false);
  });

  it('the car still drives into everything else', () => {
    expect(interact(CAR_GROUPS, DEFAULT)).toBe(true);
  });
});
