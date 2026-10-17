import { useEffect, useRef, useState } from 'react';
import { profile } from '../content/portfolio';
import { usePortfolio } from '../state/store';
import { NAV_MENU_ID, NavMenu } from './NavMenu';
import { TOWER_NAMES } from './PanelContent';
import { TouchControls, useCoarsePointer } from './TouchControls';

const WELCOME_KEY = 'portfolio.welcome.dismissed';

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(WELCOME_KEY) === '1';
  } catch {
    return false;
  }
}

function ControlsList({ touch }: { touch: boolean }) {
  if (touch) {
    return (
      <dl className="controls">
        <dt>Joystick</dt>
        <dd>Drive and steer</dd>
        <dt>Interact</dt>
        <dd>Open a tower when you’re in its glowing zone</dd>
        <dt>Tap a tower</dt>
        <dd>Fast travel there</dd>
      </dl>
    );
  }
  return (
    <dl className="controls">
      <dt>
        <kbd>W</kbd>
        <kbd>S</kbd>
      </dt>
      <dd>Drive / brake and reverse</dd>
      <dt>
        <kbd>A</kbd>
        <kbd>D</kbd>
      </dt>
      <dd>Steer</dd>
      <dt>
        <kbd>Space</kbd>
      </dt>
      <dd>Handbrake</dd>
      <dt>
        <kbd>E</kbd>
      </dt>
      <dd>Open the tower whose glowing zone you’re in</dd>
      <dt>
        <kbd>M</kbd>
      </dt>
      <dd>Fast travel menu</dd>
      <dt>Click a tower</dt>
      <dd>Fast travel there</dd>
    </dl>
  );
}

/** First-visit card: who this is, how to drive, and the shortcuts out of driving mode. */
function WelcomeCard({ touch }: { touch: boolean }) {
  const [dismissed, setDismissed] = useState(readDismissed);
  const [showControls, setShowControls] = useState(false);
  const switchView = usePortfolio((s) => s.switchView);
  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(WELCOME_KEY, '1');
    } catch {
      // Storage can be unavailable (private mode); dismissing still works for this visit.
    }
  };

  if (dismissed) {
    return (
      <section className={`controls-card${showControls ? '' : ' is-collapsed'}`} aria-label="Driving controls">
        <button type="button" className="controls-card__toggle" aria-expanded={showControls} onClick={() => setShowControls(!showControls)}>
          {showControls ? 'Hide controls' : 'Controls'}
        </button>
        {showControls && <ControlsList touch={touch} />}
      </section>
    );
  }
  return (
    <section className="welcome" aria-labelledby="welcome-title">
      <p className="eyebrow">Welcome to Career City</p>
      <h2 id="welcome-title">{profile.name}</h2>
      <p className="welcome__headline">{profile.headline}</p>
      <p>Drive the boulevard: each tower holds part of my career. Pull into a tower’s glowing zone to open it.</p>
      <ControlsList touch={touch} />
      <div className="panel-actions">
        <button type="button" className="primary" onClick={dismiss}>
          Start driving
        </button>
        <button type="button" onClick={() => switchView('basic')}>
          Quick view instead
        </button>
      </div>
    </section>
  );
}

/** "Press E" prompt while the car sits in a tower's entrance zone. */
function InteractPrompt({ touch }: { touch: boolean }) {
  const nearTower = usePortfolio((s) => s.nearTower);
  const panelOpen = usePortfolio((s) => s.panelOpen);
  const navigate = usePortfolio((s) => s.navigate);
  if (!nearTower || panelOpen) return null;
  const name = TOWER_NAMES[nearTower];
  return (
    <div className="interact-prompt" role="status">
      {touch ? (
        <button type="button" className="primary" onClick={() => navigate({ section: nearTower }, { travel: false })}>
          Open {name}
        </button>
      ) : (
        <p>
          Press <kbd>E</kbd> to open the <strong>{name}</strong>
        </p>
      )}
    </div>
  );
}

/** Heads-up display over the 3D city: identity, menu, quick-view switch, résumé, prompts, touch controls. */
export function Hud() {
  const menuOpen = usePortfolio((s) => s.menuOpen);
  const setMenuOpen = usePortfolio((s) => s.setMenuOpen);
  const switchView = usePortfolio((s) => s.switchView);
  const touch = useCoarsePointer();
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
          <p className="hud__name">{profile.name}</p>
          <p>{profile.headline}</p>
        </div>
        <div className="hud__actions">
          <button type="button" ref={menuButton} aria-expanded={menuOpen} aria-controls={NAV_MENU_ID} onClick={() => setMenuOpen(!menuOpen)}>
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
      <WelcomeCard touch={touch} />
      <InteractPrompt touch={touch} />
      {touch && <TouchControls />}
    </div>
  );
}
