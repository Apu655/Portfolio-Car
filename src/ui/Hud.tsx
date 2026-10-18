import { useEffect, useRef, useState } from 'react';
import { profile } from '../content/portfolio';
import { usePortfolio } from '../state/store';
import { AudioControls } from './AudioControls';
import { DayDial } from './DayDial';
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
        <dd>Push toward where you want to drive</dd>
        <dt>Pinch</dt>
        <dd>Zoom in and out</dd>
        <dt>Interact</dt>
        <dd>Open a stop when you’re in its glowing zone</dd>
        <dt>Recover</dt>
        <dd>Put the car back on its wheels</dd>
        <dt>Tap a building</dt>
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
      <dd>Open the stop whose glowing zone you’re in</dd>
      <dt>
        <kbd>R</kbd>
      </dt>
      <dd>Recover: put the car back on its wheels</dd>
      <dt>
        <kbd>M</kbd>
      </dt>
      <dd>Fast travel menu</dd>
      <dt>Scroll</dt>
      <dd>Zoom in and out</dd>
      <dt>Click a building</dt>
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
      <p className="eyebrow">Welcome to the Career District</p>
      <h2 id="welcome-title">{profile.name}</h2>
      <p className="welcome__headline">{profile.headline}</p>
      <p>Drive around the district: the Career Tower and four kiosks hold my story. Pull into a glowing zone to open one, and knock over whatever you like on the way.</p>
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

/** Shown during the opening fly-over. */
function RevealHint() {
  return (
    <p className="reveal-hint" role="status">
      Press any key or tap to skip
    </p>
  );
}

/** "Press E" prompt while the car sits in a stop's entrance zone. */
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
  const revealing = usePortfolio((s) => s.revealing);
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
          <DayDial />
          <AudioControls />
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
      {revealing ? <RevealHint /> : <WelcomeCard touch={touch} />}
      <InteractPrompt touch={touch} />
      {touch && !revealing && <TouchControls />}
    </div>
  );
}
