import { DayClock } from './dayClock';
import { localHours } from './timeOfDay';

/** `?time=21:30` starts the clock at another time (handy for previewing the night look). */
export function previewHours(search: string): number | null {
  const match = /[?&]time=(\d{1,2})(?::(\d{2}))?/.exec(search);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  return hours < 24 && minutes < 60 ? hours + minutes / 60 : null;
}

/** The one in-world clock shared by the lighting system, the ambience, and the HUD dial. */
export const dayClock = new DayClock(
  (typeof window !== 'undefined' && previewHours(window.location.search)) || localHours(new Date()),
  typeof performance !== 'undefined' ? performance.now() : 0,
);
