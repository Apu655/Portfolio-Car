import { SampleBank, tierFor, VARIANTS } from './sampleBank';

describe('impact sample choice', () => {
  it('a light plastic tap picks a quiet variant; a hard wood hit picks a crash', () => {
    const bank = new SampleBank();
    expect(bank.pick('plastic', 0.1).tier).toBe('tap');
    expect(bank.pick('wood', 0.9).tier).toBe('crash');
    expect(tierFor(0.5)).toBe('knock');
  });

  it('rotates variations so consecutive hits differ', () => {
    const bank = new SampleBank();
    const picks = Array.from({ length: VARIANTS + 1 }, () => bank.pick('brick', 0.5).variant);
    for (let i = 1; i < picks.length; i++) expect(picks[i]).not.toBe(picks[i - 1]);
    expect(picks[VARIANTS]).toBe(picks[0]);
  });
});
