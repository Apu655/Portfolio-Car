// The opening (R7): the camera starts high and wide over the district and settles onto the car, all in the fixed
// view. Any key, click, or tap ends it early (handled where the reveal state lives); reduced motion skips it.

export const REVEAL_SECONDS = 4.5;

const smooth = (t: number) => t * t * (3 - 2 * t);

/** 0 at the start of the opening, 1 once it has handed over to driving. */
export function arrivalBlend(seconds: number, reducedMotion: boolean): number {
  if (reducedMotion) return 1;
  return smooth(Math.min(1, Math.max(0, seconds / REVEAL_SECONDS)));
}
