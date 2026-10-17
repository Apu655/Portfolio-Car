// The APU ISLAM billboard's bulbs (KTD11): on load each letter "strikes" on unevenly for a few seconds, then the
// sign glows steadily with a rare, subtle flicker. Deterministic per seed; reduced motion means steady from t=0.
import { seededRandom } from '../../models/noise';

export const WARMUP_SECONDS = 2.6;

interface LetterScript {
  /** [time, on] toggles during warm-up, ending on. */
  toggles: Array<[number, boolean]>;
}

export class BillboardFlicker {
  private readonly letters: LetterScript[];
  private readonly random: () => number;
  private nextDip: number;
  private dipUntil = -1;
  private dipLetter = -1;

  constructor(
    letterCount: number,
    seed = 11,
    private readonly reducedMotion = false,
  ) {
    this.random = seededRandom(seed);
    this.letters = Array.from({ length: letterCount }, (_, i) => {
      const toggles: Array<[number, boolean]> = [];
      let t = 0.15 + i * 0.12 + this.random() * 0.4;
      const flickers = 2 + Math.floor(this.random() * 4);
      for (let k = 0; k < flickers; k++) {
        toggles.push([t, true]);
        t += 0.05 + this.random() * 0.18;
        toggles.push([t, false]);
        t += 0.04 + this.random() * 0.25;
      }
      toggles.push([Math.min(t, WARMUP_SECONDS - 0.05), true]);
      return { toggles };
    });
    this.nextDip = WARMUP_SECONDS + 20 + this.random() * 20;
  }

  /** Brightness 0..1 of each letter at `seconds` since the sign appeared. */
  brightness(seconds: number): number[] {
    if (this.reducedMotion) return this.letters.map(() => 1);
    if (seconds >= this.nextDip) {
      this.dipLetter = Math.floor(this.random() * this.letters.length);
      this.dipUntil = seconds + 0.08 + this.random() * 0.12;
      this.nextDip = seconds + 20 + this.random() * 20;
    }
    return this.letters.map((letter, i) => {
      if (seconds < WARMUP_SECONDS) {
        let on = false;
        for (const [t, state] of letter.toggles) if (t <= seconds) on = state;
        return on ? 1 : 0;
      }
      return i === this.dipLetter && seconds < this.dipUntil ? 0.35 : 1;
    });
  }

  /** Whether any letter is flickering right now (the audio layer hums while it does). */
  flickering(seconds: number): boolean {
    return !this.reducedMotion && (seconds < WARMUP_SECONDS || seconds < this.dipUntil);
  }
}
