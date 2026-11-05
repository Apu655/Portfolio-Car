import { VIEW } from '../district/layout';
import { WALK, walkVelocity } from './walker';

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
