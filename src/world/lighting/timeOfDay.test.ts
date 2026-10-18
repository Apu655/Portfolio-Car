import { environmentStale, lightingAt, localHours } from './timeOfDay';

describe('lighting follows the local clock', () => {
  it('is night at 00:30, with lit windows and the sun out of the sky', () => {
    const l = lightingAt(0.5);
    expect(l.night).toBeGreaterThan(0.95);
    expect(l.sunIntensity).toBeLessThan(0.5);
  });

  it('is full daylight at 13:00 with the sun high', () => {
    const l = lightingAt(13);
    expect(l.night).toBe(0);
    expect(l.sunIntensity).toBeGreaterThan(lightingAt(7.5).sunIntensity);
    expect(l.sunIntensity).toBeGreaterThan(lightingAt(18.5).sunIntensity);
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

describe('blue hour', () => {
  it('sits between sunset and night: sky deep blue, lights coming up', () => {
    const sunset = lightingAt(18.5);
    const blue = lightingAt(19.1);
    const night = lightingAt(21);
    expect(blue.night).toBeGreaterThan(sunset.night);
    expect(blue.night).toBeLessThan(night.night);
    const [r, , b] = blue.skyTop;
    expect(b).toBeGreaterThan(r * 2);
  });
});

describe('the look-dev light (U1)', () => {
  const MOON = [-0.55, 0.62, -0.55];
  const toMoon = (d: [number, number, number]) => {
    const len = Math.hypot(...MOON);
    return (d[0] * MOON[0] + d[1] * MOON[1] + d[2] * MOON[2]) / len;
  };

  it('sets a low, warm sun in the west-south-west at golden hour', () => {
    const golden = lightingAt(18.2);
    const noon = lightingAt(13);
    expect(Math.asin(golden.sunDirection[1])).toBeLessThan((15 * Math.PI) / 180);
    // West (-x) and a little south (+z).
    expect(golden.sunDirection[0]).toBeLessThan(-0.8);
    expect(golden.sunDirection[2]).toBeGreaterThan(0.1);
    // Warmer: more red than blue, by more than at noon.
    const warmth = (c: [number, number, number]) => c[0] - c[2];
    expect(warmth(golden.sunColor)).toBeGreaterThan(warmth(noon.sunColor));
  });

  it('lights the night from the moon, with enough fill that the ground is not black', () => {
    const l = lightingAt(22);
    expect(l.night).toBe(1);
    expect(toMoon(l.sunDirection)).toBeGreaterThan(0.99);
    expect(l.hemisphereIntensity).toBeGreaterThanOrEqual(0.6);
  });

  it('holds the moonlit night from midnight until dawn', () => {
    for (const hour of [0.5, 3, 4.5]) {
      const l = lightingAt(hour);
      expect(l.night, `${hour}h`).toBeGreaterThanOrEqual(0.95);
      expect(toMoon(l.sunDirection), `${hour}h`).toBeGreaterThan(0.99);
    }
  });

  it('never snaps the key light: its direction turns smoothly through the day and the moon hand-off', () => {
    for (let minute = 0; minute < 24 * 60; minute++) {
      const a = lightingAt(minute / 60).sunDirection;
      const b = lightingAt((minute + 1) / 60).sunDirection;
      const angle = Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
      expect(angle, `${minute} min`).toBeLessThan(0.15);
    }
  });

  it('thins the fog at golden hour and thickens it a little at night', () => {
    expect(lightingAt(18.2).fogDensity).toBeLessThan(lightingAt(22).fogDensity);
    expect(lightingAt(13).fogDensity).toBeGreaterThan(0);
  });
});

describe('when the reflection environment refreshes', () => {
  it('refreshes after the hour moves more than 0.2, across midnight too, and not on smaller moves', () => {
    expect(environmentStale(18.0, 18.15)).toBe(false);
    expect(environmentStale(18.0, 18.25)).toBe(true);
    expect(environmentStale(23.9, 0.05)).toBe(false);
    expect(environmentStale(23.9, 0.2)).toBe(true);
  });
});
