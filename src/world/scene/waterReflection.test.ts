import { reflectionStale } from './waterReflection';

describe('when the pond re-captures its reflection', () => {
  it('refreshes once the hour moves more than half an hour, and not before', () => {
    expect(reflectionStale(17.0, 17.4)).toBe(false);
    expect(reflectionStale(17.0, 17.6)).toBe(true);
    expect(reflectionStale(17.6, 17.0)).toBe(true); // the time slider can move backwards
  });

  it('counts across midnight the short way', () => {
    expect(reflectionStale(23.8, 0.1)).toBe(false);
    expect(reflectionStale(23.8, 0.4)).toBe(true);
  });

  it('captures the first time, before any reflection exists', () => {
    expect(reflectionStale(Number.NaN, 12)).toBe(true);
  });
});
