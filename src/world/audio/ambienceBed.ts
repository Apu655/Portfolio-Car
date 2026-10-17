// The environment's sound (R21): wind and birdsong by day, a distant city hum at dusk, crickets and a quieter
// city at night, crossfaded by `ambienceWeights`. Birds and crickets are scheduled calls at random intervals,
// so the beds never loop audibly.
import { ambienceWeights } from './ambience';
import { noiseSource } from './synth';

const LOOKAHEAD = 0.25;

export class AmbienceBed {
  private readonly ctx: BaseAudioContext;
  private readonly out: AudioNode;
  private readonly windGain: GainNode;
  private readonly cityGain: GainNode;
  private readonly sources: AudioScheduledSourceNode[] = [];
  private nextBird = 0;
  private nextCricket = [0, 0];

  constructor(ctx: BaseAudioContext, out: AudioNode) {
    this.ctx = ctx;
    this.out = out;

    // Wind: lowpassed noise whose cutoff drifts slowly.
    const wind = noiseSource(ctx, true);
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 420;
    windFilter.Q.value = 0.6;
    const drift = ctx.createOscillator();
    const driftDepth = ctx.createGain();
    drift.frequency.value = 0.07;
    driftDepth.gain.value = 260;
    drift.connect(driftDepth).connect(windFilter.frequency);
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    wind.connect(windFilter).connect(this.windGain).connect(out);

    // Distant city: a low rumble plus a faint mains hum.
    const city = noiseSource(ctx, true);
    const cityFilter = ctx.createBiquadFilter();
    cityFilter.type = 'lowpass';
    cityFilter.frequency.value = 160;
    this.cityGain = ctx.createGain();
    this.cityGain.gain.value = 0;
    city.connect(cityFilter).connect(this.cityGain).connect(out);
    const hum = ctx.createOscillator();
    const humLevel = ctx.createGain();
    hum.frequency.value = 55;
    humLevel.gain.value = 0.12;
    hum.connect(humLevel).connect(this.cityGain);

    const now = ctx.currentTime;
    for (const s of [wind, drift, city, hum]) {
      s.start(now);
      this.sources.push(s);
    }
    this.nextBird = now + 1;
    this.nextCricket = [now + 0.5, now + 0.8];
  }

  update(hours: number): void {
    const now = this.ctx.currentTime;
    const w = ambienceWeights(hours);
    this.windGain.gain.setTargetAtTime(0.05 * w.day + 0.035 * w.dusk + 0.02 * w.night, now, 1.5);
    this.cityGain.gain.setTargetAtTime(0.03 * w.day + 0.09 * w.dusk + 0.04 * w.night, now, 1.5);

    if (w.day > 0.05 && this.nextBird < now + LOOKAHEAD) {
      this.bird(Math.max(now, this.nextBird), w.day);
      this.nextBird += 1.8 + Math.random() * 4.5;
    } else if (this.nextBird < now) {
      this.nextBird = now + 1;
    }
    this.nextCricket.forEach((at, i) => {
      if (w.night > 0.05 && at < now + LOOKAHEAD) {
        this.cricket(Math.max(now, at), w.night, i);
        this.nextCricket[i] = Math.max(now, at) + 0.55 + Math.random() * 0.9;
      } else if (at < now) {
        this.nextCricket[i] = now + 0.5;
      }
    });
  }

  /** A short phrase of two to five rising chirps, placed somewhere left or right. */
  private bird(when: number, level: number): void {
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(this.out);
    const base = 2300 + Math.random() * 1400;
    const notes = 2 + Math.floor(Math.random() * 4);
    for (let n = 0; n < notes; n++) {
      const at = when + n * (0.09 + Math.random() * 0.06);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.2), at);
      osc.frequency.exponentialRampToValueAtTime(base * 1.45, at + 0.07);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.018 * level, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.08);
      osc.connect(gain).connect(pan);
      osc.start(at);
      osc.stop(at + 0.1);
    }
  }

  /** A cricket chirp: three or four rapid pulses of a high tone. */
  private cricket(when: number, level: number, which: number): void {
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = which === 0 ? -0.55 : 0.6;
    pan.connect(this.out);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.value = which === 0 ? 4300 : 4750;
    gain.gain.value = 0;
    const pulses = 3 + (Math.random() < 0.4 ? 1 : 0);
    for (let p = 0; p < pulses; p++) {
      const at = when + p * 0.045;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.012 * level, at + 0.008);
      gain.gain.linearRampToValueAtTime(0, at + 0.03);
    }
    osc.connect(gain).connect(pan);
    osc.start(when);
    osc.stop(when + pulses * 0.045 + 0.05);
  }

  stop(): void {
    const when = this.ctx.currentTime + 0.05;
    this.sources.forEach((s) => s.stop(when));
  }
}
