import { chooseTier, floorFpsFor, FrameRateMonitor, lowerTier, TIER_SETTINGS } from './quality';

describe('quality tiers', () => {
  it('starts phones and software renderers on low, capable desktops on high', () => {
    expect(chooseTier({ coarsePointer: true })).toBe('low');
    expect(chooseTier({ coarsePointer: false, softwareRenderer: true })).toBe('low');
    expect(chooseTier({ coarsePointer: false, memoryGB: 8, cores: 8 })).toBe('high');
    expect(chooseTier({ coarsePointer: false, memoryGB: 2, cores: 8 })).toBe('medium');
    expect(chooseTier({ coarsePointer: false, memoryGB: 8, cores: 2 })).toBe('medium');
    expect(chooseTier({ coarsePointer: true, memoryGB: 8, cores: 8 })).toBe('low');
  });

  it('caps the resolution scale at 1.5, 1.25 and 1 (KTD10)', () => {
    expect(TIER_SETTINGS.high.dpr[1]).toBe(1.5);
    expect(TIER_SETTINGS.medium.dpr[1]).toBe(1.25);
    expect(TIER_SETTINGS.low.dpr[1]).toBe(1);
  });

  it('keeps bloom on every tier, at half resolution and softer on low, and shadows off only on low', () => {
    for (const tier of ['high', 'medium', 'low'] as const) expect(TIER_SETTINGS[tier].bloomIntensity).toBeGreaterThan(0);
    expect(TIER_SETTINGS.high.bloomScale).toBe(1);
    expect(TIER_SETTINGS.medium.bloomScale).toBe(1);
    expect(TIER_SETTINGS.low.bloomScale).toBe(0.5);
    expect(TIER_SETTINGS.low.bloomIntensity).toBeLessThan(TIER_SETTINGS.high.bloomIntensity);
    expect([TIER_SETTINGS.high.shadowMapSize, TIER_SETTINGS.medium.shadowMapSize]).toEqual([2048, 1024]);
    expect([TIER_SETTINGS.high.shadows, TIER_SETTINGS.medium.shadows, TIER_SETTINGS.low.shadows]).toEqual([true, true, false]);
  });

  it('drops one tier at a time and never below low', () => {
    expect(lowerTier('high')).toBe('medium');
    expect(lowerTier('medium')).toBe('low');
    expect(lowerTier('low')).toBe('low');
  });

  it('drops only after 3 s below the floor, not on a short hitch', () => {
    const monitor = new FrameRateMonitor(floorFpsFor(false), 3);
    let dropped = false;
    for (let i = 0; i < 60; i++) dropped ||= monitor.frame(1 / 30); // 2 s at 30 fps
    for (let i = 0; i < 60; i++) dropped ||= monitor.frame(1 / 60); // recovers
    expect(dropped).toBe(false);
    for (let i = 0; i < 100; i++) dropped ||= monitor.frame(1 / 30); // 3.3 s at 30 fps
    expect(dropped).toBe(true);
  });

  it('uses a 55 fps floor on desktop and 26 fps on touch devices', () => {
    expect(floorFpsFor(false)).toBe(55);
    expect(floorFpsFor(true)).toBe(26);
  });
});
