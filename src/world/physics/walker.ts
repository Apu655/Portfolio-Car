// Walking on foot (KTD2 of the walking character plan): input is screen-relative, as the touch joystick is for the
// car, so pushing up walks toward the top of the screen. Pure, so speeds and directions are testable here.
import { VIEW } from '../district/layout';

export const WALK = {
  walkSpeed: 3.2,
  runSpeed: 6,
  /** Capsule radius and the height of its straight middle (m): about 1.5 m tall in all. */
  radius: 0.35,
  halfHeight: 0.4,
} as const;

/** Ground velocity (x, z) for a screen-space push (`x` right, `y` up, each -1..1), walking or running. */
export function walkVelocity(stick: { x: number; y: number }, run: boolean): [number, number] {
  const push = Math.min(1, Math.hypot(stick.x, stick.y));
  if (push < 0.05) return [0, 0];
  const heading = VIEW.heading + Math.atan2(-stick.x, stick.y);
  const speed = push * (run ? WALK.runSpeed : WALK.walkSpeed);
  return [-Math.sin(heading) * speed, -Math.cos(heading) * speed];
}
