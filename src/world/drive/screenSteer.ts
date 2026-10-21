// The touch joystick is screen-relative (R11, KTD7 of the isometric camera plan): pushing it points where the car
// should go on screen. This turns that into the car-relative throttle and steer the vehicle already understands,
// so physics and the keyboard path stay unchanged.
import { VIEW } from '../district/layout';
import type { DriveInput } from './input';

/** Stick travel (0..1) below which a resting thumb does nothing. */
export const STICK_DEADZONE = 0.15;
/** Heading error (radians) at which steering reaches full lock. */
const FULL_LOCK_ERROR = 0.6;

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * `stick` is screen space: x right, y up, each in -1..1. `carHeading` uses the layout convention (0 = north,
 * positive turns left). The car always drives forward; pointing behind it turns it around at full lock.
 */
export function stickToDrive(stick: { x: number; y: number }, carHeading: number, viewHeading: number = VIEW.heading): Omit<DriveInput, 'boost'> {
  const push = Math.min(1, Math.hypot(stick.x, stick.y));
  if (push < STICK_DEADZONE) return { throttle: 0, steer: 0, handbrake: false };
  // Screen up is the view heading; screen right is a right turn from it.
  const wanted = viewHeading + Math.atan2(-stick.x, stick.y);
  const error = wrap(wanted - carHeading);
  const steer = Math.max(-1, Math.min(1, error / FULL_LOCK_ERROR));
  // Ease off while swinging round so the turn stays tight, without ever stopping.
  const throttle = push * (0.4 + 0.6 * Math.max(0, Math.cos(error)));
  return { throttle, steer, handbrake: false };
}
