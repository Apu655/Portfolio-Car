import { create } from 'zustand';
import { sameSelection, type Selection, type View } from './route';

/** Length of each half of the view switch (fade out, then fade in). */
export const VIEW_TRANSITION_MS = 450;

export type TransitionPhase = 'idle' | 'leaving' | 'entering';

export interface PortfolioState {
  view: View;
  selection: Selection | null;
  /** 3D view only: whether the info panel for `selection` is showing. */
  panelOpen: boolean;
  menuOpen: boolean;
  notice: string | null;
  webglAvailable: boolean;
  reducedMotion: boolean;
  transition: TransitionPhase;
  /** Increments on every navigation request so views can react (fly there, scroll there) even to repeats. */
  navToken: number;
  /** How the URL should record the latest change. */
  historyMode: 'push' | 'replace';
  /** Set when a keyboard/menu navigation should move focus into the info panel. */
  focusPanel: boolean;
  /** Label id of the world object under the pointer, if any. */
  hovered: string | null;

  init(options: { view: View; selection: Selection | null; notice: string | null; webglAvailable: boolean; reducedMotion: boolean }): void;
  navigate(selection: Selection | null, options?: { focusPanel?: boolean }): void;
  /** Update "where you are" without moving anything — used when the basic view scrolls. */
  syncSelection(selection: Selection | null): void;
  closePanel(): void;
  setMenuOpen(open: boolean): void;
  switchView(view: View): void;
  /** Apply a URL change from the browser's back/forward buttons. */
  applyRoute(view: View, selection: Selection | null): void;
  dismissNotice(): void;
  setHovered(id: string | null): void;
}

let transitionTimer: ReturnType<typeof setTimeout> | undefined;

export const usePortfolio = create<PortfolioState>()((set, get) => ({
  view: '3d',
  selection: null,
  panelOpen: false,
  menuOpen: false,
  notice: null,
  webglAvailable: true,
  reducedMotion: false,
  transition: 'idle',
  navToken: 0,
  historyMode: 'replace',
  focusPanel: false,
  hovered: null,

  init: ({ view, selection, notice, webglAvailable, reducedMotion }) =>
    set({
      view,
      selection,
      notice,
      webglAvailable,
      reducedMotion,
      panelOpen: selection !== null,
      menuOpen: false,
      transition: 'idle',
      navToken: get().navToken + 1,
      historyMode: 'replace',
    }),

  navigate: (selection, options) =>
    set((s) => ({
      selection,
      panelOpen: selection !== null,
      menuOpen: false,
      navToken: s.navToken + 1,
      historyMode: 'push',
      focusPanel: options?.focusPanel ?? false,
    })),

  syncSelection: (selection) => {
    if (sameSelection(get().selection, selection)) return;
    set({ selection, historyMode: 'replace' });
  },

  closePanel: () => set({ panelOpen: false, selection: null, historyMode: 'push' }),

  setMenuOpen: (menuOpen) => set(menuOpen ? { menuOpen, focusPanel: false } : { menuOpen }),

  switchView: (view) => {
    const state = get();
    if (state.view === view && state.transition === 'idle') return;
    if (view === '3d' && !state.webglAvailable) {
      set({ notice: 'The 3D world needs WebGL, which this browser doesn’t provide.' });
      return;
    }
    clearTimeout(transitionTimer);
    const arrive = () =>
      set((s) => ({
        view,
        menuOpen: false,
        panelOpen: s.selection !== null,
        navToken: s.navToken + 1,
        historyMode: 'push',
      }));
    if (state.reducedMotion) {
      arrive();
      set({ transition: 'idle' });
      return;
    }
    set({ transition: 'leaving', menuOpen: false });
    transitionTimer = setTimeout(() => {
      arrive();
      set({ transition: 'entering' });
      transitionTimer = setTimeout(() => set({ transition: 'idle' }), VIEW_TRANSITION_MS);
    }, VIEW_TRANSITION_MS);
  },

  // One atomic update, no animation: the URL already says where we are, so the state must match it at once
  // (an intermediate state would be written back to history and break Back/Forward).
  applyRoute: (view, selection) => {
    const state = get();
    const targetView = view === '3d' && !state.webglAvailable ? 'basic' : view;
    if (targetView === state.view && sameSelection(state.selection, selection)) return;
    clearTimeout(transitionTimer);
    set((s) => ({
      view: targetView,
      selection,
      panelOpen: selection !== null,
      menuOpen: false,
      transition: 'idle',
      navToken: s.navToken + 1,
      historyMode: 'replace',
    }));
  },

  dismissNotice: () => set({ notice: null }),

  setHovered: (hovered) => {
    if (get().hovered !== hovered) set({ hovered });
  },
}));
