import { Component, lazy, Suspense, useEffect, type ReactNode } from 'react';
import { BasicSite } from './basic/BasicSite';
import { usePortfolio } from './state/store';
import { useHashSync } from './state/useHashSync';
import { Hud } from './ui/Hud';
import { InfoPanel } from './ui/InfoPanel';
import { NoticeBanner, ViewTransition, WorldLoading } from './ui/Overlays';

const World3D = lazy(() => import('./world/World3D'));

/** If the 3D world fails to start (e.g. WebGL context creation fails), fall back to the quick view. */
class WorldErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('3D world failed to start', error);
    usePortfolio.setState({
      view: 'basic',
      webglAvailable: false,
      notice: 'The 3D world couldn’t start on this device, so you’re seeing the quick view.',
    });
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Esc closes the menu first, then the info panel; M toggles the menu (3D view only). */
function useGlobalShortcuts(): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const state = usePortfolio.getState();
      if (state.view !== '3d') return;
      if (event.key === 'Escape') {
        if (state.menuOpen) state.setMenuOpen(false);
        else if (state.panelOpen) state.closePanel();
        return;
      }
      const target = event.target as Element | null;
      const typing = target?.closest?.('input, textarea, select, [contenteditable="true"]');
      if ((event.key === 'm' || event.key === 'M') && !typing && !event.metaKey && !event.ctrlKey) {
        state.setMenuOpen(!state.menuOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function App() {
  useHashSync();
  useGlobalShortcuts();
  const view = usePortfolio((s) => s.view);
  const switchView = usePortfolio((s) => s.switchView);

  return (
    <>
      {view === '3d' ? (
        <>
          <button type="button" className="skip-link" onClick={() => switchView('basic')}>
            Skip to the quick text view
          </button>
          <WorldErrorBoundary>
            <Suspense fallback={<WorldLoading />}>
              <World3D />
            </Suspense>
          </WorldErrorBoundary>
          <Hud />
          <InfoPanel />
        </>
      ) : (
        <BasicSite />
      )}
      <NoticeBanner />
      <ViewTransition />
    </>
  );
}
