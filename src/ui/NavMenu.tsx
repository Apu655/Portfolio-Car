import { useEffect, useRef } from 'react';
import { roles } from '../content/portfolio';
import { SECTIONS, SECTION_LABELS, type Selection } from '../state/route';
import { usePortfolio } from '../state/store';

export const NAV_MENU_ID = 'nav-menu';

/** Jump list for every portfolio place. In 3D, choosing an entry flies the ship there and opens its panel. */
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
    <nav id={NAV_MENU_ID} className="nav-menu" aria-label="Portfolio sections" data-keyboard-scope>
      <ul>
        {SECTIONS.map((section, i) => (
          <li key={section}>
            <button type="button" ref={i === 0 ? firstItem : undefined} onClick={() => go({ section })}>
              {SECTION_LABELS[section]}
            </button>
            {section === 'experience' && (
              <ul className="nav-menu__sub">
                {[...roles].reverse().map((role) => (
                  <li key={role.id}>
                    <button type="button" onClick={() => go({ section, itemId: role.id })}>
                      {role.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className="nav-menu__switch" onClick={() => switchView('basic')}>
        Open quick view instead
      </button>
    </nav>
  );
}
