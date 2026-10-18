import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { initPortfolio } from './initPortfolio';
import type { Capabilities } from './lib/capabilities';
import { usePortfolio } from './state/store';

// jsdom has no WebGL, so the canvas is replaced by a stub. Everything visitors read and click (HUD, prompts,
// menu, info panel, quick view) is real DOM and runs unmocked. Entering a tower's zone is reported by the
// scene through the store's setNearTower, so tests drive that same entry point.
vi.mock('./world/World3D', () => ({ default: () => <div data-testid="world-3d" /> }));

const capabilities: Capabilities = { webgl: true, softwareRenderer: false, reducedMotion: false };
vi.mock('./lib/capabilities', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/capabilities')>()),
  detectCapabilities: () => capabilities,
}));

function start(hash = '', caps: Partial<Capabilities> = {}) {
  Object.assign(capabilities, { webgl: true, softwareRenderer: false, reducedMotion: false }, caps);
  window.localStorage.clear();
  window.history.replaceState(null, '', `/${hash}`);
  usePortfolio.setState({ nearTower: null });
  initPortfolio();
  const user = userEvent.setup();
  render(<App />);
  return user;
}

const SLOW = { timeout: 3000 };
const enterZone = (section: Parameters<ReturnType<typeof usePortfolio.getState>['setNearTower']>[0]) =>
  act(() => usePortfolio.getState().setNearTower(section));

describe('landing', () => {
  it('opens the 3D city first with a welcome card and the résumé one click away', async () => {
    start();
    expect(await screen.findByTestId('world-3d')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Apu Islam' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start driving' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Résumé' })).toHaveAttribute('href', '/resume.pdf');
    expect(screen.getByRole('link', { name: 'Résumé' })).toHaveAttribute('download');
    expect(window.location.hash).toBe('#/3d');
  });

  it('remembers that the welcome card was dismissed', async () => {
    const user = start();
    await user.click(screen.getByRole('button', { name: 'Start driving' }));
    expect(screen.queryByRole('button', { name: 'Start driving' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Controls' })).toBeInTheDocument();
    expect(window.localStorage.getItem('portfolio.welcome.dismissed')).toBe('1');
  });

  it('falls back to the quick view and says why when WebGL is unavailable', () => {
    start('', { webgl: false });
    expect(screen.queryByTestId('world-3d')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/WebGL/);
    expect(screen.getByRole('button', { name: 'Drive the city' })).toBeDisabled();
    expect(screen.getAllByRole('link', { name: /résumé/i })[0]).toHaveAttribute('href', '/resume.pdf');
    expect(screen.getByRole('heading', { level: 3, name: 'Software Engineer – AI' })).toBeInTheDocument();
  });

  it('names the employer only inside the Career panel', async () => {
    const user = start('#/3d');
    await enterZone('experience');
    expect(screen.getByRole('status')).not.toHaveTextContent('MetLife');
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('navigation', { name: 'Fast travel' })).not.toHaveTextContent('MetLife');
    await user.keyboard('{Escape}');
    await user.keyboard('e');
    const panel = screen.getByRole('dialog', { name: 'Software Engineer – AI' });
    expect(within(panel).getByText('MetLife')).toBeInTheDocument();
    expect(within(panel).getByRole('heading', { name: 'Technologies' })).toBeInTheDocument();
    expect(document.title).toContain('Apu Islam');
  });

  it('shows Apu Islam and never the employer name in the quick view navigation', () => {
    start('#/basic');
    expect(screen.getByRole('heading', { level: 1, name: 'Apu Islam' })).toBeInTheDocument();
    for (const button of screen.getAllByRole('button', { name: /Visit the/ })) expect(button).not.toHaveTextContent('MetLife');
  });

  it('opens a deep link straight onto the Career panel', async () => {
    start('#/3d/experience');
    const panel = await screen.findByRole('dialog', { name: 'Software Engineer – AI' });
    expect(within(panel).getByText('Nov 2023 – Jul 2026')).toBeInTheDocument();
    expect(within(panel).getByRole('heading', { name: 'Responsibilities' })).toBeInTheDocument();
    expect(within(panel).getByRole('heading', { name: 'Achievements' })).toBeInTheDocument();
  });
});

describe('driving up to a tower and pressing E', () => {
  it('shows the prompt only inside an entrance zone, and E opens that tower without moving the car', async () => {
    const user = start('#/3d');
    expect(screen.queryByText(/Press/)).not.toBeInTheDocument();

    await enterZone('experience');
    expect(screen.getByRole('status')).toHaveTextContent('Press E to open the Career Tower');
    await user.keyboard('e');

    const panel = screen.getByRole('dialog', { name: 'Software Engineer – AI' });
    expect(within(panel).getByText('MetLife')).toBeInTheDocument();
    expect(usePortfolio.getState().travel).toBe(false); // the car stays where it parked
    expect(window.location.hash).toBe('#/3d/experience');
    expect(screen.queryByText(/Press E/)).not.toBeInTheDocument(); // prompt hides while the panel is open
  });

  it('E does nothing outside a zone', async () => {
    const user = start('#/3d');
    await enterZone(null);
    await user.keyboard('e');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens each tower’s own content', async () => {
    const user = start('#/3d');
    await enterZone('research');
    await user.keyboard('e');
    const research = screen.getByRole('dialog', { name: 'Research & publications' });
    for (const theme of ['Healthcare AI', 'NLP', 'LLM research']) {
      expect(within(research).getByRole('region', { name: theme })).toBeInTheDocument();
    }
    await user.keyboard('{Escape}');

    await enterZone('projects');
    await user.keyboard('e');
    const projects = screen.getByRole('dialog', { name: 'Projects' });
    expect(within(projects).getAllByRole('link', { name: 'GitHub repository' }).length).toBeGreaterThan(0);
    expect(within(projects).getByRole('link', { name: 'Live demo' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await enterZone('contact');
    await user.keyboard('e');
    const contact = screen.getByRole('dialog', { name: 'Contact' });
    for (const name of ['Email', 'LinkedIn', 'GitHub']) expect(within(contact).getByRole('link', { name })).toBeInTheDocument();
    expect(within(contact).getByRole('link', { name: 'Résumé (PDF)' })).toHaveAttribute('download');
  });
});

describe('fast travel menu', () => {
  it('lists all five towers and travels to the chosen one', async () => {
    const user = start();
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    const menu = screen.getByRole('navigation', { name: 'Fast travel' });
    const names = within(menu)
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(names).toEqual(expect.arrayContaining(['Career Tower', 'Research kiosk', 'Projects kiosk', 'Education kiosk', 'Contact kiosk']));
    await user.click(within(menu).getByRole('button', { name: 'Education kiosk' }));

    expect(screen.getByRole('dialog', { name: 'Education' })).toBeInTheDocument();
    expect(usePortfolio.getState().travel).toBe(true);
    expect(window.location.hash).toBe('#/3d/education');
    expect(screen.getByRole('heading', { name: 'Education', level: 2 })).toHaveFocus();
  });

  it('works from the keyboard: M opens the menu, Escape closes the panel and returns focus to Menu', async () => {
    const user = start();
    await user.keyboard('m');
    const menu = screen.getByRole('navigation', { name: 'Fast travel' });
    expect(within(menu).getByRole('button', { name: 'Career Tower' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: 'Software Engineer – AI' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.location.hash).toBe('#/3d');
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveFocus();
  });

  it('Escape closes an open menu before touching the panel', async () => {
    const user = start('#/3d/research');
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('navigation', { name: 'Fast travel' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Research & publications' })).toBeInTheDocument();
  });
});

describe('leaving driving mode keeps your place', () => {
  it('3D → quick view lands on the same section', async () => {
    const user = start('#/3d/education');
    await user.click(screen.getByRole('button', { name: 'Quick view' }));
    const section = await screen.findByRole('region', { name: 'Education' }, SLOW);
    expect(section).toHaveAttribute('aria-current', 'true');
    expect(section).toHaveFocus();
    expect(screen.queryByTestId('world-3d')).not.toBeInTheDocument();
    expect(window.location.hash).toBe('#/basic/education');
  });

  it('quick view → 3D opens that tower’s panel', async () => {
    const user = start('#/basic');
    await user.click(screen.getByRole('button', { name: 'Visit the Projects kiosk in 3D' }));
    expect(await screen.findByTestId('world-3d', {}, SLOW)).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: 'Projects' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/3d/projects');
  });

  it('quick view has every section and section links update the URL', async () => {
    const user = start('#/basic');
    const nav = screen.getByRole('navigation', { name: 'Portfolio sections' });
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['About', 'Experience', 'Research', 'Projects', 'Education', 'Contact']);
    await user.click(within(nav).getByRole('link', { name: 'Contact' }));
    expect(window.location.hash).toBe('#/basic/contact');
    expect(document.getElementById('contact')).toHaveFocus();
  });
});

describe('browser history', () => {
  it('Back and Forward move between places and views', async () => {
    const user = start('#/basic');
    await user.click(screen.getByRole('button', { name: 'Visit the Contact kiosk in 3D' }));
    await screen.findByRole('dialog', { name: 'Contact' }, SLOW);

    await act(async () => {
      window.history.back();
      await new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
    });
    expect(screen.queryByTestId('world-3d')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Contact' })).toHaveAttribute('aria-current', 'true');

    await act(async () => {
      window.history.forward();
      await new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
    });
    expect(await screen.findByRole('dialog', { name: 'Contact' })).toBeInTheDocument();
  });
});

describe('heads-up display', () => {
  it('has a day dial: scrubbing sets the time, and pause holds it', async () => {
    const { dayClock } = await import('./world/lighting/clock');
    const user = start();
    const slider = screen.getByRole('slider', { name: 'Time of day' });
    fireEvent.change(slider, { target: { value: '23' } });
    expect(Math.round(dayClock.hours(performance.now()) * 4) / 4).toBe(23);
    expect(slider).toHaveAttribute('aria-valuetext', expect.stringMatching(/^23:0\d$/));

    await user.click(screen.getByRole('button', { name: 'Pause the day cycle' }));
    expect(dayClock.paused).toBe(true);
    expect(screen.getByRole('button', { name: 'Resume the day cycle' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Resume the day cycle' }));
    expect(dayClock.paused).toBe(false);
  });

  it('hides the welcome card during the opening reveal and shows how to skip it', () => {
    start();
    act(() => usePortfolio.getState().setRevealing(true));
    expect(screen.queryByRole('button', { name: 'Start driving' })).not.toBeInTheDocument();
    expect(screen.getByText('Press any key or tap to skip')).toBeInTheDocument();
    act(() => usePortfolio.getState().setRevealing(false));
    expect(screen.getByRole('button', { name: 'Start driving' })).toBeInTheDocument();
  });
});

describe('sound controls (AE4)', () => {
  it('says sound starts when you drive, and a mute survives a reload', async () => {
    const { useAudioSettings } = await import('./world/audio/settings');
    const user = start();
    useAudioSettings.getState().reload();
    const mute = screen.getByRole('button', { name: 'Mute sound' });
    expect(mute).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Sound starts when you drive')).toBeInTheDocument();

    await user.click(mute);
    expect(screen.getByRole('button', { name: 'Unmute sound' })).toHaveAttribute('aria-pressed', 'true');

    // A reload re-reads the saved setting (start() clears storage, so simulate the reload directly).
    const saved = window.localStorage.getItem('portfolio.audio');
    act(() => useAudioSettings.setState({ muted: false }));
    window.localStorage.setItem('portfolio.audio', saved!);
    act(() => useAudioSettings.getState().reload());
    expect(screen.getByRole('button', { name: 'Unmute sound' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('has a volume slider in a popover', async () => {
    const user = start();
    await user.click(screen.getByRole('button', { name: 'Volume' }));
    expect(screen.getByRole('slider', { name: 'Volume' })).toBeInTheDocument();
  });
});

describe('controls card (fixed camera)', () => {
  it('tells desktop visitors that scrolling zooms', () => {
    start();
    expect(screen.getByText('Scroll')).toBeInTheDocument();
    expect(screen.getByText('Zoom in and out')).toBeInTheDocument();
  });

  it('tells touch visitors to pinch to zoom and that the joystick drives where they push', () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === '(pointer: coarse)',
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    try {
      start();
      expect(screen.getByText('Pinch')).toBeInTheDocument();
      expect(screen.getByText('Push toward where you want to drive')).toBeInTheDocument();
    } finally {
      window.matchMedia = original;
    }
  });
});
