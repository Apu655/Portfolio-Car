import { useEffect, useRef, type MouseEvent, type ReactNode, type RefObject } from 'react';
import { papers, profile, projects, roles } from '../content/portfolio';
import { RoleDetails, ContactLinks } from '../ui/PanelContent';
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
        // Prefer a specific item (a role card) over the section that contains it; then the top-most one.
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

function ViewIn3D({ selection, label }: { selection: Selection; label: string }) {
  const webglAvailable = usePortfolio((s) => s.webglAvailable);
  const navigate = usePortfolio((s) => s.navigate);
  const switchView = usePortfolio((s) => s.switchView);
  if (!webglAvailable) return null;
  return (
    <button
      type="button"
      className="link-button"
      aria-label={label}
      onClick={() => {
        navigate(selection);
        switchView('3d');
      }}
    >
      View in 3D
    </button>
  );
}

/** The quick view: a plain, fast, fully accessible version of the same portfolio. */
export function BasicSite() {
  const selection = usePortfolio((s) => s.selection);
  const webglAvailable = usePortfolio((s) => s.webglAvailable);
  const switchView = usePortfolio((s) => s.switchView);
  const programmaticUntil = useScrollToSelection();
  useScrollSync(programmaticUntil);
  const isCurrent = (target: Selection) => (sameSelection(selection, target) ? 'true' : undefined);

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
            Explore in 3D
          </button>
        </div>
      </header>

      <main id="main" className="basic__main">
        <section id="about" data-section="about" tabIndex={-1} aria-current={isCurrent({ section: 'about' })}>
          <h1>{profile.name}</h1>
          <p className="lead">{profile.headline}</p>
          <p>{profile.pitch}</p>
        </section>

        <section id="experience" data-section="experience" tabIndex={-1} aria-labelledby="experience-heading">
          <h2 id="experience-heading">Experience</h2>
          <ol className="timeline" reversed>
            {[...roles].reverse().map((role) => {
              const target: Selection = { section: 'experience', itemId: role.id };
              return (
                <li key={role.id}>
                  <article
                    id={anchorId(target)}
                    data-section="experience"
                    data-item={role.id}
                    tabIndex={-1}
                    className="card"
                    aria-current={isCurrent(target)}
                    aria-labelledby={`${anchorId(target)}-title`}
                  >
                    <h3 id={`${anchorId(target)}-title`}>{role.title}</h3>
                    <RoleDetails role={role} />
                    <ViewIn3D selection={target} label={`View ${role.title} in 3D`} />
                  </article>
                </li>
              );
            })}
          </ol>
        </section>

        <section id="research" data-section="research" tabIndex={-1} aria-labelledby="research-heading">
          <h2 id="research-heading">Research</h2>
          <ul className="card-list">
            {papers.map((paper) => {
              const target: Selection = { section: 'research', itemId: paper.id };
              return (
                <li key={paper.id} id={anchorId(target)} className="card" aria-current={isCurrent(target)}>
                  <h3>{paper.title}</h3>
                  <p className="meta">
                    {paper.authors} — {paper.venue}, {paper.year}
                  </p>
                  <p>{paper.abstract}</p>
                  <a href={paper.link} target="_blank" rel="noreferrer">
                    Read paper
                  </a>
                </li>
              );
            })}
          </ul>
        </section>

        <section id="projects" data-section="projects" tabIndex={-1} aria-labelledby="projects-heading">
          <h2 id="projects-heading">Projects</h2>
          <ul className="card-list">
            {projects.map((project) => {
              const target: Selection = { section: 'projects', itemId: project.id };
              return (
                <li key={project.id} id={anchorId(target)} className="card" aria-current={isCurrent(target)}>
                  <h3>
                    {project.name} <span className="meta">({project.year})</span>
                  </h3>
                  <p>{project.description}</p>
                  <ul className="tags" aria-label="Tags">
                    {project.tags.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                  <a href={project.link} target="_blank" rel="noreferrer">
                    View project
                  </a>
                </li>
              );
            })}
          </ul>
        </section>

        <section id="contact" data-section="contact" tabIndex={-1} aria-labelledby="contact-heading">
          <h2 id="contact-heading">Contact</h2>
          <ContactLinks />
          <p>
            <a href={profile.resumeUrl} download>
              Download my résumé (PDF)
            </a>
          </p>
        </section>
      </main>
      <footer className="basic__footer">
        <p>
          © {new Date().getFullYear()} {profile.name}
        </p>
      </footer>
    </div>
  );
}
