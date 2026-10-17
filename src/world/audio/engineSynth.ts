// Continuous car sounds (R17, R18, R20): an engine whose pitch follows simulated gears, a reverse whine,
// tire roll, skid, wet hiss after the pond, and churning while in the water. Parameters glide every frame.
import type { Telemetry } from '../events';
import { noiseSource } from './synth';

/** Top speed (m/s) of each simulated gear; the engine climbs through a gear, then drops on the shift. */
const GEARS = [5.5, 11, 17, 23, 30];
const IDLE_HZ = 34;
const REDLINE_HZ = 128;
const GLIDE = 0.06;

/** 0..1 engine revs for the current speed: low at the bottom of each gear, high just before a shift. */
export function gearRevs(speed: number, throttle: number): number {
  const v = Math.abs(speed);
  let floor = 0;
  for (const top of GEARS) {
    if (v <= top) {
      const within = (v - floor) / (top - floor);
      return Math.min(1, 0.18 + within * 0.72 + Math.abs(throttle) * 0.1);
    }
    floor = top;
  }
  return Math.min(1, 0.9 + Math.abs(throttle) * 0.1);
}

export class EngineSynth {
  private readonly ctx: BaseAudioContext;
  private readonly oscillators: OscillatorNode[];
  private readonly engineFilter: BiquadFilterNode;
  private readonly engineGain: GainNode;
  private readonly burble: GainNode;
  private readonly burbleDepth: GainNode;
  private readonly whine: OscillatorNode;
  private readonly whineGain: GainNode;
  private readonly rollFilter: BiquadFilterNode;
  private readonly rollGain: GainNode;
  private readonly skidGain: GainNode;
  private readonly wetGain: GainNode;
  private readonly churnGain: GainNode;
  private readonly sources: AudioScheduledSourceNode[] = [];

  constructor(ctx: BaseAudioContext, out: AudioNode) {
    this.ctx = ctx;
    const now = ctx.currentTime;

    // Engine: two detuned saws and a sub, soft-clipped, then a lowpass that opens with load.
    const shaper = ctx.createWaveShaper();
    shaper.curve = softClip();
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.Q.value = 2.5;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.burble = ctx.createGain();
    this.burble.gain.value = 1;
    const mix = ctx.createGain();
    mix.gain.value = 0.35;
    this.oscillators = [
      this.osc('sawtooth', IDLE_HZ, 0, mix),
      this.osc('sawtooth', IDLE_HZ, 9, mix),
      this.osc('square', IDLE_HZ / 2, 0, mix, 0.6),
    ];
    mix.connect(shaper).connect(this.engineFilter).connect(this.burble).connect(this.engineGain).connect(out);
    // Idle burble: a slow wobble on the engine level.
    const lfo = ctx.createOscillator();
    this.burbleDepth = ctx.createGain();
    lfo.frequency.value = 7.5;
    this.burbleDepth.gain.value = 0.18;
    lfo.connect(this.burbleDepth).connect(this.burble.gain);
    lfo.start(now);
    this.sources.push(lfo);

    // Reverse gear whine.
    this.whineGain = ctx.createGain();
    this.whineGain.gain.value = 0;
    this.whine = this.osc('sine', 900, 0, this.whineGain);
    this.whineGain.connect(out);

    // Tires and water, all from looping noise.
    this.rollFilter = ctx.createBiquadFilter();
    this.rollFilter.type = 'lowpass';
    this.rollGain = this.noiseChain(out, this.rollFilter);
    const skidBand = ctx.createBiquadFilter();
    skidBand.type = 'bandpass';
    skidBand.frequency.value = 1500;
    skidBand.Q.value = 4;
    this.skidGain = this.noiseChain(out, skidBand);
    const wetBand = ctx.createBiquadFilter();
    wetBand.type = 'bandpass';
    wetBand.frequency.value = 3600;
    wetBand.Q.value = 0.7;
    this.wetGain = this.noiseChain(out, wetBand);
    const churnBand = ctx.createBiquadFilter();
    churnBand.type = 'lowpass';
    churnBand.frequency.value = 650;
    this.churnGain = this.noiseChain(out, churnBand);
  }

  private osc(type: OscillatorType, freq: number, detune: number, out: AudioNode, level = 1): OscillatorNode {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    if (level === 1) {
      osc.connect(out);
    } else {
      const gain = this.ctx.createGain();
      gain.gain.value = level;
      osc.connect(gain).connect(out);
    }
    osc.start(this.ctx.currentTime);
    this.sources.push(osc);
    return osc;
  }

  private noiseChain(out: AudioNode, filter: BiquadFilterNode): GainNode {
    const source = noiseSource(this.ctx, true);
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    source.connect(filter).connect(gain).connect(out);
    source.start(this.ctx.currentTime, Math.random() * 1.5);
    this.sources.push(source);
    return gain;
  }

  update(t: Telemetry): void {
    const now = this.ctx.currentTime;
    const glide = (param: AudioParam, value: number, time = GLIDE) => param.setTargetAtTime(value, now, time);
    const speed = Math.abs(t.speed);
    const throttle = Math.abs(t.throttle);
    const revs = gearRevs(t.speed, t.throttle);
    const hz = IDLE_HZ + (REDLINE_HZ - IDLE_HZ) * revs;
    glide(this.oscillators[0].frequency, hz);
    glide(this.oscillators[1].frequency, hz);
    glide(this.oscillators[2].frequency, hz / 2);
    glide(this.engineFilter.frequency, 380 + 2600 * (revs * 0.6 + throttle * 0.4));
    // Louder under load, quieter on overrun (lifting off at speed).
    glide(this.engineGain.gain, 0.12 + throttle * 0.16 + revs * 0.06, 0.1);
    glide(this.burbleDepth.gain, 0.18 * (1 - Math.min(1, speed / 6)), 0.2);

    glide(this.whineGain.gain, t.reversing ? Math.min(0.05, 0.015 + speed * 0.006) : 0, 0.08);
    glide(this.whine.frequency, 700 + speed * 120);

    const grounded = t.wheelsOnGround > 0 ? 1 : 0;
    glide(this.rollFilter.frequency, 180 + speed * 28);
    glide(this.rollGain.gain, grounded * Math.min(0.16, speed * 0.008), 0.1);
    const scrub = t.braking && speed > 4 ? 0.25 : 0;
    const skid = grounded * Math.min(1, t.slip + scrub) * Math.min(1, speed / 6);
    glide(this.skidGain.gain, (t.wet > 0 ? 0.08 : 0.22) * skid, 0.05);
    glide(this.wetGain.gain, t.wet > 0 && !t.inWater ? Math.min(0.12, speed * 0.01) * Math.min(1, t.wet) : 0, 0.15);
    glide(this.churnGain.gain, t.inWater ? 0.05 + Math.min(0.18, speed * 0.025) : 0, 0.12);
  }

  stop(): void {
    const when = this.ctx.currentTime + 0.05;
    this.sources.forEach((s) => s.stop(when));
  }
}

function softClip(): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(1024 * 4));
  for (let i = 0; i < 1024; i++) {
    const x = (i / 1023) * 2 - 1;
    curve[i] = Math.tanh(x * 2.2);
  }
  return curve;
}
