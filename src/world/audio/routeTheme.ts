// The route theme (R15, KTD7): an original, relaxed 32-bar loop in D major at 92 BPM, written out as note data.
// Form: bars 1-16 are A A' B A'' (four-bar phrases); bars 17-32 vary the tune a little higher and turn around
// on the dominant so bar 32 leads straight back into bar 1. A square lead, a triangle walking bass and a thin
// pulse arpeggio play it (see musicBed.ts). Notes are MIDI numbers; durations are in beats; null is a rest.

export const BPM = 92;
export const BEATS_PER_BAR = 4;
export const LOOP_BARS = 32;
export const BEAT_SECONDS = 60 / BPM;
export const BAR_SECONDS = BEATS_PER_BAR * BEAT_SECONDS;
export const LOOP_SECONDS = LOOP_BARS * BAR_SECONDS;

export type Note = [midi: number | null, beats: number];
export type Chord = 'D' | 'Em' | 'F#m' | 'G' | 'A' | 'Bm';

/** One chord per bar: I-vi-IV-V and I-iii-IV-V shapes. */
// prettier-ignore
export const PROGRESSION: Chord[] = [
  'D', 'Bm', 'G', 'A',     'D', 'F#m', 'G', 'A',     // A, A'
  'G', 'A', 'F#m', 'Bm',   'D', 'G', 'A', 'D',       // B, A''
  'G', 'A', 'D', 'Bm',     'G', 'A', 'F#m', 'Bm',    // variation
  'Em', 'A', 'D', 'Bm',    'G', 'A', 'D', 'A',       // variation, turnaround
];

// prettier-ignore
export const MELODY: Note[][] = [
  // A
  [[66, 1], [69, 1], [74, 1.5], [73, 0.5]],
  [[71, 2], [69, 1], [66, 1]],
  [[67, 1], [71, 1], [74, 1], [71, 1]],
  [[69, 3], [null, 1]],
  // A'
  [[66, 1], [69, 1], [74, 1.5], [76, 0.5]],
  [[73, 2], [69, 1], [66, 1]],
  [[71, 1.5], [69, 0.5], [67, 1], [71, 1]],
  [[69, 1], [71, 0.5], [69, 0.5], [64, 2]],
  // B
  [[74, 1], [71, 1], [67, 2]],
  [[73, 1], [69, 1], [64, 2]],
  [[66, 0.5], [69, 0.5], [73, 1], [76, 1], [73, 1]],
  [[74, 1.5], [73, 0.5], [71, 2]],
  // A''
  [[66, 1], [69, 1], [74, 1.5], [73, 0.5]],
  [[71, 1], [74, 1], [71, 1], [67, 1]],
  [[69, 1.5], [71, 0.5], [73, 1], [76, 1]],
  [[74, 3], [null, 1]],
  // Variation
  [[74, 1], [76, 0.5], [74, 0.5], [71, 2]],
  [[73, 1], [76, 1], [69, 2]],
  [[78, 1.5], [76, 0.5], [74, 1], [69, 1]],
  [[71, 1], [74, 1], [73, 1], [71, 1]],
  [[67, 1], [71, 1], [74, 1], [76, 1]],
  [[76, 2], [73, 1], [69, 1]],
  [[69, 1], [73, 1], [66, 2]],
  [[71, 1], [69, 0.5], [71, 0.5], [74, 2]],
  [[76, 1], [71, 1], [67, 1], [71, 1]],
  [[69, 1], [73, 1], [76, 1.5], [74, 0.5]],
  [[74, 1], [78, 1], [76, 1], [74, 1]],
  [[71, 2], [74, 1], [71, 1]],
  [[67, 1], [71, 1], [74, 1], [76, 1]],
  [[73, 1.5], [71, 0.5], [69, 2]],
  [[66, 1], [69, 1], [74, 2]],
  [[73, 1], [69, 1], [64, 1], [null, 1]],
];

/** A walking bass in quarter notes: root, chord tones, then a step into the next bar's root. */
const walk = (...n: number[]): Note[] => n.map((m) => [m, 1]);
// prettier-ignore
export const BASS: Note[][] = [
  walk(38, 42, 45, 49), walk(47, 50, 49, 45), walk(43, 47, 50, 47), walk(45, 43, 42, 40),
  walk(38, 42, 45, 43), walk(42, 45, 49, 45), walk(43, 47, 50, 47), walk(45, 49, 47, 45),
  walk(43, 47, 50, 47), walk(45, 49, 47, 43), walk(42, 45, 47, 49), walk(47, 45, 42, 40),
  walk(38, 42, 45, 42), walk(43, 47, 50, 47), walk(45, 43, 42, 40), walk(38, 42, 45, 42),
  walk(43, 47, 50, 47), walk(45, 43, 42, 40), walk(38, 42, 45, 49), walk(47, 50, 49, 45),
  walk(43, 47, 50, 47), walk(45, 49, 47, 43), walk(42, 45, 47, 49), walk(47, 45, 43, 42),
  walk(40, 43, 47, 43), walk(45, 43, 42, 40), walk(38, 42, 45, 49), walk(47, 50, 49, 45),
  walk(43, 47, 50, 47), walk(45, 49, 47, 43), walk(38, 42, 45, 47), walk(45, 43, 42, 40),
];

/** Close voicings for the arpeggio, between the bass and the lead (low to high, the top an octave over the root). */
export const ARP_VOICINGS: Record<Chord, number[]> = {
  D: [62, 66, 69, 74],
  Em: [59, 64, 67, 71],
  'F#m': [61, 66, 69, 73],
  G: [59, 62, 67, 71],
  A: [57, 61, 64, 69],
  Bm: [59, 62, 66, 71],
};

/** Which voicing tone each arpeggio step plays: up and back down, eighths by day, quarters at night. */
const ARP_PATTERN_8 = [0, 1, 2, 3, 2, 1, 2, 1];
const ARP_PATTERN_4 = [0, 1, 2, 1];

/** Arpeggio steps per bar: eight by day, four (half the rate) once night is past halfway. */
export function arpStepsPerBar(night: number): number {
  return night > 0.5 ? 4 : 8;
}

/** Peak gain of each voice; night softens all three, the arpeggio most. */
export function voiceLevels(night: number): { lead: number; bass: number; arp: number } {
  const n = Math.min(1, Math.max(0, night));
  return { lead: 0.045 * (1 - 0.35 * n), bass: 0.11 * (1 - 0.3 * n), arp: 0.02 * (1 - 0.5 * n) };
}

export type Voice = 'lead' | 'bass' | 'arp';
export interface NoteEvent {
  voice: Voice;
  midi: number;
  /** Beats from the start of the bar. */
  start: number;
  beats: number;
}

/** Every note to play in a bar (0-based), with rests left out. */
export function barEvents(bar: number, night: number): NoteEvent[] {
  const events: NoteEvent[] = [];
  const line = (voice: Voice, notes: Note[]) => {
    let t = 0;
    for (const [midi, beats] of notes) {
      if (midi !== null) events.push({ voice, midi, start: t, beats });
      t += beats;
    }
  };
  line('lead', MELODY[bar]);
  line('bass', BASS[bar]);
  const steps = arpStepsPerBar(night);
  const pattern = steps === 4 ? ARP_PATTERN_4 : ARP_PATTERN_8;
  const voicing = ARP_VOICINGS[PROGRESSION[bar]];
  const step = BEATS_PER_BAR / steps;
  pattern.forEach((i, k) => events.push({ voice: 'arp', midi: voicing[i], start: k * step, beats: step }));
  return events;
}

/** The bar after `bar`, wrapping from the last back to the first. */
export function nextBar(bar: number): number {
  return (bar + 1) % LOOP_BARS;
}
