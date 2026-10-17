import { MAX_VOICES, VoiceLimiter } from './voiceLimiter';

describe('voice limiter (AE2)', () => {
  it('ten cones hit within 300 ms plus other sounds never exceed 12 voices', () => {
    const limiter = new VoiceLimiter();
    let started = 0;
    for (let i = 0; i < 10; i++) if (limiter.claim(`cone-${i}`, i * 0.03, 0.6, 0.15)) started++;
    for (let i = 0; i < 10; i++) if (limiter.claim(`crate-${i}`, 0.3 + i * 0.01, 0.8, 0.15)) started++;
    expect(started).toBe(MAX_VOICES);
    expect(limiter.active(0.4)).toBeLessThanOrEqual(MAX_VOICES);
  });

  it('plays the same prop once within its cooldown, and again after it', () => {
    const limiter = new VoiceLimiter();
    expect(limiter.claim('cone-1', 0, 0.3, 0.15)).toBe(true);
    expect(limiter.claim('cone-1', 0.1, 0.3, 0.15)).toBe(false);
    expect(limiter.claim('cone-1', 0.2, 0.3, 0.15)).toBe(true);
  });

  it('frees voices as they finish', () => {
    const limiter = new VoiceLimiter(2);
    expect(limiter.claim('a', 0, 0.5, 0)).toBe(true);
    expect(limiter.claim('b', 0, 0.5, 0)).toBe(true);
    expect(limiter.claim('c', 0.2, 0.5, 0)).toBe(false);
    expect(limiter.claim('c', 0.6, 0.5, 0)).toBe(true);
  });
});
