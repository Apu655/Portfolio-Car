import { useEffect } from 'react';
import { formatHash, parseHash } from './route';
import { usePortfolio } from './store';

/** Keeps the URL hash and the store in step, so every place in the portfolio has a shareable link. */
export function useHashSync(): void {
  useEffect(() => {
    const writeHash = () => {
      const { view, selection, historyMode, transition } = usePortfolio.getState();
      if (transition === 'leaving') return; // the view has not changed yet
      const hash = formatHash(view, selection);
      if (window.location.hash === hash) return;
      const url = `${window.location.pathname}${window.location.search}${hash}`;
      if (historyMode === 'push') window.history.pushState(null, '', url);
      else window.history.replaceState(null, '', url);
    };
    writeHash();
    const unsubscribe = usePortfolio.subscribe(writeHash);

    const onPopState = () => {
      const route = parseHash(window.location.hash);
      const state = usePortfolio.getState();
      state.applyRoute(route.view ?? state.view, route.selection);
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      unsubscribe();
      window.removeEventListener('popstate', onPopState);
    };
  }, []);
}
