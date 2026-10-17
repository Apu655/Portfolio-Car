// One-shot voice budget (R23): at most `max` overlapping sounds, and each source waits out its cooldown
// before it can sound again. Pure bookkeeping in seconds, so it is tested without an audio context.

export const MAX_VOICES = 12;

export class VoiceLimiter {
  private ends: number[] = [];
  private lastBySource = new Map<string, number>();

  constructor(private readonly max = MAX_VOICES) {}

  /** Number of voices still sounding at `now`. */
  active(now: number): number {
    this.ends = this.ends.filter((end) => end > now);
    return this.ends.length;
  }

  /**
   * Claim a voice lasting `duration` seconds for `source`. Returns false (play nothing) when the source is
   * still cooling down or every voice is busy.
   */
  claim(source: string, now: number, duration: number, cooldown: number): boolean {
    const last = this.lastBySource.get(source);
    if (last !== undefined && now - last < cooldown) return false;
    if (this.active(now) >= this.max) return false;
    this.lastBySource.set(source, now);
    this.ends.push(now + duration);
    return true;
  }
}
