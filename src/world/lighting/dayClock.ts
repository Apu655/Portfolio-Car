// The in-world clock (KTD6): starts at the visitor's local time and runs a full day in about 12 real minutes.
// Pausing holds the time; scrubbing jumps to any time and leaves the running/paused state unchanged.

/** In-world hours that pass per real second: 24 h per 12 min = 2 h per minute. */
export const HOURS_PER_SECOND = 24 / (12 * 60);

export class DayClock {
  private baseHours: number;
  private baseMs: number;
  private pausedFlag = false;

  constructor(startHours: number, nowMs: number) {
    this.baseHours = wrap(startHours);
    this.baseMs = nowMs;
  }

  hours(nowMs: number): number {
    if (this.pausedFlag) return this.baseHours;
    return wrap(this.baseHours + ((nowMs - this.baseMs) / 1000) * HOURS_PER_SECOND);
  }

  get paused(): boolean {
    return this.pausedFlag;
  }

  setPaused(paused: boolean, nowMs: number): void {
    if (paused === this.pausedFlag) return;
    this.baseHours = this.hours(nowMs);
    this.baseMs = nowMs;
    this.pausedFlag = paused;
  }

  scrub(hours: number, nowMs: number): void {
    this.baseHours = wrap(hours);
    this.baseMs = nowMs;
  }
}

function wrap(hours: number): number {
  return ((hours % 24) + 24) % 24;
}

/** "18:40" */
export function formatClock(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
