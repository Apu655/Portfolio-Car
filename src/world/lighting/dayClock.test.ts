import { DayClock, formatClock } from './dayClock';
import { lightingAt } from './timeOfDay';

describe('day clock', () => {
  it('Covers AE6: started at 17:10, it reads 18:40 after 45 real seconds', () => {
    const clock = new DayClock(17 + 10 / 60, 0);
    expect(formatClock(clock.hours(45_000))).toBe('18:40');
  });

  it('pausing holds the time; resuming continues from it', () => {
    const clock = new DayClock(12, 0);
    clock.setPaused(true, 30_000); // 13:00
    expect(clock.hours(300_000)).toBeCloseTo(13, 5);
    clock.setPaused(false, 300_000);
    expect(clock.hours(330_000)).toBeCloseTo(14, 5);
  });

  it('scrubbing jumps straight to the chosen time and keeps the running state', () => {
    const running = new DayClock(12, 0);
    running.scrub(23, 10_000);
    expect(running.hours(10_000)).toBeCloseTo(23, 5);
    expect(lightingAt(running.hours(10_000)).night).toBeGreaterThan(0.95);
    expect(running.hours(40_000)).toBeCloseTo(0, 5); // still running, wrapped past midnight
    const paused = new DayClock(12, 0);
    paused.setPaused(true, 0);
    paused.scrub(6, 5_000);
    expect(paused.hours(60_000)).toBeCloseTo(6, 5);
    expect(paused.paused).toBe(true);
  });
});
