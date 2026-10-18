import { pageCount, screenItem, PAGE_SECONDS } from './gateScreens';

describe('gate screen cycling', () => {
  it('shows every item across the pages, two at a time', () => {
    for (const n of [1, 2, 4, 7, 9]) {
      const seen = new Set<number>();
      for (let page = 0; page < pageCount(n); page++) for (const screen of [0, 1] as const) {
        const i = screenItem(n, page, screen);
        if (i >= 0) seen.add(i);
      }
      expect(seen.size, `${n} items`).toBe(n);
    }
  });

  it('leaves the second screen for the "see all" card when the count is odd', () => {
    expect(screenItem(7, 3, 0)).toBe(6);
    expect(screenItem(7, 3, 1)).toBe(-1);
  });

  it('turns pages every few seconds and wraps around', () => {
    expect(PAGE_SECONDS).toBeGreaterThanOrEqual(5);
    expect(screenItem(4, 2, 0)).toBe(screenItem(4, 0, 0));
  });
});
