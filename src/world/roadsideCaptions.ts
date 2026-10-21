// A sharp caption for the roadside billboards (R6, KTD7). The boards' own text reads from the default view, but a
// DOM card under the nearest one repeats it in crisp type and gives touch and keyboard users a button to open it.
// While the SeCAREly robot's bubble shows, the card steps aside: the first paper board stands close enough to the
// robot on screen for the two to cover each other.
import { create } from 'zustand';
import type { RoadsideBoard } from './roadside';

/** Cards appear within this distance (m) of a board. */
export const CAPTION_RANGE = 18;

/** Key of the board nearest (x, z) within `range`, or null. */
export function nearestBoard(boards: readonly RoadsideBoard[], x: number, z: number, range = CAPTION_RANGE): string | null {
  let best = range;
  let key: string | null = null;
  for (const b of boards) {
    const d = Math.hypot(b.position[0] - x, b.position[1] - z);
    if (d < best) {
      best = d;
      key = b.key;
    }
  }
  return key;
}

interface CaptionState {
  /** The nearest board within range. */
  board: string | null;
  /** Whether the robot's greeting bubble is showing. */
  bubble: boolean;
  /** What the robot just said after being bumped, while it shows. */
  quip: string | null;
  setNearest(board: string | null): void;
  setBubble(bubble: boolean): void;
  setQuip(quip: string | null): void;
}

export const useRoadsideCaption = create<CaptionState>((set, get) => ({
  board: null,
  bubble: false,
  quip: null,
  setNearest: (board) => {
    if (get().board !== board) set({ board });
  },
  setBubble: (bubble) => {
    if (get().bubble !== bubble) set({ bubble });
  },
  setQuip: (quip) => {
    if (get().quip !== quip) set({ quip });
  },
}));

/** The board whose card shows: the nearest one, unless the robot's bubble has the stage. */
export const shownBoard = (s: Pick<CaptionState, 'board' | 'bubble'>): string | null => (s.bubble ? null : s.board);

/** The caption card's element, positioned every frame by the scene. */
export const captionElement: { current: HTMLElement | null } = { current: null };

/** The robot's greeting bubble element, positioned every frame by the scene. */
export const bubbleElement: { current: HTMLElement | null } = { current: null };
