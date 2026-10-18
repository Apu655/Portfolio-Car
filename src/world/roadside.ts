// What each roadside billboard shows (KTD4): the layout's slots paired in order with the section's showcase items.
// Research skips SeCAREly, which the robot carries; Contact's entries share one board.
import { SHOWCASE, type ShowcaseItem } from '../content/showcase';
import type { Selection } from '../state/route';
import { ROADSIDE_SLOTS, type Vec2 } from './district/layout';
import type { TowerSection } from './events';

export interface RoadsideBoard {
  /** Same key as the slot's collider and occluder. */
  key: string;
  section: TowerSection;
  position: Vec2;
  /** What the face and the caption card show. */
  item: ShowcaseItem;
  /** What a click on the board or its card opens. */
  selection: Selection;
  /** The Contact board lists every way to reach me. */
  entries?: ShowcaseItem[];
}

const CONTACT_ITEM: ShowcaseItem = {
  title: 'Contact',
  subtitle: SHOWCASE.contact.map((c) => c.title).join(' · '),
  line: 'Say hello — I read everything.',
};

/** The items a section's boards show, in slot order. */
export function boardItems(section: TowerSection): ShowcaseItem[] {
  return section === 'research' ? SHOWCASE.research.filter((i) => i.itemId !== 'secarely') : SHOWCASE[section];
}

export const ROADSIDE_BOARDS: RoadsideBoard[] = ROADSIDE_SLOTS.map((slot) => {
  if (slot.section === 'contact') {
    return { key: slot.key, section: slot.section, position: slot.position, item: CONTACT_ITEM, selection: { section: 'contact' }, entries: SHOWCASE.contact };
  }
  const item = boardItems(slot.section)[slot.index];
  const selection: Selection = item.itemId ? { section: slot.section, itemId: item.itemId } : { section: slot.section };
  return { key: slot.key, section: slot.section, position: slot.position, item, selection };
});

/** The board showing `selection`'s item, if one does. */
export function boardFor(selection: Selection | null): RoadsideBoard | undefined {
  if (!selection?.itemId) return undefined;
  return ROADSIDE_BOARDS.find((b) => b.selection.section === selection.section && b.selection.itemId === selection.itemId);
}
