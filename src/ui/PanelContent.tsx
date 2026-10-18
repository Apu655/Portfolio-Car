import { education, papers, profile, projects, RESEARCH_THEMES, role, roles, type Role } from '../content/portfolio';
import { formatRoleDates, formatRoleDuration } from '../content/format';
import type { Selection } from '../state/route';
import { usePortfolio } from '../state/store';

/** Readable content for each portfolio place. Shared by the 3D info panel and the quick view. */

/** What each stop is called in the HUD, menu, and quick view. The employer appears only inside the Career panel. */
export const TOWER_NAMES: Record<Exclude<Selection['section'], 'about'>, string> = {
  experience: 'Career Tower',
  research: 'Research Road',
  projects: 'Projects Hall',
  education: 'Campus',
  contact: 'Contact kiosk',
};

export function panelTitle(selection: Selection): string {
  switch (selection.section) {
    case 'about':
      return profile.name;
    case 'experience':
      return (roles.find((r) => r.id === selection.itemId) ?? role).title;
    case 'research':
      return 'Research & publications';
    case 'projects':
      return 'Projects';
    case 'education':
      return 'Education';
    case 'contact':
      return 'Contact';
  }
}

export function RoleDetails({ role: r }: { role: Role }) {
  return (
    <>
      <div className="org-line">
        {r.logo && <img className="org-logo" src={r.logo} alt="" width={40} height={40} loading="lazy" />}
        <p className="role-org">{r.organization}</p>
      </div>
      <p className="role-dates">
        <time dateTime={r.start}>{formatRoleDates(r)}</time>
        <span aria-hidden="true"> · </span>
        <span>{formatRoleDuration(r)}</span>
        {r.location && (
          <>
            <span aria-hidden="true"> · </span>
            <span>{r.location}</span>
          </>
        )}
      </p>
      <p>{r.summary}</p>
      {r.responsibilities.length > 0 && (
        <>
          <h3>Responsibilities</h3>
          <ul className="bullets">
            {r.responsibilities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
      {r.achievements.length > 0 && (
        <>
          <h3>Achievements</h3>
          <ul className="bullets">
            {r.achievements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
      <h3>Technologies</h3>
      <ul className="tags" aria-label="Technologies">
        {r.technologies.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      {r.links.length > 0 && (
        <p className="link-row">
          {r.links.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noreferrer">
              {l.label}
            </a>
          ))}
        </p>
      )}
    </>
  );
}

/** The Career Tower panel: the selected (or featured) role in full, then the others to switch to. */
function ExperiencePanel({ activeId }: { activeId?: string }) {
  const navigate = usePortfolio((s) => s.navigate);
  const active = roles.find((r) => r.id === activeId) ?? role;
  return (
    <>
      <RoleDetails role={active} />
      <h3>More experience</h3>
      <ul className="item-list">
        {roles
          .filter((r) => r.id !== active.id)
          .map((r) => (
            <li key={r.id} className="card">
              <h4>{r.title}</h4>
              <p className="meta">
                {r.organization} · {formatRoleDates(r)}
              </p>
              <p>{r.tagline}</p>
              <button type="button" onClick={() => navigate({ section: 'experience', itemId: r.id }, { travel: false })}>
                Show details
              </button>
            </li>
          ))}
      </ul>
    </>
  );
}

/** Every role in full, for the quick view. */
export function RoleList({ activeId, idPrefix }: { activeId?: string; idPrefix?: string }) {
  return (
    <ul className="item-list">
      {roles.map((r) => (
        <li
          key={r.id}
          id={idPrefix ? `${idPrefix}-${r.id}` : undefined}
          data-section={idPrefix ? 'experience' : undefined}
          data-item={idPrefix ? r.id : undefined}
          className={`card${r.id === activeId ? ' is-active' : ''}`}
          aria-current={r.id === activeId ? 'true' : undefined}
        >
          <h3>{r.title}</h3>
          <RoleDetails role={r} />
        </li>
      ))}
    </ul>
  );
}

export function ResearchList({ activeId, idPrefix }: { activeId?: string; idPrefix?: string }) {
  return (
    <>
      {RESEARCH_THEMES.map((theme) => {
        const inTheme = papers.filter((p) => p.theme === theme);
        if (inTheme.length === 0) return null;
        return (
          <section key={theme} className="theme-group" aria-label={theme}>
            <h3 className="eyebrow">{theme}</h3>
            <ul className="item-list">
              {inTheme.map((paper) => (
                <li
                  key={paper.id}
                  id={idPrefix ? `${idPrefix}-${paper.id}` : undefined}
                  data-section={idPrefix ? 'research' : undefined}
                  data-item={idPrefix ? paper.id : undefined}
                  className={`card${paper.id === activeId ? ' is-active' : ''}`}
                  aria-current={paper.id === activeId ? 'true' : undefined}
                >
                  {paper.image && <img className="card-image" src={paper.image} alt="" loading="lazy" />}
                  <h4>{paper.title}</h4>
                  <p className="meta">
                    <span className="status">{paper.status}</span> {paper.authors} — {paper.venue}, {paper.year}
                  </p>
                  <p>{paper.abstract}</p>
                  {paper.link && (
                    <a href={paper.link} target="_blank" rel="noreferrer">
                      Read paper
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

export function ProjectList({ activeId, idPrefix }: { activeId?: string; idPrefix?: string }) {
  return (
    <ul className="item-list">
      {projects.map((project) => (
        <li
          key={project.id}
          id={idPrefix ? `${idPrefix}-${project.id}` : undefined}
          data-section={idPrefix ? 'projects' : undefined}
          data-item={idPrefix ? project.id : undefined}
          className={`card${project.id === activeId ? ' is-active' : ''}`}
          aria-current={project.id === activeId ? 'true' : undefined}
        >
          {project.image && <img className="card-image" src={project.image} alt={`Screenshot of ${project.name}`} loading="lazy" />}
          <h4>{project.name}</h4>
          <p>{project.description}</p>
          <ul className="tags" aria-label="Technologies">
            {project.technologies.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          {(project.demo || project.repo) && (
            <p className="link-row">
              {project.demo && (
                <a href={project.demo} target="_blank" rel="noreferrer">
                  Live demo
                </a>
              )}
              {project.repo && (
                <a href={project.repo} target="_blank" rel="noreferrer">
                  GitHub repository
                </a>
              )}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function EducationList({ activeId, idPrefix }: { activeId?: string; idPrefix?: string }) {
  return (
    <ul className="item-list">
      {education.map((entry) => (
        <li
          key={entry.id}
          id={idPrefix ? `${idPrefix}-${entry.id}` : undefined}
          data-section={idPrefix ? 'education' : undefined}
          data-item={idPrefix ? entry.id : undefined}
          className={`card${entry.id === activeId ? ' is-active' : ''}`}
          aria-current={entry.id === activeId ? 'true' : undefined}
        >
          <h4>{entry.degree}</h4>
          <div className="org-line">
            {entry.logo && <img className="org-logo" src={entry.logo} alt="" width={40} height={40} loading="lazy" />}
            <p className="role-org">{entry.institution}</p>
          </div>
          <p className="meta">
            {formatRoleDates(entry)} · {entry.location}
          </p>
          <ul className="bullets">
            {entry.achievements.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

export function ContactLinks() {
  return (
    <ul className="contact-list">
      {profile.contact.map((c) => (
        <li key={c.label}>
          <a href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
            {c.label}
          </a>
        </li>
      ))}
      <li>
        <a href={profile.resumeUrl} download>
          Résumé (PDF)
        </a>
      </li>
    </ul>
  );
}

function AboutPanel() {
  const navigate = usePortfolio((s) => s.navigate);
  return (
    <>
      <p className="eyebrow">{profile.headline}</p>
      <p>{profile.pitch}</p>
      <div className="panel-actions">
        <button type="button" onClick={() => navigate({ section: 'experience' })}>
          Go to the Career Tower
        </button>
        <a className="button-link" href={profile.resumeUrl} download>
          Download résumé (PDF)
        </a>
      </div>
    </>
  );
}

export function PanelContent({ selection }: { selection: Selection }) {
  const tower = selection.section === 'about' ? null : TOWER_NAMES[selection.section];
  return (
    <>
      {tower && <p className="eyebrow">{tower}</p>}
      {(() => {
        switch (selection.section) {
          case 'about':
            return <AboutPanel />;
          case 'experience':
            return <ExperiencePanel activeId={selection.itemId} />;
          case 'research':
            return <ResearchList activeId={selection.itemId} />;
          case 'projects':
            return <ProjectList activeId={selection.itemId} />;
          case 'education':
            return <EducationList activeId={selection.itemId} />;
          case 'contact':
            return <ContactLinks />;
        }
      })()}
    </>
  );
}
