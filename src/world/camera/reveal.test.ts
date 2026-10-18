import { arrivalBlend, REVEAL_SECONDS } from './reveal';

describe('arrival timing', () => {
  it('runs from 0 to 1 over the reveal time, easing in and out', () => {
    expect(arrivalBlend(0, false)).toBe(0);
    expect(arrivalBlend(REVEAL_SECONDS, false)).toBe(1);
    expect(arrivalBlend(REVEAL_SECONDS * 2, false)).toBe(1);
    expect(arrivalBlend(REVEAL_SECONDS * 0.1, false)).toBeLessThan(0.1);
  });

  it('is already complete with reduced motion (R15)', () => {
    expect(arrivalBlend(0, true)).toBe(1);
  });
});
