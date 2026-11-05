// The background score (R15): the route theme from routeTheme.ts, generated in the browser so there is nothing
// to download. A soft square lead, a triangle walking bass and a thin pulse arpeggio play it through a gentle
// low-pass, a dotted-eighth echo and a small reverb. A lookahead scheduler queues one bar at a time on the
// audio clock, so the 32-bar loop wraps without a gap. Night softens the voices and slows the arpeggio.
import { BAR_SECONDS, barEvents, BEAT_SECONDS, nextBar, type Voice, voiceLevels } from './routeTheme';

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Seconds before a bar is due that it gets scheduled; larger than any frame gap. */
const LOOKAHEAD = 0.5;

/** A 25% pulse wave: thinner and softer than a square, the classic chiptune arpeggio colour. */
function pulseWave(ctx: AudioContext, duty: number): PeriodicWave {
  const harmonics = 24;
  const real = new Float32Array(harmonics);
  const imag = new Float32Array(harmonics);
  for (let n = 1; n < harmonics; n++) real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
  return ctx.createPeriodicWave(real, imag);
}

export class MusicBed {
  private readonly ctx: AudioContext;
  private readonly filter: BiquadFilterNode;
  private readonly dry: GainNode;
  private readonly send: GainNode;
  private readonly pulse: PeriodicWave;
  private nextBarAt: number;
  private bar = 0;

  constructor(ctx: AudioContext, out: AudioNode) {
    this.ctx = ctx;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 2600;
    this.filter.Q.value = 0.4;
    this.dry = ctx.createGain();
    this.dry.gain.value = 0.8;
    this.filter.connect(this.dry).connect(out);

    // Space: a dotted-eighth feedback echo and a short synthetic reverb, both fed from one send.
    this.send = ctx.createGain();
    this.send.gain.value = 0.3;
    this.filter.connect(this.send);
    const delay = ctx.createDelay(2);
    delay.delayTime.value = BEAT_SECONDS * 0.75;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.25;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2000;
    this.send.connect(delay).connect(tone).connect(feedback).connect(delay);
    tone.connect(out);
    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, 2.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.send.connect(reverb).connect(wet).connect(out);

    this.pulse = pulseWave(ctx, 0.25);
    this.nextBarAt = ctx.currentTime + 0.1;
  }

  /** Schedule the next bar when it is due soon; `night` (0..1) softens the voices and slows the arpeggio. */
  update(night: number): void {
    const now = this.ctx.currentTime;
    this.filter.frequency.setTargetAtTime(2600 - night * 1000, now, 2);
    if (this.nextBarAt >= now + LOOKAHEAD) return;
    // After a long stall (a hidden tab) start the bar now rather than in the past.
    const at = Math.max(now, this.nextBarAt);
    const levels = voiceLevels(night);
    for (const e of barEvents(this.bar, night))
      this.note(e.voice, e.midi, at + e.start * BEAT_SECONDS, e.beats * BEAT_SECONDS, levels[e.voice]);
    this.bar = nextBar(this.bar);
    this.nextBarAt = at + BAR_SECONDS;
  }

  /** One note with a soft envelope: a gentle attack, a slight settle, and a short release that never clicks. */
  private note(voice: Voice, midi: number, when: number, length: number, peak: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    if (voice === 'arp') osc.setPeriodicWave(this.pulse);
    else osc.type = voice === 'lead' ? 'square' : 'triangle';
    osc.frequency.value = midiHz(midi);
    const attack = voice === 'bass' ? 0.01 : 0.02;
    const hold = Math.max(attack + 0.02, length * (voice === 'lead' ? 0.92 : 0.8));
    const release = voice === 'lead' ? 0.18 : 0.08;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + attack);
    gain.gain.exponentialRampToValueAtTime(peak * 0.7, when + Math.min(hold, attack + 0.25));
    gain.gain.setValueAtTime(peak * 0.7, when + hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + hold + release);
    osc.connect(gain).connect(this.filter);
    osc.start(when);
    osc.stop(when + hold + release + 0.05);
  }
}

/** A decaying stereo noise burst, used as a small room's impulse response. */
function impulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
  }
  return buffer;
}
