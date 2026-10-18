import { VIEW } from '../district/layout';
import { STICK_DEADZONE, stickToDrive } from './screenSteer';

// Headings: 0 faces north and positive turns left; the top of the screen is VIEW.heading (north-east).
const UP_THE_SCREEN = VIEW.heading;

describe('screen-relative joystick', () => {
  it('drives straight when the car already faces where the stick points', () => {
    const d = stickToDrive({ x: 0, y: 1 }, UP_THE_SCREEN);
    expect(Math.abs(d.steer)).toBeLessThan(0.01);
    expect(d.throttle).toBeGreaterThan(0.9);
  });

  it('turns the car around without reversing when the stick points back down the screen (AE3)', () => {
    const d = stickToDrive({ x: 0, y: -1 }, UP_THE_SCREEN);
    expect(d.throttle).toBeGreaterThan(0);
    expect(Math.abs(d.steer)).toBe(1);
  });

  it('turns toward screen-right when the stick points right and the car faces up the screen', () => {
    // Turning right lowers the heading, which is negative steer.
    expect(stickToDrive({ x: 1, y: 0 }, UP_THE_SCREEN).steer).toBeLessThan(0);
    expect(stickToDrive({ x: -1, y: 0 }, UP_THE_SCREEN).steer).toBeGreaterThan(0);
  });

  it('does nothing inside the dead zone', () => {
    const d = stickToDrive({ x: STICK_DEADZONE * 0.5, y: 0 }, UP_THE_SCREEN);
    expect(d.throttle).toBe(0);
    expect(d.steer).toBe(0);
  });

  it('scales throttle with how far the stick is pushed', () => {
    const half = stickToDrive({ x: 0, y: 0.5 }, UP_THE_SCREEN).throttle;
    const full = stickToDrive({ x: 0, y: 1 }, UP_THE_SCREEN).throttle;
    expect(half).toBeLessThan(full);
    expect(half).toBeGreaterThan(0);
  });
});
