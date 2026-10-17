import { formatRoleDates, formatRoleDuration, formatYearMonth } from './format';

describe('role date formatting', () => {
  it('formats month and year, and null as Present', () => {
    expect(formatYearMonth('2022-04')).toBe('Apr 2022');
    expect(formatYearMonth(null)).toBe('Present');
    expect(formatRoleDates({ start: '2022-04', end: '2024-08' })).toBe('Apr 2022 – Aug 2024');
    expect(formatRoleDates({ start: '2024-09', end: null })).toBe('Sep 2024 – Present');
  });

  it('formats the career role as Nov 2023 – Jul 2026', () => {
    expect(formatRoleDates({ start: '2023-11', end: '2026-07' })).toBe('Nov 2023 – Jul 2026');
    expect(formatRoleDuration({ start: '2023-11', end: '2026-07' })).toBe('2 yrs 9 mos');
  });

  it('counts duration inclusively of both months', () => {
    expect(formatRoleDuration({ start: '2022-04', end: '2024-08' })).toBe('2 yrs 5 mos');
    expect(formatRoleDuration({ start: '2020-01', end: '2020-12' })).toBe('1 yr');
    expect(formatRoleDuration({ start: '2021-03', end: '2021-03' })).toBe('1 mo');
  });

  it('measures ongoing roles up to today', () => {
    expect(formatRoleDuration({ start: '2024-09', end: null }, new Date(2026, 9, 18))).toBe('2 yrs 2 mos');
  });
});
