import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Selection } from '../state/route';
import { usePortfolio } from '../state/store';
import { NAV_MENU_ID } from './NavMenu';
import { PanelContent, panelTitle } from './PanelContent';

function PanelDialog({ selection }: { selection: Selection }) {
  const navToken = usePortfolio((s) => s.navToken);
  const closePanel = usePortfolio((s) => s.closePanel);
  const panel = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    body.current?.scrollTo?.({ top: 0 });
    if (usePortfolio.getState().focusPanel) heading.current?.focus();
  }, [navToken]);

  // If focus was inside the panel when it closes, hand it to the Menu button instead of losing it.
  useLayoutEffect(() => {
    const element = panel.current;
    return () => {
      if (!element?.contains(document.activeElement)) return;
      queueMicrotask(() => {
        if (element.isConnected) return; // not actually removed (e.g. React StrictMode re-running effects)
        document.querySelector<HTMLElement>(`[aria-controls="${NAV_MENU_ID}"]`)?.focus();
      });
    };
  }, []);

  return (
    <aside
      ref={panel}
      className="info-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="info-panel-title"
      data-keyboard-scope
    >
      <header className="info-panel__header">
        <h2 id="info-panel-title" ref={heading} tabIndex={-1}>
          {panelTitle(selection)}
        </h2>
        <button type="button" className="icon-button" aria-label="Close panel" onClick={closePanel}>
          ✕
        </button>
      </header>
      <div className="info-panel__body" ref={body}>
        <PanelContent selection={selection} />
      </div>
    </aside>
  );
}

/** Readable HTML panel for whatever the visitor opened in the 3D world. */
export function InfoPanel() {
  const selection = usePortfolio((s) => s.selection);
  const open = usePortfolio((s) => s.panelOpen);
  if (!open || !selection) return null;
  return <PanelDialog selection={selection} />;
}
