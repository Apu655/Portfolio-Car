import { education, papers, profile, projects, RESEARCH_THEMES, role, type Role } from '../content/portfolio';
import { formatRoleDates, formatRoleDuration } from '../content/format';
import type { Selection } from '../state/route';
import { usePortfolio } from '../state/store';

/** Readable content for each portfolio place. Shared by the 3D info panel and the quick view. */

/** What each stop is called in the HUD, menu, and quick view. The employer appears only inside the Career panel. */
export const TOWER_NAMES: Record<Exclude<Selection['section'], 'about'>, string> = {
  experience: 'Career Tower',
  research: 'Research kiosk',
  projects: 'Projects kiosk',
  education: 'Education kiosk',
  contact: 'Contact kiosk',
};

export function panelTitle(selection: Selection): string {
  switch (selection.section) {
    case 'about':
      return profile.name;
    case 'experience':
      return role.title;
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
      <p className="role-org">{r.organization}</p>
      <p className="role-dates">
        <time dateTime={r.start}>{formatRoleDates(r)}</time>
        <span aria-hidden="true"> · </span>
        <span>{formatRoleDuration(r)}</span>
        <span aria-hidden="true"> · </span>
        <span>{r.location}</span>
      </p>
      <p>{r.summary}</p>
      <h3>Responsibilities</h3>
      <ul className="bullets">
        {r.responsibilities.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h3>Achievements</h3>
      <ul className="bullets">
        {r.achievements.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
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
                  <h4>{paper.title}</h4>
                  <p className="meta">
                    {paper.authors} — {paper.venue}, {paper.year}
                  </p>
                  <p>{paper.abstract}</p>
                  <a href={paper.link} target="_blank" rel="noreferrer">
                    Read paper
                  </a>
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
          <h4>
            {project.name} <span className="meta">({project.year})</span>
          </h4>
          <p>{project.description}</p>
          <ul className="tags" aria-label="Technologies">
            {project.technologies.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p className="link-row">
            {project.demo && (
              <a href={project.demo} target="_blank" rel="noreferrer">
                Live demo
              </a>
            )}
            <a href={project.repo} target="_blank" rel="noreferrer">
              GitHub repository
            </a>
          </p>
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
          <p className="role-org">{entry.institution}</p>
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
            return <RoleDetails role={role} />;
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
