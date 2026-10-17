import { useEffect, useRef, type MouseEvent, type ReactNode, type RefObject } from 'react';
import { profile, role } from '../content/portfolio';
import { ContactLinks, EducationList, ProjectList, ResearchList, RoleDetails, TOWER_NAMES } from '../ui/PanelContent';
import { anchorId, formatHash, sameSelection, SECTIONS, SECTION_LABELS, type Section, type Selection } from '../state/route';
import { usePortfolio } from '../state/store';

/**
 * Ignore scroll-position syncing while we scroll programmatically, so passing cards can't override the target.
 * Cleared early by the `scrollend` event where supported.
 */
const SCROLL_SETTLE_MS = 2000;

function useScrollToSelection(): RefObject<number> {
  const navToken = usePortfolio((s) => s.navToken);
  const programmaticUntil = useRef(0);
  useEffect(() => {
    const { selection, reducedMotion } = usePortfolio.getState();
    if (!selection) {
      window.scrollTo?.({ top: 0 });
      return;
    }
    const element = document.getElementById(anchorId(selection));
    if (!element) return;
    programmaticUntil.current = Date.now() + SCROLL_SETTLE_MS;
    const settle = () => {
      programmaticUntil.current = 0;
    };
    window.addEventListener('scrollend', settle, { once: true });
    element.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    element.focus({ preventScroll: true });
    return () => window.removeEventListener('scrollend', settle);
  }, [navToken]);
  return programmaticUntil;
}

/** Report what is scrolled into view as the current place, so switching to 3D keeps your place. */
function useScrollSync(programmaticUntil: RefObject<number>): void {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const inView = new Set<HTMLElement>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const element = entry.target as HTMLElement;
          if (entry.isIntersecting) inView.add(element);
          else inView.delete(element);
        }
        if (Date.now() < programmaticUntil.current) return;
        // Prefer a specific item over the section that contains it; then the top-most one.
        const candidates = [...inView].sort(
          (a, b) =>
            Number(Boolean(b.dataset.item)) - Number(Boolean(a.dataset.item)) ||
            a.getBoundingClientRect().top - b.getBoundingClientRect().top,
        );
        const element = candidates[0];
        if (!element) return;
        const section = element.dataset.section as Section;
        const itemId = element.dataset.item;
        usePortfolio.getState().syncSelection(itemId ? { section, itemId } : { section });
      },
      { rootMargin: '-20% 0px -60% 0px' },
    );
    document.querySelectorAll<HTMLElement>('[data-section]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [programmaticUntil]);
}

function SectionLink({ selection, children }: { selection: Selection; children: ReactNode }) {
  const navigate = usePortfolio((s) => s.navigate);
  const onClick = (event: MouseEvent) => {
    event.preventDefault();
    navigate(selection);
  };
  return (
    <a href={formatHash('basic', selection)} onClick={onClick}>
      {children}
    </a>
  );
}

function DriveThere({ section }: { section: Exclude<Section, 'about'> }) {
  const webglAvailable = usePortfolio((s) => s.webglAvailable);
  const navigate = usePortfolio((s) => s.navigate);
  const switchView = usePortfolio((s) => s.switchView);
  if (!webglAvailable) return null;
  return (
    <button
      type="button"
      className="link-button"
      onClick={() => {
        navigate({ section });
        switchView('3d');
      }}
    >
      Visit the {TOWER_NAMES[section]} in 3D
    </button>
  );
}

function SectionBlock({ section, children }: { section: Exclude<Section, 'about'>; children: ReactNode }) {
  const current = usePortfolio((s) => sameSelection(s.selection, { section }));
  return (
    <section
      id={section}
      data-section={section}
      tabIndex={-1}
      aria-labelledby={`${section}-heading`}
      aria-current={current ? 'true' : undefined}
    >
      <div className="section-head">
        <h2 id={`${section}-heading`}>{SECTION_LABELS[section]}</h2>
        <DriveThere section={section} />
      </div>
      {children}
    </section>
  );
}

/** The quick view: a plain, fast, fully accessible version of the same portfolio. */
export function BasicSite() {
  const selection = usePortfolio((s) => s.selection);
  const webglAvailable = usePortfolio((s) => s.webglAvailable);
  const switchView = usePortfolio((s) => s.switchView);
  const programmaticUntil = useScrollToSelection();
  useScrollSync(programmaticUntil);
  const activeItem = (section: Section) => (selection?.section === section ? selection.itemId : undefined);

  return (
    <div className="basic">
      <header className="basic__header">
        <div className="basic__identity">
          <p className="basic__name">{profile.name}</p>
          <p className="basic__headline">{profile.headline}</p>
        </div>
        <nav aria-label="Portfolio sections" className="basic__nav">
          <ul>
            {SECTIONS.map((section) => (
              <li key={section}>
                <SectionLink selection={{ section }}>{SECTION_LABELS[section]}</SectionLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="basic__actions">
          <a className="button-link" href={profile.resumeUrl} download>
            Résumé (PDF)
          </a>
          <button
            type="button"
            onClick={() => switchView('3d')}
            disabled={!webglAvailable}
            title={webglAvailable ? undefined : 'Your browser does not support WebGL'}
          >
            Drive the city
          </button>
        </div>
      </header>

      <main id="main" className="basic__main">
        <section
          id="about"
          data-section="about"
          tabIndex={-1}
          aria-current={sameSelection(selection, { section: 'about' }) ? 'true' : undefined}
        >
          <h1>{profile.name}</h1>
          <p className="lead">{profile.headline}</p>
          <p>{profile.pitch}</p>
        </section>

        <SectionBlock section="experience">
          <article className="card" aria-labelledby="experience-role-title">
            <h3 id="experience-role-title">{role.title}</h3>
            <RoleDetails role={role} />
          </article>
        </SectionBlock>

        <SectionBlock section="research">
          <ResearchList activeId={activeItem('research')} idPrefix="research" />
        </SectionBlock>

        <SectionBlock section="projects">
          <ProjectList activeId={activeItem('projects')} idPrefix="projects" />
        </SectionBlock>

        <SectionBlock section="education">
          <EducationList activeId={activeItem('education')} idPrefix="education" />
        </SectionBlock>

        <SectionBlock section="contact">
          <ContactLinks />
        </SectionBlock>
      </main>
      <footer className="basic__footer">
        <p>
          © {new Date().getFullYear()} {profile.name}
        </p>
      </footer>
    </div>
  );
}
