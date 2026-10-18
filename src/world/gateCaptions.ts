// Readable captions for the gate screens. The screens' own text is legible only up close, so when the car nears
// a gate, a small DOM card under it repeats the items its two screens show, in sharp text. The scene
// publishes which gate is nearest and what its screens show; the DOM layer renders the cards; the projector
// pins it under the gate each frame.
import { create } from 'zustand';
import type { ShowcaseItem } from '../content/showcase';
import type { TowerSection } from './events';

/** Captions appear within this distance (m) of a gate. */
export const CAPTION_RANGE = 30;

interface CaptionState {
  section: TowerSection | null;
  items: [ShowcaseItem | null, ShowcaseItem | null];
  /** What every gate's screens show right now, so a newly nearest gate can be captioned at once. */
  shown: Partial<Record<TowerSection, [ShowcaseItem | null, ShowcaseItem | null]>>;
  publish(section: TowerSection, items: [ShowcaseItem | null, ShowcaseItem | null]): void;
  setNearest(section: TowerSection | null): void;
}

export const useGateCaptions = create<CaptionState>((set, get) => ({
  section: null,
  items: [null, null],
  shown: {},
  publish: (section, items) => {
    const shown = { ...get().shown, [section]: items };
    set(get().section === section ? { shown, items } : { shown });
  },
  setNearest: (section) => {
    if (get().section === section) return;
    set({ section, items: section ? (get().shown[section] ?? [null, null]) : [null, null] });
  },
}));

/** The caption card's element, positioned every frame by the scene. */
export const captionElement: { current: HTMLElement | null } = { current: null };
