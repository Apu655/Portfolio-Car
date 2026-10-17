import type { Selection } from '../state/route';
import { ZONES } from './district/layout';

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

/** One tag per stop (the Career Tower and the four kiosks), hovering over its entrance zone. */
export const WORLD_LABELS: WorldLabel[] = ZONES.map((zone) => ({
  id: zone.section,
  text: zone.name,
  position: [zone.center[0], 6.5, zone.center[1]],
  selection: { section: zone.section },
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
