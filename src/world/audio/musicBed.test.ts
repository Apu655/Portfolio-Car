import { CHORDS, MELODY_NOTES, nextNoteDelay } from './musicBed';

const C_MAJOR = new Set([0, 2, 4, 5, 7, 9, 11]);

describe('ambient score', () => {
  it('stays in C major so chords and melody never clash', () => {
    for (const note of [...CHORDS.flat(), ...MELODY_NOTES]) expect(C_MAJOR.has(note % 12), String(note)).toBe(true);
  });

  it('keeps the melody sparse, and sparser at night', () => {
    expect(nextNoteDelay(0, 0)).toBeGreaterThanOrEqual(1.5);
    expect(nextNoteDelay(1, 0)).toBeLessThanOrEqual(6);
    expect(nextNoteDelay(0.5, 1)).toBeGreaterThan(nextNoteDelay(0.5, 0));
  });
});
