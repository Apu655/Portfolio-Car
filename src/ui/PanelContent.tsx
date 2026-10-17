import { papers, profile, projects, roles, type Role } from '../content/portfolio';
import { formatRoleDates, formatRoleDuration } from '../content/format';
import type { Selection } from '../state/route';
import { usePortfolio } from '../state/store';

/** Readable content for one portfolio place. Shared by the 3D info panel. */

export function panelTitle(selection: Selection): string {
  switch (selection.section) {
    case 'about':
      return profile.name;
    case 'experience':
      return roles.find((r) => r.id === selection.itemId)?.title ?? 'Experience';
    case 'research':
      return 'Research';
    case 'projects':
      return 'Projects';
    case 'contact':
      return 'Contact';
  }
}

export function RoleDetails({ role }: { role: Role }) {
  return (
    <>
      <p className="role-org">{role.organization}</p>
      <p className="role-dates">
        <time dateTime={role.start}>{formatRoleDates(role)}</time>
        <span aria-hidden="true"> · </span>
        <span>{formatRoleDuration(role)}</span>
        <span aria-hidden="true"> · </span>
        <span>{role.location}</span>
      </p>
      <p>{role.summary}</p>
      <h3>Achievements</h3>
      <ul className="achievements">
        {role.achievements.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
      <ul className="tags" aria-label="Skills">
        {role.skills.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </>
  );
}

function RolePanel({ role }: { role: Role }) {
  const navigate = usePortfolio((s) => s.navigate);
  const index = roles.indexOf(role);
  const below = roles[index - 1];
  const above = roles[index + 1];
  return (
    <>
      <p className="eyebrow">
        Floor {index + 1} of {roles.length}
      </p>
      <RoleDetails role={role} />
      <div className="panel-actions">
        <button type="button" disabled={!below} onClick={() => below && navigate({ section: 'experience', itemId: below.id })}>
          ↓ Earlier role
        </button>
        <button type="button" onClick={() => navigate({ section: 'experience' })}>
          All roles
        </button>
        <button type="button" disabled={!above} onClick={() => above && navigate({ section: 'experience', itemId: above.id })}>
          Later role ↑
        </button>
      </div>
    </>
  );
}

function ExperienceOverview() {
  const navigate = usePortfolio((s) => s.navigate);
  return (
    <>
      <p>Each floor of the Career Tower is one role, oldest at the bottom. Pick a floor:</p>
      <ol className="item-list" reversed>
        {[...roles].reverse().map((role) => (
          <li key={role.id}>
            <button type="button" className="item-button" onClick={() => navigate({ section: 'experience', itemId: role.id })}>
              <strong>{role.title}</strong>
              <span>
                {role.organization} · {formatRoleDates(role)}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}

function ResearchPanel({ activeId }: { activeId?: string }) {
  return (
    <ul className="item-list">
      {papers.map((paper) => (
        <li key={paper.id} className={paper.id === activeId ? 'is-active' : undefined}>
          <h3>{paper.title}</h3>
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
  );
}

function ProjectsPanel({ activeId }: { activeId?: string }) {
  return (
    <ul className="item-list">
      {projects.map((project) => (
        <li key={project.id} className={project.id === activeId ? 'is-active' : undefined}>
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
      ))}
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
          Fly to my experience
        </button>
        <a className="button-link" href={profile.resumeUrl} download>
          Download résumé (PDF)
        </a>
      </div>
    </>
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
    </ul>
  );
}

export function PanelContent({ selection }: { selection: Selection }) {
  switch (selection.section) {
    case 'about':
      return <AboutPanel />;
    case 'experience': {
      const role = roles.find((r) => r.id === selection.itemId);
      return role ? <RolePanel role={role} /> : <ExperienceOverview />;
    }
    case 'research':
      return <ResearchPanel activeId={selection.itemId} />;
    case 'projects':
      return <ProjectsPanel activeId={selection.itemId} />;
    case 'contact':
      return <ContactLinks />;
  }
}
