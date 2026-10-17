import { useEffect, useRef } from 'react';
import { profile } from '../content/portfolio';
import type { Selection } from '../state/route';
import { usePortfolio } from '../state/store';
import { TOWER_NAMES } from './PanelContent';

export const NAV_MENU_ID = 'nav-menu';

const DESTINATIONS = Object.entries(TOWER_NAMES) as Array<[Exclude<Selection['section'], 'about'>, string]>;

/** Fast travel: choosing a tower moves the car to its entrance and opens its panel. */
export function NavMenu() {
  const open = usePortfolio((s) => s.menuOpen);
  const navigate = usePortfolio((s) => s.navigate);
  const switchView = usePortfolio((s) => s.switchView);
  const firstItem = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) firstItem.current?.focus();
  }, [open]);

  if (!open) return null;
  const go = (selection: Selection) => navigate(selection, { focusPanel: true });

  return (
    <nav id={NAV_MENU_ID} className="nav-menu" aria-label="Fast travel" data-keyboard-scope>
      <p className="nav-menu__title">Fast travel</p>
      <ul>
        {DESTINATIONS.map(([section, name], i) => (
          <li key={section}>
            <button type="button" ref={i === 0 ? firstItem : undefined} onClick={() => go({ section })}>
              {name}
            </button>
          </li>
        ))}
        <li>
          <button type="button" onClick={() => go({ section: 'about' })}>
            About {profile.name}
          </button>
        </li>
      </ul>
      <button type="button" className="nav-menu__switch" onClick={() => switchView('basic')}>
        Browse the conventional portfolio
      </button>
    </nav>
  );
}
