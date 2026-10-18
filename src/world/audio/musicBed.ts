// A soft ambient score generated in the browser (R14): slow pad chords with sparse pentatonic notes floating over
// them, through a gentle delay and reverb. Copyright-free by construction and nothing to download. It never
// repeats exactly: the chord cycle is fixed, but the melody notes and their timing are chosen afresh each time.

/** Seconds each chord holds. */
export const CHORD_SECONDS = 9.6;

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** A calm cycle in C major: Cmaj9, Am9, Fmaj7, G6sus (MIDI notes, low to high). */
export const CHORDS: number[][] = [
  [48, 55, 64, 71, 74],
  [45, 52, 60, 67, 71],
  [41, 53, 57, 64, 72],
  [43, 50, 59, 64, 69],
];

/** The C major pentatonic notes the melody picks from (one octave above the pads). */
export const MELODY_NOTES = [72, 74, 76, 79, 81, 84];

/** Seconds until the next melody note: sparse by day, sparser at night. */
export function nextNoteDelay(random: number, night: number): number {
  return (1.8 + random * 3.2) * (1 + night * 0.6);
}

const LOOKAHEAD = 0.5;

export class MusicBed {
  private readonly ctx: AudioContext;
  private readonly filter: BiquadFilterNode;
  private readonly dry: GainNode;
  private readonly send: GainNode;
  private nextChordAt: number;
  private chord = 0;
  private nextNoteAt: number;

  constructor(ctx: AudioContext, out: AudioNode) {
    this.ctx = ctx;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 1400;
    this.filter.Q.value = 0.4;
    this.dry = ctx.createGain();
    this.dry.gain.value = 0.7;
    this.filter.connect(this.dry).connect(out);

    // Space: a feedback delay and a short synthetic reverb, both fed from one send.
    this.send = ctx.createGain();
    this.send.gain.value = 0.45;
    this.filter.connect(this.send);
    const delay = ctx.createDelay(2);
    delay.delayTime.value = 0.42;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.32;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2200;
    this.send.connect(delay).connect(tone).connect(feedback).connect(delay);
    tone.connect(out);
    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, 3.2);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    this.send.connect(reverb).connect(wet).connect(out);

    const now = ctx.currentTime;
    this.nextChordAt = now + 0.1;
    this.nextNoteAt = now + 3;
  }

  /** Schedule what is due soon; `night` (0..1) darkens and slows the music. */
  update(night: number): void {
    const now = this.ctx.currentTime;
    this.filter.frequency.setTargetAtTime(1400 - night * 600, now, 2);
    if (this.nextChordAt < now + LOOKAHEAD) {
      const at = Math.max(now, this.nextChordAt);
      this.pad(CHORDS[this.chord], at);
      this.chord = (this.chord + 1) % CHORDS.length;
      this.nextChordAt = at + CHORD_SECONDS;
    }
    if (this.nextNoteAt < now + LOOKAHEAD) {
      const at = Math.max(now, this.nextNoteAt);
      this.pluck(MELODY_NOTES[Math.floor(Math.random() * MELODY_NOTES.length)], at, 1 - night * 0.4);
      this.nextNoteAt = at + nextNoteDelay(Math.random(), night);
    }
  }

  /** A chord that swells in over a few seconds and fades as the next one arrives. */
  private pad(notes: number[], when: number): void {
    const hold = CHORD_SECONDS + 3;
    notes.forEach((note, i) => {
      for (const [type, detune] of [['triangle', -6], ['sine', 5]] as const) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = midiHz(note);
        osc.detune.value = detune;
        const peak = (i === 0 ? 0.05 : 0.032) * (type === 'sine' ? 0.8 : 1);
        gain.gain.setValueAtTime(0, when);
        gain.gain.linearRampToValueAtTime(peak, when + 3.5);
        gain.gain.setValueAtTime(peak, when + CHORD_SECONDS - 0.5);
        gain.gain.linearRampToValueAtTime(0, when + hold);
        osc.connect(gain).connect(this.filter);
        osc.start(when);
        osc.stop(when + hold + 0.1);
      }
    });
  }

  /** A soft bell-like note: quick attack, long fade. */
  private pluck(note: number, when: number, level: number): void {
    const osc = this.ctx.createOscillator();
    const overtone = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.value = midiHz(note);
    overtone.frequency.value = midiHz(note + 12);
    const overtoneGain = this.ctx.createGain();
    overtoneGain.gain.value = 0.18;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.045 * level, when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 2.8);
    osc.connect(gain);
    overtone.connect(overtoneGain).connect(gain);
    gain.connect(this.filter);
    for (const o of [osc, overtone]) {
      o.start(when);
      o.stop(when + 3);
    }
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
