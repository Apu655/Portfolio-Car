import type { Selection } from '../state/route';
import { TOWERS } from './city/cityLayout';

/** A floating name tag over something selectable in the world. */
export interface WorldLabel {
  id: string;
  text: string;
  position: [number, number, number];
  selection: Selection;
  /** Shown at all times (landmarks); otherwise only on hover or while open. */
  always: boolean;
  /** Highlight only for this exact selection, not for anything else in its section. */
  exact: boolean;
}

/** One tag per landmark, hovering over its entrance zone at the curb. */
export const WORLD_LABELS: WorldLabel[] = TOWERS.map((t) => ({
  id: t.section,
  text: t.name,
  position: [t.entrance[0] + t.outward[0] * 4, 9, t.entrance[1] + t.outward[1] * 4],
  selection: { section: t.section },
  always: true,
  exact: false,
}));

export function labelIdFor(selection: Selection): string {
  return selection.itemId ? `${selection.section}/${selection.itemId}` : selection.section;
}

/** Whether a label's target is what the open panel shows. */
export function isLabelActive(label: Pick<WorldLabel, 'selection' | 'exact'>, open: Selection | null): boolean {
  if (!open || open.section !== label.selection.section) return false;
  return !label.exact || open.itemId === label.selection.itemId;
}

/** Label elements rendered by the DOM layer, positioned every frame by the scene. */
export const labelElements = new Map<string, HTMLElement>();
