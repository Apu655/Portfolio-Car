// Synthesized one-shot sounds (R19–R21). Every voice is built from oscillators and a shared noise buffer,
// shaped per material and loudness tier, and returns how long it rings so the voice limiter can count it.
import type { PropMaterial } from '../events';
import type { ImpactTier } from './sampleBank';

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

/** Two seconds of white noise, shared by every noisy sound. */
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buffer);
  }
  return buffer;
}

export function noiseSource(ctx: BaseAudioContext, loop = false): AudioBufferSourceNode {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  source.loop = loop;
  return source;
}

/** A random start offset into the noise buffer, leaving room for the longest one-shot. */
function grain(): number {
  return Math.random() * 0.6;
}

/** Exponential-ish envelope: quick attack to `peak`, decay to silence over `decay` seconds. */
function envelope(gain: AudioParam, when: number, peak: number, decay: number, attack = 0.004) {
  gain.setValueAtTime(0.0001, when);
  gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), when + attack);
  gain.exponentialRampToValueAtTime(0.0001, when + attack + decay);
}

function tone(ctx: BaseAudioContext, out: AudioNode, when: number, type: OscillatorType, freq: number, peak: number, decay: number, glideTo?: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, when + decay);
  envelope(gain.gain, when, peak, decay);
  osc.connect(gain).connect(out);
  osc.start(when);
  osc.stop(when + decay + 0.05);
}

function noiseBurst(ctx: BaseAudioContext, out: AudioNode, when: number, filter: BiquadFilterType, freq: number, q: number, peak: number, decay: number) {
  const source = noiseSource(ctx);
  const band = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  band.type = filter;
  band.frequency.value = freq;
  band.Q.value = q;
  envelope(gain.gain, when, peak, decay, 0.002);
  source.connect(band).connect(gain).connect(out);
  source.start(when, grain());
  source.stop(when + decay + 0.05);
}

interface MaterialVoice {
  /** Resonant partials of the object's body (Hz). */
  partials: number[];
  wave: OscillatorType;
  ring: number;
  noise: { type: BiquadFilterType; freq: number; q: number; decay: number };
}

const MATERIALS: Record<PropMaterial, MaterialVoice> = {
  plastic: { partials: [340, 910], wave: 'triangle', ring: 0.09, noise: { type: 'bandpass', freq: 1800, q: 1.2, decay: 0.06 } },
  wood: { partials: [190, 470, 830], wave: 'triangle', ring: 0.16, noise: { type: 'lowpass', freq: 1400, q: 0.7, decay: 0.09 } },
  metal: { partials: [420, 1137, 2210, 3390], wave: 'sine', ring: 0.9, noise: { type: 'highpass', freq: 2500, q: 0.7, decay: 0.05 } },
  brick: { partials: [105, 260], wave: 'sine', ring: 0.12, noise: { type: 'bandpass', freq: 900, q: 0.8, decay: 0.22 } },
  stone: { partials: [140, 390], wave: 'sine', ring: 0.1, noise: { type: 'bandpass', freq: 1200, q: 0.9, decay: 0.16 } },
};

const TIER = {
  tap: { gain: 0.22, decay: 0.7, grains: 0 },
  knock: { gain: 0.5, decay: 1, grains: 1 },
  crash: { gain: 0.85, decay: 1.4, grains: 4 },
} as const;

const DETUNE = [1, 0.91, 1.08];

/** An impact on `material`. Returns the seconds it rings. */
export function impact(ctx: BaseAudioContext, out: AudioNode, material: PropMaterial, tier: ImpactTier, variant: number, when: number): number {
  const voice = MATERIALS[material];
  const t = TIER[tier];
  const pitch = DETUNE[variant % DETUNE.length];
  const ring = voice.ring * t.decay * (0.9 + variant * 0.08);
  voice.partials.forEach((f, i) => tone(ctx, out, when, voice.wave, f * pitch, (t.gain * 0.5) / (i + 1), ring / (1 + i * 0.4), f * pitch * 0.97));
  noiseBurst(ctx, out, when, voice.noise.type, voice.noise.freq * pitch, voice.noise.q, t.gain * 0.4, voice.noise.decay * t.decay);
  // Crashes scatter extra debris grains just after the hit (bricks tumbling, crate slats rattling).
  for (let g = 0; g < t.grains; g++) {
    const at = when + 0.04 + Math.random() * 0.25;
    noiseBurst(ctx, out, at, 'bandpass', voice.noise.freq * (0.6 + Math.random() * 0.8), 1.5, t.gain * 0.16, 0.05 + Math.random() * 0.08);
  }
  return Math.max(ring, voice.noise.decay * t.decay) + (t.grains ? 0.35 : 0.05);
}

/** Water splash: a hiss that brightens then settles, over a short "bloop". */
export function splash(ctx: BaseAudioContext, out: AudioNode, intensity: number, when: number): number {
  const decay = 0.25 + intensity * 0.65;
  const source = noiseSource(ctx);
  const band = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  band.type = 'bandpass';
  band.Q.value = 0.9;
  band.frequency.setValueAtTime(700, when);
  band.frequency.exponentialRampToValueAtTime(2600 + intensity * 1500, when + 0.06);
  band.frequency.exponentialRampToValueAtTime(900, when + decay);
  envelope(gain.gain, when, 0.15 + intensity * 0.45, decay, 0.01);
  source.connect(band).connect(gain).connect(out);
  source.start(when, grain());
  source.stop(when + decay + 0.05);
  tone(ctx, out, when, 'sine', 220 - intensity * 60, 0.12 + intensity * 0.2, 0.12 + intensity * 0.1, 80);
  return decay;
}

/** Small interface sounds: soft and short. */
export function uiSound(ctx: BaseAudioContext, out: AudioNode, kind: 'open' | 'close' | 'hover' | 'toggle' | 'zone', when: number): number {
  switch (kind) {
    case 'open':
      tone(ctx, out, when, 'sine', 660, 0.08, 0.12);
      tone(ctx, out, when + 0.07, 'sine', 990, 0.07, 0.18);
      return 0.3;
    case 'close':
      tone(ctx, out, when, 'sine', 880, 0.07, 0.1);
      tone(ctx, out, when + 0.06, 'sine', 587, 0.06, 0.16);
      return 0.25;
    case 'zone':
      tone(ctx, out, when, 'triangle', 523, 0.06, 0.25);
      tone(ctx, out, when + 0.09, 'triangle', 784, 0.05, 0.35);
      return 0.45;
    case 'hover':
      tone(ctx, out, when, 'sine', 1400, 0.025, 0.04);
      return 0.06;
    case 'toggle':
      tone(ctx, out, when, 'triangle', 520, 0.06, 0.07);
      return 0.1;
  }
}

/** Recover: a quick whoosh as the car is set back on its wheels. */
export function whoosh(ctx: BaseAudioContext, out: AudioNode, when: number): number {
  const source = noiseSource(ctx);
  const band = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  band.type = 'bandpass';
  band.Q.value = 2;
  band.frequency.setValueAtTime(400, when);
  band.frequency.exponentialRampToValueAtTime(2200, when + 0.35);
  envelope(gain.gain, when, 0.2, 0.4, 0.12);
  source.connect(band).connect(gain).connect(out);
  source.start(when, grain());
  source.stop(when + 0.6);
  return 0.55;
}
