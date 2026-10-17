// Single source of portfolio content. Both the 3D world and the basic view render from this file.
// Everything here is placeholder content — replace it with your real career data.

/** Year and month, e.g. "2022-04". */
export type YearMonth = `${number}-${number}`;

export interface Role {
  id: string;
  title: string;
  organization: string;
  location: string;
  start: YearMonth;
  /** null means "Present". */
  end: YearMonth | null;
  summary: string;
  achievements: string[];
  skills: string[];
}

export interface Paper {
  id: string;
  title: string;
  authors: string;
  venue: string;
  year: number;
  abstract: string;
  link: string;
}

export interface Project {
  id: string;
  name: string;
  year: number;
  description: string;
  tags: string[];
  link: string;
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
  headline: 'Research Engineer · Gamification & Interactive Systems',
  pitch:
    'I study and build playful systems that change how people learn, work, and collaborate — bridging HCI research and production engineering.',
  resumeUrl: '/resume.pdf',
  contact: [
    { label: 'Email', href: 'mailto:you@example.com' },
    { label: 'GitHub', href: 'https://github.com/your-handle' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/your-handle' },
    { label: 'Google Scholar', href: 'https://scholar.google.com/' },
  ],
};

/** Ordered oldest → newest. The career tower stacks them bottom → top. */
export const roles: Role[] = [
  {
    id: 'research-assistant',
    title: 'Research Assistant',
    organization: 'Placeholder University · HCI Lab',
    location: 'City, Country',
    start: '2018-09',
    end: '2020-06',
    summary: 'Ran user studies on game mechanics for learning platforms.',
    achievements: [
      'Designed and ran 4 controlled studies with 300+ participants',
      'Co-authored 2 peer-reviewed papers on reward schedules',
      'Built the lab’s reusable experiment toolkit in TypeScript',
    ],
    skills: ['User studies', 'Statistics', 'TypeScript'],
  },
  {
    id: 'software-engineer',
    title: 'Software Engineer',
    organization: 'Placeholder Games Studio',
    location: 'City, Country',
    start: '2020-07',
    end: '2022-03',
    summary: 'Shipped gameplay and live-ops features for a mobile title.',
    achievements: [
      'Shipped a seasonal progression system used by 1M+ players',
      'Cut client load time by 40% with asset streaming',
      'Mentored 3 junior engineers',
    ],
    skills: ['Unity', 'C#', 'Live ops'],
  },
  {
    id: 'senior-engineer',
    title: 'Senior Engineer, Gamification',
    organization: 'Placeholder Tech Co.',
    location: 'City, Country',
    start: '2022-04',
    end: '2024-08',
    summary: 'Led the engagement platform powering quests and achievements.',
    achievements: [
      'Led a 6-person team building a quests and achievements platform',
      'Raised 30-day retention by 12% across 3 products',
      'Published an internal playbook on ethical engagement design',
    ],
    skills: ['React', 'Node.js', 'Experimentation'],
  },
  {
    id: 'lead-research-engineer',
    title: 'Lead Research Engineer',
    organization: 'Placeholder Labs',
    location: 'Remote',
    start: '2024-09',
    end: null,
    summary: 'Bridges applied research and product for playful learning tools.',
    achievements: [
      'Set the research roadmap for adaptive game-based learning',
      'Shipped a WebGL learning sandbox to 50k students',
      'Organized a workshop on gamification at a major HCI venue',
    ],
    skills: ['Three.js', 'Research leadership', 'Python'],
  },
];

export const papers: Paper[] = [
  {
    id: 'reward-schedules',
    title: 'Placeholder: Reward Schedules and Persistence in Learning Games',
    authors: 'Your Name, A. Collaborator, B. Advisor',
    venue: 'Placeholder HCI Conference',
    year: 2020,
    abstract: 'A controlled study of how variable reward schedules affect persistence in game-based learning.',
    link: 'https://doi.org/10.0000/placeholder-1',
  },
  {
    id: 'ethical-engagement',
    title: 'Placeholder: Designing for Ethical Engagement',
    authors: 'Your Name, C. Coauthor',
    venue: 'Placeholder Journal of Interactive Systems',
    year: 2023,
    abstract: 'A framework for evaluating gamification features against user wellbeing.',
    link: 'https://doi.org/10.0000/placeholder-2',
  },
  {
    id: 'adaptive-quests',
    title: 'Placeholder: Adaptive Quests for Self-Paced Learners',
    authors: 'Your Name, D. Researcher',
    venue: 'Placeholder Learning @ Scale (preprint)',
    year: 2025,
    abstract: 'An adaptive quest generator that tunes challenge to learner progress.',
    link: 'https://arxiv.org/abs/0000.00000',
  },
];

export const projects: Project[] = [
  {
    id: 'career-cosmos',
    name: 'Career Cosmos (this site)',
    year: 2026,
    description: 'A 3D portfolio built with React Three Fiber, with a fast accessible basic view.',
    tags: ['Three.js', 'React', 'Accessibility'],
    link: 'https://github.com/your-handle/portfolio',
  },
  {
    id: 'quest-engine',
    name: 'Quest Engine',
    year: 2024,
    description: 'An open-source rules engine for quests, streaks, and achievements.',
    tags: ['TypeScript', 'Gamification'],
    link: 'https://github.com/your-handle/quest-engine',
  },
  {
    id: 'math-sandbox',
    name: 'Math Sandbox',
    year: 2025,
    description: 'A browser-based physics playground for teaching vectors through play.',
    tags: ['WebGL', 'Education'],
    link: 'https://github.com/your-handle/math-sandbox',
  },
];
