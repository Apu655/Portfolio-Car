import { lightingAt, localHours } from './timeOfDay';

describe('lighting follows the local clock', () => {
  it('is night at 00:30, with lit windows and the sun out of the sky', () => {
    const l = lightingAt(0.5);
    expect(l.night).toBeGreaterThan(0.95);
    expect(l.sunIntensity).toBeLessThan(0.5);
  });

  it('is full daylight at 13:00 with the sun high', () => {
    const l = lightingAt(13);
    expect(l.night).toBe(0);
    expect(l.sunIntensity).toBeGreaterThan(3);
    expect(l.sunDirection[1]).toBeGreaterThan(0.8);
  });

  it('is a dusk blend at 18:45', () => {
    const l = lightingAt(18.75);
    expect(l.night).toBeGreaterThan(0.3);
    expect(l.night).toBeLessThan(0.8);
  });

  it('changes so gradually that a visit never sees a jump', () => {
    for (let minute = 0; minute < 24 * 60; minute++) {
      const a = lightingAt(minute / 60);
      const b = lightingAt((minute + 1) / 60);
      expect(Math.abs(a.night - b.night)).toBeLessThan(0.02);
      expect(Math.abs(a.sunIntensity - b.sunIntensity)).toBeLessThan(0.05);
      expect(Math.abs(a.skyTop[2] - b.skyTop[2])).toBeLessThan(0.02);
    }
  });

  it('wraps midnight without a seam', () => {
    expect(lightingAt(24).night).toBeCloseTo(lightingAt(0).night, 5);
    expect(lightingAt(23.99).night).toBeCloseTo(lightingAt(0).night, 2);
  });

  it('reads hours from the device clock', () => {
    expect(localHours(new Date(2026, 9, 18, 18, 45, 0))).toBeCloseTo(18.75, 5);
  });
});
