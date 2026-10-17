import { roles } from '../content/portfolio';
import { parseYearMonth } from '../content/format';
import { TOWER } from '../models/tower';
import type { Selection } from '../state/route';
import type { Vec3 } from './flight/flightModel';
import { STATION_POSITIONS, TOWER_LAYOUT, TOWER_POSITION } from './layout';

/** A floating name tag over something selectable in the world. */
export interface WorldLabel {
  id: string;
  text: string;
  position: Vec3;
  selection: Selection;
  /** Shown at all times (landmarks); otherwise only on hover or while open. */
  always: boolean;
  /** Highlight only for this exact selection, not for anything else in its section. */
  exact: boolean;
}

const station = (section: keyof typeof STATION_POSITIONS, text: string, height: number): WorldLabel => {
  const [x, y, z] = STATION_POSITIONS[section];
  return { id: section, text, position: [x, y + height, z], selection: { section }, always: true, exact: false };
};

export const WORLD_LABELS: WorldLabel[] = [
  station('about', 'About me', 13),
  station('research', 'Research Observatory', 17),
  station('projects', 'Projects Shipyard', 12),
  station('contact', 'Contact Beacon', 25),
  {
    id: 'experience',
    text: 'Career Tower · Experience',
    position: [TOWER_POSITION[0], TOWER_LAYOUT.height + 4, TOWER_POSITION[2]],
    selection: { section: 'experience' },
    always: true,
    exact: true,
  },
  ...roles.map(
    (role, i): WorldLabel => ({
      id: `experience/${role.id}`,
      text: `${role.title} · ${parseYearMonth(role.start).year}`,
      position: [TOWER_POSITION[0], TOWER_LAYOUT.floorCenters[i], TOWER_POSITION[2] + TOWER.shaftWidth / 2 + 3],
      selection: { section: 'experience', itemId: role.id },
      always: false,
      exact: true,
    }),
  ),
];

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
