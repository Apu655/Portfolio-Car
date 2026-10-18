import type { Role, YearMonth } from './portfolio';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A year-only date ("2026") counts as January for durations. */
export function parseYearMonth(value: YearMonth): { year: number; month: number } {
  const [year, month] = value.split('-').map(Number);
  return { year, month: month || 1 };
}

export function formatYearMonth(value: YearMonth | null): string {
  if (value === null) return 'Present';
  if (!value.includes('-')) return value;
  const { year, month } = parseYearMonth(value);
  return `${MONTHS[month - 1]} ${year}`;
}

/** "Apr 2022 – Aug 2024" */
export function formatRoleDates(role: Pick<Role, 'start' | 'end'>): string {
  return `${formatYearMonth(role.start)} – ${formatYearMonth(role.end)}`;
}

/** "2 yrs 5 mos", counting both the start and end month. */
export function formatRoleDuration(role: Pick<Role, 'start' | 'end'>, now: Date = new Date()): string {
  const start = parseYearMonth(role.start);
  const end = role.end ? parseYearMonth(role.end) : { year: now.getFullYear(), month: now.getMonth() + 1 };
  const totalMonths = Math.max(1, (end.year - start.year) * 12 + (end.month - start.month) + 1);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'yr' : 'yrs'}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'mo' : 'mos'}`);
  return parts.join(' ');
}
