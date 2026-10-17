import { ambienceWeights } from './ambience';

describe('ambience crossfade', () => {
  const top = (h: number) => {
    const w = ambienceWeights(h);
    return (Object.keys(w) as (keyof typeof w)[]).reduce((a, b) => (w[a] >= w[b] ? a : b));
  };

  it('favors day at 13:00, dusk at 19:00, and night at 01:00', () => {
    expect(top(13)).toBe('day');
    expect(top(19)).toBe('dusk');
    expect(top(1)).toBe('night');
  });

  it('always sums to 1 and changes smoothly minute to minute', () => {
    let previous = ambienceWeights(0);
    for (let m = 1; m <= 24 * 60; m++) {
      const w = ambienceWeights(m / 60);
      expect(w.day + w.dusk + w.night).toBeCloseTo(1, 6);
      expect(Math.abs(w.day - previous.day)).toBeLessThan(0.05);
      expect(Math.abs(w.night - previous.night)).toBeLessThan(0.05);
      previous = w;
    }
  });
});
