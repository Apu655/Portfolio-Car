import { education, papers, projects } from '../content/portfolio';

export type View = '3d' | 'basic';

export const SECTIONS = ['about', 'experience', 'research', 'projects', 'education', 'contact'] as const;
export type Section = (typeof SECTIONS)[number];

export const SECTION_LABELS: Record<Section, string> = {
  about: 'About',
  experience: 'Experience',
  research: 'Research',
  projects: 'Projects',
  education: 'Education',
  contact: 'Contact',
};

/** Where the visitor is: a section, optionally one item inside it (a paper, project, or qualification). */
export interface Selection {
  section: Section;
  itemId?: string;
}

export interface Route {
  /** null when the URL does not say which view to use. */
  view: View | null;
  selection: Selection | null;
}

const ITEM_IDS: Partial<Record<Section, Set<string>>> = {
  research: new Set(papers.map((p) => p.id)),
  projects: new Set(projects.map((p) => p.id)),
  education: new Set(education.map((e) => e.id)),
};

function isSection(value: string): value is Section {
  return (SECTIONS as readonly string[]).includes(value);
}

/** Parses "#/3d/research/llm-calibration" style hashes. Unknown parts are dropped, never thrown. */
export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  let view: View | null = null;
  if (parts[0] === '3d' || parts[0] === 'basic') {
    view = parts.shift() as View;
  }
  const [section, itemId] = parts;
  if (!section || !isSection(section)) return { view, selection: null };
  const validItem = itemId && ITEM_IDS[section]?.has(itemId) ? itemId : undefined;
  return { view, selection: validItem ? { section, itemId: validItem } : { section } };
}

export function formatHash(view: View, selection: Selection | null): string {
  const parts: string[] = [view];
  if (selection) {
    parts.push(selection.section);
    if (selection.itemId) parts.push(encodeURIComponent(selection.itemId));
  }
  return `#/${parts.join('/')}`;
}

export function sameSelection(a: Selection | null, b: Selection | null): boolean {
  return a?.section === b?.section && a?.itemId === b?.itemId;
}

/** DOM id used by the basic view for a section or item, so both views agree on "where you are". */
export function anchorId(selection: Selection): string {
  return selection.itemId ? `${selection.section}-${selection.itemId}` : selection.section;
}
