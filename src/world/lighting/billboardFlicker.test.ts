import { BillboardFlicker, WARMUP_SECONDS } from './billboardFlicker';

describe('billboard flicker', () => {
  it('Covers AE5: with reduced motion every letter is fully lit from the start', () => {
    const sign = new BillboardFlicker(8, 11, true);
    expect(sign.brightness(0)).toEqual(Array(8).fill(1));
    expect(sign.flickering(0.5)).toBe(false);
  });

  it('letters strike on unevenly during warm-up, then all reach steady light by 3 s', () => {
    const sign = new BillboardFlicker(8, 11);
    const samples = Array.from({ length: 26 }, (_, i) => sign.brightness(i * 0.1));
    expect(samples.some((s) => s.some((b) => b === 0) && s.some((b) => b === 1))).toBe(true); // uneven
    expect(sign.brightness(3)).toEqual(Array(8).fill(1));
    expect(sign.flickering(1)).toBe(true);
    expect(sign.flickering(WARMUP_SECONDS + 1)).toBe(false);
  });

  it('is deterministic per seed', () => {
    const a = new BillboardFlicker(8, 42);
    const b = new BillboardFlicker(8, 42);
    for (let t = 0; t < 3; t += 0.05) expect(a.brightness(t)).toEqual(b.brightness(t));
  });

  it('after warm-up, dips are rare, brief, and partial', () => {
    const sign = new BillboardFlicker(8, 5);
    let dimFrames = 0;
    let frames = 0;
    for (let t = WARMUP_SECONDS; t < 120; t += 1 / 30) {
      const b = sign.brightness(t);
      frames++;
      if (b.some((x) => x < 1)) {
        dimFrames++;
        expect(Math.min(...b)).toBeGreaterThan(0.3);
      }
    }
    expect(dimFrames).toBeGreaterThan(0);
    expect(dimFrames / frames).toBeLessThan(0.02);
  });
});
