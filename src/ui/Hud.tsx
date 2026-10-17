import { useEffect, useRef, useState } from 'react';
import { profile } from '../content/portfolio';
import { usePortfolio } from '../state/store';
import { NAV_MENU_ID, NavMenu } from './NavMenu';

const HELP_KEY = 'portfolio.controlsHelp.hidden';

function readHelpHidden(): boolean {
  try {
    return window.localStorage.getItem(HELP_KEY) === '1';
  } catch {
    return false;
  }
}

function ControlsHelp() {
  const [hidden, setHidden] = useState(readHelpHidden);
  const toggle = () => {
    setHidden(!hidden);
    try {
      window.localStorage.setItem(HELP_KEY, hidden ? '0' : '1');
    } catch {
      // Storage can be unavailable (private mode); the toggle still works for this visit.
    }
  };
  return (
    <section className={`controls-help${hidden ? ' is-collapsed' : ''}`} aria-label="Flight controls">
      <button type="button" className="controls-help__toggle" aria-expanded={!hidden} onClick={toggle}>
        {hidden ? 'Controls' : 'Hide controls'}
      </button>
      {!hidden && (
        <dl>
          <dt>
            <kbd>W</kbd>
            <kbd>S</kbd>
          </dt>
          <dd>Thrust / brake</dd>
          <dt>
            <kbd>A</kbd>
            <kbd>D</kbd>
          </dt>
          <dd>Turn</dd>
          <dt>
            <kbd>Space</kbd>
            <kbd>Shift</kbd>
          </dt>
          <dd>Up / down</dd>
          <dt>Drag · Wheel</dt>
          <dd>Look around · Zoom</dd>
          <dt>Click</dt>
          <dd>Open a building</dd>
          <dt>
            <kbd>M</kbd>
          </dt>
          <dd>Menu</dd>
        </dl>
      )}
    </section>
  );
}

/** Heads-up display over the 3D world: identity, menu, quick-view switch, résumé. */
export function Hud() {
  const menuOpen = usePortfolio((s) => s.menuOpen);
  const setMenuOpen = usePortfolio((s) => s.setMenuOpen);
  const switchView = usePortfolio((s) => s.switchView);
  const menuButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(menuOpen);

  // Return focus to the Menu button when the menu closes, so keyboard users don't get lost.
  useEffect(() => {
    if (wasOpen.current && !menuOpen && !usePortfolio.getState().focusPanel) menuButton.current?.focus();
    wasOpen.current = menuOpen;
  }, [menuOpen]);

  return (
    <div className="hud">
      <header className="hud__bar">
        <div className="hud__identity">
          <h1>{profile.name}</h1>
          <p>{profile.headline}</p>
        </div>
        <div className="hud__actions">
          <button
            type="button"
            ref={menuButton}
            aria-expanded={menuOpen}
            aria-controls={NAV_MENU_ID}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            Menu
          </button>
          <button type="button" onClick={() => switchView('basic')}>
            Quick view
          </button>
          <a className="button-link" href={profile.resumeUrl} download>
            Résumé
          </a>
        </div>
      </header>
      <NavMenu />
      <ControlsHelp />
    </div>
  );
}
