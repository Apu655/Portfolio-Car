// What each section's gate screens cycle through: one entry per item, with the image, title, and one-line
// description a passing driver can read. Built from the portfolio content, so the two never drift.
import type { Section } from '../state/route';
import { education, papers, profile, projects, roles } from './portfolio';

export interface ShowcaseItem {
  /** The item a click on the screen opens (absent for contact entries, which open the Contact panel). */
  itemId?: string;
  title: string;
  subtitle: string;
  line: string;
  image?: string;
}

export type ShowcaseSection = Exclude<Section, 'about'>;

export const SHOWCASE: Record<ShowcaseSection, ShowcaseItem[]> = {
  experience: roles.map((r) => ({ itemId: r.id, title: r.organization, subtitle: r.title, line: r.tagline, image: r.logo })),
  research: papers.map((p) => ({ itemId: p.id, title: p.title, subtitle: `${p.status} · ${p.year}`, line: p.tagline, image: p.image })),
  projects: projects.map((p) => ({ itemId: p.id, title: p.name, subtitle: p.technologies.slice(0, 4).join(' · '), line: p.tagline, image: p.image })),
  education: education.map((e) => ({ itemId: e.id, title: e.institution, subtitle: e.degree, line: e.tagline, image: e.logo })),
  contact: [
    ...profile.contact.map((c) => ({ title: c.label, subtitle: c.href.replace(/^mailto:|^https?:\/\//, ''), line: 'Say hello — I read everything.' })),
    { title: 'Résumé', subtitle: 'PDF', line: 'Download the full CV from the Contact panel.' },
  ],
};
