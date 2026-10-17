// The soundscape (KTD3, R17–R23). Nothing is created until the visitor's first click, tap, or key press;
// then one AudioContext feeds three buses (car, effects, ambience) through a master volume and a limiter.
// Physics and the scene never call audio directly: impacts, splashes, and zone changes arrive as events,
// and continuous sounds read the shared telemetry each frame.
import { BILLBOARD } from '../district/layout';
import { on, telemetry, type PropMaterial, type Vec3 } from '../events';
import { billboardState, lightingState } from '../lighting/state';
import { AmbienceBed } from './ambienceBed';
import { EngineSynth } from './engineSynth';
import { SampleBank } from './sampleBank';
import { useAudioSettings } from './settings';
import { impact, splash, uiSound, whoosh } from './synth';
import { VoiceLimiter } from './voiceLimiter';

export interface Listener {
  position: Vec3;
  /** Unit vector to the listener's right, for stereo placement. */
  right: Vec3;
}

export type UiSound = 'open' | 'close' | 'hover' | 'toggle' | 'zone';

const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const;
/** Distance (m) at which a sound is at half level. */
const HALF_DISTANCE = 14;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private car: GainNode | null = null;
  private effects: GainNode | null = null;
  private ambience: GainNode | null = null;
  private engine: EngineSynth | null = null;
  private bed: AmbienceBed | null = null;
  private hum: GainNode | null = null;
  private humSource: OscillatorNode | null = null;
  private readonly limiter = new VoiceLimiter();
  private readonly bank = new SampleBank();
  private listener: Listener = { position: [0, 0, 0], right: [1, 0, 0] };
  private resumeOnShow = false;

  constructor(private readonly createContext: () => AudioContext | null = () => new AudioContext()) {}

  /** Start listening for the unlocking gesture and for game events. Returns the teardown. */
  attach(): () => void {
    const unlock = () => this.unlock();
    GESTURES.forEach((g) => window.addEventListener(g, unlock, { capture: true }));
    const onVisibility = () => {
      const ctx = this.ctx;
      if (!ctx) return;
      if (document.hidden) {
        this.resumeOnShow = ctx.state === 'running';
        void ctx.suspend();
      } else if (this.resumeOnShow) {
        void ctx.resume().catch(() => undefined);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    const offs = [
      on('impact', (e) => this.impact(e.material, e.intensity, e.position, e.source)),
      on('splash', (e) => this.oneShot('splash', 0.18, e.position, 0.5 + e.intensity * 0.5, (out, when) => splash(this.ctx!, out, e.intensity, when))),
      on('waterEnter', (e) => {
        const intensity = Math.min(1, 0.3 + e.speed / 11);
        this.oneShot('waterEnter', 0.5, telemetry.position, 1, (out, when) => splash(this.ctx!, out, intensity, when));
      }),
      on('recover', () => this.oneShot('recover', 0.5, null, 0.8, (out, when) => whoosh(this.ctx!, out, when))),
      on('zoneEnter', () => this.ui('zone')),
      on('ui', (e) => this.ui(e.sound)),
    ];
    const unsubscribe = useAudioSettings.subscribe(() => this.applySettings());
    return () => {
      GESTURES.forEach((g) => window.removeEventListener(g, unlock, { capture: true }));
      document.removeEventListener('visibilitychange', onVisibility);
      offs.forEach((off) => off());
      unsubscribe();
      this.dispose();
    };
  }

  /** First gesture creates the context; later gestures resume it if the browser suspended it. */
  unlock(): void {
    if (!this.ctx) {
      let ctx: AudioContext | null = null;
      try {
        ctx = this.createContext();
      } catch {
        return; // no Web Audio: the site stays silent
      }
      if (!ctx) return;
      this.ctx = ctx;
      ctx.onstatechange = () => this.syncStatus();
      this.build(ctx);
    }
    if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => undefined);
    this.syncStatus();
  }

  private syncStatus(): void {
    if (!this.ctx) return;
    useAudioSettings.getState().setStatus(this.ctx.state === 'running' ? 'running' : 'suspended');
  }

  private build(ctx: AudioContext): void {
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -9;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    limiter.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(limiter);
    const bus = (level: number) => {
      const g = ctx.createGain();
      g.gain.value = level;
      g.connect(this.master!);
      return g;
    };
    this.car = bus(0.8);
    this.effects = bus(0.9);
    this.ambience = bus(0.75);
    this.engine = new EngineSynth(ctx, this.car);
    this.bed = new AmbienceBed(ctx, this.ambience);

    // The billboard's neon buzz while its letters flicker.
    const buzz = ctx.createOscillator();
    buzz.type = 'sawtooth';
    buzz.frequency.value = 120;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 240;
    band.Q.value = 3;
    this.hum = ctx.createGain();
    this.hum.gain.value = 0;
    buzz.connect(band).connect(this.hum).connect(this.effects);
    buzz.start();
    this.humSource = buzz;

    this.applySettings(true);
  }

  private applySettings(immediate = false): void {
    if (!this.ctx || !this.master) return;
    const { muted, volume } = useAudioSettings.getState();
    const target = muted ? 0 : volume;
    // Fade in on unlock so the first sound never pops.
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, immediate ? 0.15 : 0.05);
  }

  /** Called every frame with the camera as the listener. */
  update(listener: Listener): void {
    this.listener = listener;
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    this.engine?.update(telemetry);
    this.bed?.update(lightingState.hours);
    if (this.hum) {
      const [x, , z] = BILLBOARD.position;
      const d = Math.hypot(listener.position[0] - x, listener.position[2] - z);
      const level = billboardState.flickering ? 0.05 * attenuation(d) * (0.35 + Math.random() * 0.65) : 0;
      this.hum.gain.setTargetAtTime(level, ctx.currentTime, 0.02);
    }
  }

  private impact(material: PropMaterial, intensity: number, position: Vec3, source: string): void {
    const pick = this.bank.pick(material, intensity);
    this.oneShot(`impact:${source}`, 0.15, position, 0.35 + intensity * 0.65, (out, when) => impact(this.ctx!, out, pick.material, pick.tier, pick.variant, when), material === 'metal' ? 1.2 : 0.5);
  }

  ui(sound: UiSound): void {
    this.oneShot(`ui:${sound}`, 0.05, null, 1, (out, when) => uiSound(this.ctx!, out, sound, when), 0.3);
  }

  /**
   * Play one sound through the voice limiter: placed by distance and stereo direction from the listener
   * (or centered when `position` is null), skipped when inaudible, busy, or still cooling down.
   */
  private oneShot(source: string, cooldown: number, position: Vec3 | null, level: number, play: (out: AudioNode, when: number) => number, estimate = 0.6): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.effects) return;
    let gain = level;
    let pan = 0;
    if (position) {
      const dx = position[0] - this.listener.position[0];
      const dy = position[1] - this.listener.position[1];
      const dz = position[2] - this.listener.position[2];
      const d = Math.hypot(dx, dy, dz);
      gain *= attenuation(d);
      const r = this.listener.right;
      pan = d > 0.01 ? Math.max(-1, Math.min(1, (dx * r[0] + dy * r[1] + dz * r[2]) / d)) * 0.8 : 0;
    }
    if (gain < 0.02) return;
    if (!this.limiter.claim(source, ctx.currentTime, estimate, cooldown)) return;
    const voice = ctx.createGain();
    voice.gain.value = gain;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    voice.connect(panner).connect(this.effects);
    play(voice, ctx.currentTime);
  }

  private dispose(): void {
    this.engine?.stop();
    this.bed?.stop();
    this.humSource?.stop();
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.engine = null;
    this.bed = null;
    useAudioSettings.getState().setStatus('pending');
  }
}

function attenuation(distance: number): number {
  return 1 / (1 + Math.pow(distance / HALF_DISTANCE, 1.4));
}
