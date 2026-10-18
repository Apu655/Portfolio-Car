// The pond's reflection (KTD7 of the golden-hour city plan): a cube snapshot of its surroundings, taken once the
// city has loaded and again whenever the light has moved on, rather than re-rendered every frame.

/** Hours the in-world clock may move before the snapshot no longer matches the light. */
const REFRESH_HOURS = 0.5;

/** Whether a snapshot taken at `captured` hours is out of date at `now` (NaN: none taken yet). */
export function reflectionStale(captured: number, now: number): boolean {
  if (Number.isNaN(captured)) return true;
  const d = Math.abs(now - captured) % 24;
  return Math.min(d, 24 - d) > REFRESH_HOURS;
}
