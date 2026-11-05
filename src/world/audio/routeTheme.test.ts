import {
  ARP_VOICINGS,
  arpStepsPerBar,
  BAR_SECONDS,
  barEvents,
  BASS,
  BEAT_SECONDS,
  BPM,
  LOOP_BARS,
  LOOP_SECONDS,
  MELODY,
  nextBar,
  PROGRESSION,
  voiceLevels,
} from './routeTheme';

// D major: D E F# G A B C#.
const D_MAJOR = new Set([2, 4, 6, 7, 9, 11, 1]);
const beats = (bar: [number | null, number][]) => bar.reduce((sum, [, d]) => sum + d, 0);

describe('the route theme', () => {
  it('is a 32-bar loop at about 92 BPM, and the bars add up to the loop length', () => {
    expect(LOOP_BARS).toBe(32);
    expect(BPM).toBeGreaterThanOrEqual(88);
    expect(BPM).toBeLessThanOrEqual(96);
    expect(MELODY).toHaveLength(32);
    expect(BASS).toHaveLength(32);
    expect(PROGRESSION).toHaveLength(32);
    for (const bar of [...MELODY, ...BASS]) expect(beats(bar)).toBeCloseTo(4, 9);
    expect(BAR_SECONDS).toBeCloseTo(4 * BEAT_SECONDS, 9);
    expect(LOOP_SECONDS).toBeCloseTo(32 * 4 * (60 / BPM), 9);
  });

  it('keeps every melody, bass and arpeggio note in D major', () => {
    const notes = [
      ...MELODY.flat().map(([n]) => n),
      ...BASS.flat().map(([n]) => n),
      ...Object.values(ARP_VOICINGS).flat(),
    ].filter((n): n is number => n !== null);
    for (const n of notes) expect(D_MAJOR.has(n % 12), String(n)).toBe(true);
    for (let bar = 0; bar < LOOP_BARS; bar++)
      for (const e of barEvents(bar, 0)) expect(D_MAJOR.has(e.midi % 12), `${e.voice} ${e.midi}`).toBe(true);
  });

  it('keeps the melody in a comfortable, singable range (E4 to F#5)', () => {
    const notes = MELODY.flat().map(([n]) => n).filter((n): n is number => n !== null);
    expect(Math.min(...notes)).toBeGreaterThanOrEqual(62);
    expect(Math.max(...notes)).toBeLessThanOrEqual(79);
    expect(Math.max(...notes) - Math.min(...notes)).toBeLessThanOrEqual(16);
  });

  it('begins phrases on the tonic chord and turns around on the dominant into the loop start', () => {
    expect(PROGRESSION[0]).toBe('D');
    expect(PROGRESSION[15]).toBe('D');
    expect(PROGRESSION[31]).toBe('A');
  });

  it('softens every voice at night and slows the arpeggio', () => {
    const day = voiceLevels(0);
    const night = voiceLevels(1);
    expect(night.lead).toBeLessThan(day.lead);
    expect(night.bass).toBeLessThan(day.bass);
    expect(night.arp).toBeLessThan(day.arp);
    expect(arpStepsPerBar(1)).toBeLessThan(arpStepsPerBar(0));
    const arps = (n: number) => barEvents(0, n).filter((e) => e.voice === 'arp').length;
    expect(arps(1)).toBeLessThan(arps(0));
  });

  it('wraps from the last bar to the first with no gap', () => {
    expect(nextBar(LOOP_BARS - 1)).toBe(0);
    expect(nextBar(5)).toBe(6);
    // Every voice in the last bar ends exactly on the bar line (or earlier, for a written rest),
    // and the bass and arpeggio play right up to it, so bar 1 follows straight on.
    const last = barEvents(LOOP_BARS - 1, 0);
    for (const e of last) expect(e.start + e.beats).toBeLessThanOrEqual(4 + 1e-9);
    for (const voice of ['bass', 'arp'] as const) {
      const end = Math.max(...last.filter((e) => e.voice === voice).map((e) => e.start + e.beats));
      expect(end).toBeCloseTo(4, 9);
    }
    expect(Math.min(...barEvents(0, 0).map((e) => e.start))).toBe(0);
  });
});
