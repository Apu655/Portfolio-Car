import { chooseTier, floorFpsFor, FrameRateMonitor, lowerTier } from './quality';

describe('quality tiers', () => {
  it('starts phones and software renderers on low, capable desktops on high', () => {
    expect(chooseTier({ coarsePointer: true })).toBe('low');
    expect(chooseTier({ coarsePointer: false, softwareRenderer: true })).toBe('low');
    expect(chooseTier({ coarsePointer: false, memoryGB: 8, cores: 8 })).toBe('high');
    expect(chooseTier({ coarsePointer: false, memoryGB: 2, cores: 8 })).toBe('medium');
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
