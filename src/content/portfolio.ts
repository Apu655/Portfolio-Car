// Single source of portfolio content. Both the 3D city and the quick view render from this file.
// The career role's title and dates are real; everything marked "Placeholder" is waiting for your content.

/** Year and month, e.g. "2023-11". */
export type YearMonth = `${number}-${number}`;

export interface Role {
  title: string;
  organization: string;
  location: string;
  start: YearMonth;
  /** null means "Present". */
  end: YearMonth | null;
  summary: string;
  responsibilities: string[];
  achievements: string[];
  skills: string[];
}

export const RESEARCH_THEMES = ['Healthcare AI', 'NLP', 'LLM research'] as const;
export type ResearchTheme = (typeof RESEARCH_THEMES)[number];

export interface Paper {
  id: string;
  title: string;
  authors: string;
  venue: string;
  year: number;
  theme: ResearchTheme;
  abstract: string;
  link: string;
}

export interface Project {
  id: string;
  name: string;
  year: number;
  description: string;
  technologies: string[];
  /** Live demo URL, when there is one. */
  demo?: string;
  repo: string;
}

export interface Education {
  id: string;
  degree: string;
  institution: string;
  location: string;
  start: YearMonth;
  end: YearMonth | null;
  achievements: string[];
}

export interface ContactLink {
  label: string;
  href: string;
}

export interface Profile {
  name: string;
  headline: string;
  pitch: string;
  resumeUrl: string;
  contact: ContactLink[];
}

export const profile: Profile = {
  name: 'Your Name',
  headline: 'Software Engineer – AI · Healthcare AI, NLP & LLM research',
  pitch:
    'I build AI systems that hold up in production, and I study how language models can be made reliable enough for healthcare. (Placeholder pitch — replace with your own.)',
  resumeUrl: '/resume.pdf',
  contact: [
    { label: 'Email', href: 'mailto:you@example.com' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/your-handle' },
    { label: 'GitHub', href: 'https://github.com/your-handle' },
  ],
};

export const role: Role = {
  title: 'Software Engineer – AI',
  organization: 'Placeholder Company',
  location: 'City, Country',
  start: '2023-11',
  end: '2026-07',
  summary: 'Placeholder: designed, shipped, and operated AI features end to end.',
  responsibilities: [
    'Placeholder: owned the LLM-powered document understanding pipeline from prototype to production',
    'Placeholder: built evaluation harnesses and guardrails for model quality and safety',
    'Placeholder: partnered with clinicians and product teams to turn research into features',
  ],
  achievements: [
    'Placeholder: cut inference cost by 40% with batching and model distillation',
    'Placeholder: raised extraction accuracy from 82% to 94% on a held-out clinical benchmark',
    'Placeholder: mentored 3 engineers and led the team’s ML reliability practice',
  ],
  skills: ['Python', 'PyTorch', 'LLMs', 'NLP', 'TypeScript', 'MLOps'],
};

export const papers: Paper[] = [
  {
    id: 'clinical-notes-llm',
    title: 'Placeholder: Structured Extraction from Clinical Notes with Small Language Models',
    authors: 'Your Name, A. Collaborator',
    venue: 'Placeholder Workshop on Clinical NLP',
    year: 2025,
    theme: 'Healthcare AI',
    abstract: 'Placeholder abstract: an evaluation of compact models for extracting medications and diagnoses.',
    link: 'https://doi.org/10.0000/placeholder-1',
  },
  {
    id: 'multilingual-ner',
    title: 'Placeholder: Low-Resource Named Entity Recognition Across Languages',
    authors: 'Your Name, B. Coauthor',
    venue: 'Placeholder NLP Conference',
    year: 2024,
    theme: 'NLP',
    abstract: 'Placeholder abstract: transfer learning for entity recognition with fewer than 1,000 labeled examples.',
    link: 'https://doi.org/10.0000/placeholder-2',
  },
  {
    id: 'llm-calibration',
    title: 'Placeholder: When Should a Language Model Say “I Don’t Know”?',
    authors: 'Your Name, C. Researcher',
    venue: 'Placeholder (preprint)',
    year: 2026,
    theme: 'LLM research',
    abstract: 'Placeholder abstract: calibration and abstention for LLMs answering high-stakes questions.',
    link: 'https://arxiv.org/abs/0000.00000',
  },
];

export const projects: Project[] = [
  {
    id: 'career-city',
    name: 'Career City (this site)',
    year: 2026,
    description: 'A drivable 3D portfolio built with React Three Fiber, with a fast conventional quick view.',
    technologies: ['React', 'Three.js', 'TypeScript'],
    repo: 'https://github.com/your-handle/portfolio',
  },
  {
    id: 'triage-assistant',
    name: 'Placeholder: Triage Assistant',
    year: 2025,
    description: 'Placeholder: an LLM assistant that drafts triage summaries for clinicians to review.',
    technologies: ['Python', 'FastAPI', 'LLMs'],
    demo: 'https://example.com/demo',
    repo: 'https://github.com/your-handle/triage-assistant',
  },
  {
    id: 'eval-kit',
    name: 'Placeholder: Eval Kit',
    year: 2024,
    description: 'Placeholder: an open-source toolkit for regression-testing prompts and models.',
    technologies: ['TypeScript', 'Node.js'],
    repo: 'https://github.com/your-handle/eval-kit',
  },
];

export const education: Education[] = [
  {
    id: 'msc',
    degree: 'Placeholder: M.Sc. in Computer Science (AI)',
    institution: 'Placeholder University',
    location: 'City, Country',
    start: '2021-09',
    end: '2023-06',
    achievements: ['Placeholder: thesis on clinical language models', 'Placeholder: graduated with distinction'],
  },
  {
    id: 'bsc',
    degree: 'Placeholder: B.Sc. in Computer Science',
    institution: 'Placeholder Institute of Technology',
    location: 'City, Country',
    start: '2017-09',
    end: '2021-06',
    achievements: ['Placeholder: Dean’s list', 'Placeholder: ACM programming contest finalist'],
  },
];
