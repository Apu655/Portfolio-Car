import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { initPortfolio } from './initPortfolio';
import type { Capabilities } from './lib/capabilities';

// jsdom has no WebGL, so the canvas is replaced by a stub. Everything visitors read and click — HUD, menu,
// info panel, quick view — is real DOM and runs unmocked.
vi.mock('./world/World3D', () => ({ default: () => <div data-testid="world-3d" /> }));

const capabilities: Capabilities = { webgl: true, softwareRenderer: false, reducedMotion: false };
vi.mock('./lib/capabilities', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/capabilities')>()),
  detectCapabilities: () => capabilities,
}));

function start(hash = '', caps: Partial<Capabilities> = {}) {
  Object.assign(capabilities, { webgl: true, softwareRenderer: false, reducedMotion: false }, caps);
  window.history.replaceState(null, '', `/${hash}`);
  initPortfolio();
  const user = userEvent.setup();
  render(<App />);
  return user;
}

const SLOW = { timeout: 3000 };

describe('landing', () => {
  it('opens the 3D world first, with the résumé one click away', async () => {
    start();
    expect(await screen.findByTestId('world-3d')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Résumé' })).toHaveAttribute('href', '/resume.pdf');
    expect(screen.getByRole('link', { name: 'Résumé' })).toHaveAttribute('download');
    expect(window.location.hash).toBe('#/3d');
  });

  it('falls back to the quick view and says why when WebGL is unavailable', async () => {
    start('', { webgl: false });
    expect(screen.queryByTestId('world-3d')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/WebGL/);
    expect(screen.getByRole('button', { name: 'Explore in 3D' })).toBeDisabled();
    expect(screen.getAllByRole('link', { name: /résumé/i })[0]).toHaveAttribute('href', '/resume.pdf');
    expect(screen.getByRole('heading', { level: 3, name: 'Senior Engineer, Gamification' })).toBeInTheDocument();
  });

  it('opens a deep link straight onto the right panel', async () => {
    start('#/3d/experience/software-engineer');
    const panel = await screen.findByRole('dialog', { name: 'Software Engineer' });
    expect(within(panel).getByText('Jul 2020 – Mar 2022')).toBeInTheDocument();
  });
});

describe('3D navigation menu and info panel', () => {
  it('jumps to a role from the menu and shows title, dates, and achievements', async () => {
    const user = start();
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    const menu = screen.getByRole('navigation', { name: 'Portfolio sections' });
    await user.click(within(menu).getByRole('button', { name: 'Senior Engineer, Gamification' }));

    const panel = screen.getByRole('dialog', { name: 'Senior Engineer, Gamification' });
    expect(within(panel).getByText('Placeholder Tech Co.')).toBeInTheDocument();
    expect(within(panel).getByText('Apr 2022 – Aug 2024')).toBeInTheDocument();
    expect(within(panel).getByText('Raised 30-day retention by 12% across 3 products')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Portfolio sections' })).not.toBeInTheDocument();
    expect(window.location.hash).toBe('#/3d/experience/senior-engineer');
    expect(screen.getByRole('heading', { name: 'Senior Engineer, Gamification', level: 2 })).toHaveFocus();
  });

  it('moves between floors with the earlier/later buttons', async () => {
    const user = start('#/3d/experience/software-engineer');
    await user.click(screen.getByRole('button', { name: 'Later role ↑' }));
    expect(screen.getByRole('dialog', { name: 'Senior Engineer, Gamification' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '↓ Earlier role' }));
    await user.click(screen.getByRole('button', { name: '↓ Earlier role' }));
    expect(screen.getByRole('dialog', { name: 'Research Assistant' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '↓ Earlier role' })).toBeDisabled();
  });

  it('works from the keyboard: M opens the menu, Escape closes the panel and returns focus to Menu', async () => {
    const user = start();
    await user.keyboard('m');
    const menu = screen.getByRole('navigation', { name: 'Portfolio sections' });
    expect(within(menu).getByRole('button', { name: 'About' })).toHaveFocus();
    await user.tab();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: 'Experience' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.location.hash).toBe('#/3d');
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveFocus();
  });

  it('Escape closes an open menu before touching the panel', async () => {
    const user = start('#/3d/research');
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('navigation', { name: 'Portfolio sections' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Research' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveFocus();
  });
});

describe('switching views keeps your place', () => {
  it('3D → quick view lands on the same role', async () => {
    const user = start('#/3d/experience/lead-research-engineer');
    await user.click(screen.getByRole('button', { name: 'Quick view' }));
    const card = await screen.findByRole('article', { name: 'Lead Research Engineer' }, SLOW);
    expect(card).toHaveAttribute('aria-current', 'true');
    expect(card).toHaveFocus();
    expect(screen.queryByTestId('world-3d')).not.toBeInTheDocument();
    expect(window.location.hash).toBe('#/basic/experience/lead-research-engineer');
  });

  it('quick view → 3D opens that role’s panel', async () => {
    const user = start('#/basic');
    await user.click(screen.getByRole('button', { name: 'View Research Assistant in 3D' }));
    expect(await screen.findByTestId('world-3d', {}, SLOW)).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: 'Research Assistant' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/3d/experience/research-assistant');
  });

  it('quick view section links update the URL and mark the section current', async () => {
    const user = start('#/basic');
    const nav = screen.getByRole('navigation', { name: 'Portfolio sections' });
    await user.click(within(nav).getByRole('link', { name: 'Contact' }));
    expect(window.location.hash).toBe('#/basic/contact');
    expect(document.getElementById('contact')).toHaveFocus();
  });
});

describe('browser history', () => {
  it('Back and Forward move between places and views', async () => {
    const user = start('#/basic');
    await user.click(screen.getByRole('button', { name: 'View Software Engineer in 3D' }));
    await screen.findByRole('dialog', { name: 'Software Engineer' }, SLOW);

    await act(async () => {
      window.history.back();
      await new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
    });
    expect(screen.queryByTestId('world-3d')).not.toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Software Engineer' })).toHaveAttribute('aria-current', 'true');

    await act(async () => {
      window.history.forward();
      await new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
    });
    expect(await screen.findByRole('dialog', { name: 'Software Engineer' })).toBeInTheDocument();
  });
});
