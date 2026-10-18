// Single source of portfolio content. The 3D district, its gate screens, and the quick view all render from this
// file. Content comes from Apu's CV and project list; images live in public/showcase/ (see scripts/build-showcase.mjs).

/** Year and month ("2023-11"), or a year alone ("2026") when the month is not known. */
export type YearMonth = `${number}-${number}` | `${number}`;

export interface Link {
  label: string;
  href: string;
}

export interface Role {
  id: string;
  title: string;
  organization: string;
  location?: string;
  start: YearMonth;
  /** null means "Present". */
  end: YearMonth | null;
  /** One line for the gate screens. */
  tagline: string;
  summary: string;
  responsibilities: string[];
  achievements: string[];
  technologies: string[];
  links: Link[];
  /** Organization logo, served from public/. */
  logo?: string;
}

export const RESEARCH_THEMES = ['LLM research', 'NLP', 'Healthcare AI', 'Computer vision'] as const;
export type ResearchTheme = (typeof RESEARCH_THEMES)[number];

export type PaperStatus = 'Published' | 'Under review' | 'In preparation' | 'In progress';

export interface Paper {
  id: string;
  title: string;
  authors: string;
  venue: string;
  year: number;
  status: PaperStatus;
  theme: ResearchTheme;
  /** One line for the gate screens. */
  tagline: string;
  abstract: string;
  link?: string;
  image?: string;
}

export interface Project {
  id: string;
  name: string;
  /** One line for the gate screens. */
  tagline: string;
  description: string;
  technologies: string[];
  image?: string;
  /** Live demo URL, when there is one. */
  demo?: string;
  repo?: string;
}

export interface Education {
  id: string;
  degree: string;
  institution: string;
  location: string;
  start: YearMonth;
  end: YearMonth | null;
  /** One line for the gate screens. */
  tagline: string;
  achievements: string[];
  logo?: string;
}

export type ContactLink = Link;

export interface Profile {
  name: string;
  headline: string;
  pitch: string;
  resumeUrl: string;
  contact: ContactLink[];
  /** The tech stack on the footballs in the pitch near the start. */
  skills: string[];
}

export const profile: Profile = {
  name: 'Apu Islam',
  headline: 'Software Engineer – AI · Machine learning, NLP & human–AI interaction research',
  pitch:
    'I build machine-learning products used by hundreds of thousands of people, and I research how AI can be more reliable and accessible, from LLM prompting in Bangla to safer healthcare chatbots. I start a Master of Artificial Intelligence at Monash University in 2026.',
  resumeUrl: '/resume.pdf',
  // LinkedIn and Google Scholar are named in the CV without URLs; add them here once known.
  contact: [
    { label: 'Email', href: 'mailto:opu.razzak@gmail.com' },
    { label: 'GitHub', href: 'https://github.com/Apu655' },
  ],
  skills: ['Python', 'JavaScript', 'TypeScript', 'Java', 'SQL', 'React', 'FastAPI', 'TensorFlow'],
};

/** Roles, most significant first: the first one is featured in the Career Tower. */
export const roles: Role[] = [
  {
    id: 'metlife',
    title: 'Software Engineer – AI',
    organization: 'MetLife',
    location: 'Dhaka, Bangladesh',
    start: '2023-11',
    end: '2026-07',
    tagline: 'ML for agent retention and next-sale prediction; shipped “One by MetLife” to 500K+ customers.',
    summary:
      'Executive Officer (Software Engineer AI) building machine-learning features and the services that put them in front of customers.',
    responsibilities: [
      'Built an AI-based agent retention and next-sale prediction system with XGBoost and Random Forest, reaching the best accuracy with Random Forest.',
      'Researched and experimented with novel ML algorithms from recent publications to drive AI-driven feature enhancements.',
      'Worked on data preprocessing pipelines, feature engineering, and model versioning.',
      'Exposed ML models through FastAPI services and maintained Java Spring Boot and .NET 8 microservices.',
    ],
    achievements: [
      'Delivered the “One by MetLife” app and web portal, serving over 500,000 customers in Bangladesh.',
      'MetLife 2024 Q3 Significant Collaboration Award for leading the launch of MetLife’s first AI-driven health application, “One by MetLife”, in Bangladesh.',
      'Joined after an exceptional performance in the MetLife Hack4Job 2022 Asia Regional Hackathon, the youngest recipient of its job offer in Asia.',
    ],
    technologies: ['Python', 'XGBoost', 'Random Forest', 'FastAPI', 'Java Spring Boot', '.NET 8', 'Feature engineering'],
    links: [],
    logo: '/showcase/metlife-logo.jpg',
  },
  {
    id: 'george-mason',
    title: 'Research Intern (Remote)',
    organization: 'George Mason University',
    start: '2025-10',
    end: '2026-02',
    tagline: 'Accessibility, security, and usability of healthcare chatbots.',
    summary: 'Studied where healthcare chatbots fail their users and built one that addresses those failures.',
    responsibilities: [
      'Analyzed the accessibility, security, and usability of healthcare chatbots and addressed their core issues.',
      'Developed a healthcare chatbot that fixes existing accessibility issues and provides a stable experience.',
    ],
    achievements: [],
    technologies: ['Conversational AI', 'Accessibility', 'User studies'],
    links: [],
  },
  {
    id: 'sysonex',
    title: 'Team Lead',
    organization: 'Sysonex Development Limited',
    start: '2022-08',
    end: '2024-07',
    tagline: 'Led the team behind AI risk-management software, growing revenue from 0 to ~150K CAD.',
    summary: 'Led front-end and design work on enterprise AI risk-management software.',
    responsibilities: [
      'Developed AI risk-management enterprise software with React and Tailwind CSS.',
      'Implemented an AI-generated risk-management system to improve project decision-making and mitigate risks.',
      'Led the front-end and design team building interactive, accessible user interfaces.',
    ],
    achievements: ['Led a team that grew the company’s revenue from 0 CAD to approximately 150K CAD.'],
    technologies: ['React', 'Tailwind CSS', 'AI risk modelling'],
    links: [],
    logo: '/showcase/sysonex-logo.jpg',
  },
  {
    id: 'brac-ta',
    title: 'Teaching Assistant',
    organization: 'BRAC University',
    location: 'Dhaka, Bangladesh',
    start: '2022-10',
    end: '2023-04',
    tagline: 'Mathematics and Natural Science Department: consultations, grading, and exams.',
    summary: 'Teaching assistant in the Mathematics and Natural Science Department.',
    responsibilities: [
      'Provided consultations to help students understand course material.',
      'Assisted faculty with preparing assignments and grading sheets.',
      'Evaluated assignments against the established grading rubric and supervised exams.',
    ],
    achievements: [],
    technologies: ['Teaching', 'Assessment'],
    links: [],
    logo: '/showcase/brac-logo.png',
  },
];

/** The featured role, shown first in the Career Tower. */
export const role: Role = roles[0];

export const papers: Paper[] = [
  {
    id: 'bangla-news-prompting',
    title: 'A Comparative Analysis of Prompting Regimes and Instruction Languages for Bangla News Classification',
    authors: 'Apu Islam et al.',
    venue: '29th International Conference on Computer and Information Technology (ICCIT)',
    year: 2026,
    status: 'Under review',
    theme: 'LLM research',
    tagline: 'Four open LLMs, zero- to few-shot, English vs Bangla instructions: prompting narrows but does not close the gap to fine-tuning.',
    abstract:
      'A controlled 3 × 2 evaluation of Qwen2.5-7B, Llama-3.1-8B, Gemma-2-9B, and TigerLLM-1B on 2,381 Bangla news headlines. The best prompted setup (Gemma-2-9B, Bangla few-shot, 0.871 accuracy) still trails a fine-tuned BanglaBERT (0.945), and extra demonstrations can hurt: Llama-3.1-8B fell from 0.694 to 0.507 under Bangla few-shot prompting.',
  },
  {
    id: 'bsl-avatar-tutor',
    title: 'A Smart Avatar Tutor for Mimicking Characters of Bangla Sign Language',
    authors: 'Apu Islam (first author) et al.',
    venue: 'International Conference on Robotics, Electrical and Signal Processing Techniques (ICREST)',
    year: 2025,
    status: 'Published',
    theme: 'Computer vision',
    tagline: 'An avatar tutor that teaches all 49 Bangla Sign Language characters, with real-time YOLOv8 recognition.',
    abstract:
      'A Smart Avatar Tutor that teaches Bangla Sign Language by mimicking its 49 characters, trained on hand-gesture images with a YOLOv8 Nano model for accurate real-time detection, to support communication for the hearing-impaired community.',
  },
  {
    id: 'mental-health-classification',
    title: 'Which Matters More — Model or Language? An Empirical Study in English–Bangla Mental Health Classification',
    authors: 'Apu Islam (first author) et al.',
    venue: '5th International Conference on Robotics, Automation, and Artificial Intelligence (RAAI)',
    year: 2025,
    status: 'Published',
    theme: 'NLP',
    tagline: 'Matching the model to the language matters most: RoBERTa leads in English, BanglaBERT in Bangla.',
    abstract:
      'Compares classical machine-learning models with transformer encoders for classifying mental-health status in English and Bangla. Language–model alignment dominated performance: RoBERTa performed best on English and BanglaBERT on Bangla.',
  },
  {
    id: 'rice-leaf-disease',
    title: 'Rice Leaf Disease Classification: A Comparative Evaluation of CNNs and Vision Transformers',
    authors: 'Apu Islam (first author) et al.',
    venue: '28th International Conference on Computer and Information Technology (ICCIT)',
    year: 2025,
    status: 'Published',
    theme: 'Computer vision',
    tagline: 'CNNs vs vision transformers for rice leaf disease, plus a smaller, faster quantized model with Grad-CAM.',
    abstract:
      'Compares CNN and vision-transformer models for rice leaf disease classification and proposes a smaller, faster model using transfer learning and quantization, with Grad-CAM explanations of the features behind each prediction.',
  },
  {
    id: 'secarely',
    title: 'SeCAREly: Enhancing Security, Privacy, and Accessibility in Healthcare Chatbots',
    authors: 'Apu Islam (first author) et al.',
    venue: 'ACM CHI 2027 (poster, in preparation)',
    year: 2027,
    status: 'In preparation',
    theme: 'Healthcare AI',
    tagline: '61 healthcare chatbots audited, then a safer conversational agent built and tested with users.',
    abstract:
      'Analyzes 61 healthcare chatbots for security, privacy, accessibility, and UI issues, then develops and deploys a conversational AI agent and evaluates its impact in a user study.',
    image: '/showcase/secarely-chat.jpg',
  },
  {
    id: 'healthcare-chatbot-risks',
    title: 'Hidden Risks in Healthcare Chatbots Focusing on Security, Privacy, and Accessibility Dimensions',
    authors: 'Apu Islam et al.',
    venue: 'ICCIS',
    year: 2026,
    status: 'Under review',
    theme: 'Healthcare AI',
    tagline: 'How security, privacy, UI, and accessibility problems travel together across 61 healthcare chatbots.',
    abstract:
      'Analyzes 61 healthcare chatbots for security, privacy, accessibility, and UI issues and uses Pearson correlation to show how those dimensions relate.',
  },
  {
    id: 'histdnet',
    title: 'HistDNet: Stable Diffusion Network for Cancer Classification from Histopathological Images',
    authors: 'Apu Islam et al.',
    venue: 'Current research',
    year: 2026,
    status: 'In progress',
    theme: 'Healthcare AI',
    tagline: 'Searching for the best architecture to classify cancer from histopathological images.',
    abstract: 'Exploring architectures to classify cancer from histopathological images, compared against baseline models.',
  },
  {
    id: 'bangla-news-summarization',
    title: 'Leveraging Pretrained Transformers for Summarizing Bangla News Datasets',
    authors: 'Apu Islam et al.',
    venue: 'Current research',
    year: 2026,
    status: 'In progress',
    theme: 'NLP',
    tagline: 'Comparing pretrained transformers on Bangla news summarization with BLEU and ROUGE.',
    abstract: 'An early-stage comparison of pretrained transformer models on a Bangla news summarization dataset, measured with BLEU and ROUGE.',
  },
  {
    id: 'sentiment-review',
    title: 'Systematic Review of AI and Machine Learning Techniques for Sentiment Analysis',
    authors: 'Apu Islam et al.',
    venue: 'Q1 journal (draft ready)',
    year: 2026,
    status: 'In preparation',
    theme: 'NLP',
    tagline: '70+ peer-reviewed studies reviewed for trends, gaps, and future directions in sentiment analysis.',
    abstract:
      'A literature review of more than 70 peer-reviewed studies on sentiment analysis, synthesizing trends, challenges, and emerging AI/ML techniques to identify gaps and future research directions.',
  },
];

export const projects: Project[] = [
  {
    id: 'movie-streaming',
    name: 'Movie Streaming Site',
    tagline: 'A streaming front end with genre rows, trending and top-rated picks.',
    description:
      'A Netflix-style movie site: browse trending, top-rated, and genre rows, search titles, and open a detail page for each film, backed by a Node and Express API over MySQL.',
    technologies: ['React JS', 'Next JS', 'Tailwind CSS', 'Node JS', 'Express JS', 'MySQL'],
    image: '/showcase/movie-site.jpg',
  },
  {
    id: 'railway-management',
    name: 'Railway Management System',
    tagline: 'Book Bangladesh Railway tickets by route, passengers, and class.',
    description:
      'Train ticket booking for Bangladesh Railway: pick the departure and arrival stations, passenger count, and class, then search and book seats, with an account area for travellers.',
    technologies: ['HTML', 'CSS', 'Bootstrap', 'Django', 'MySQL'],
    image: '/showcase/railway-system.jpg',
  },
  {
    id: 'online-learning',
    name: 'Online Learning Platform',
    tagline: 'Browse, search, and enroll in web-development courses.',
    description:
      'A course marketplace where learners search and enroll in courses such as Django, HTML, and CSS mastery, with instructor pages and a questions board.',
    technologies: ['HTML', 'CSS', 'Bootstrap', 'Django', 'MySQL'],
    image: '/showcase/learning-platform.jpg',
  },
  {
    id: 'ecommerce',
    name: 'E-commerce Site',
    tagline: 'A product catalog, cart, and checkout on a Django REST API.',
    description:
      'An online store with a browsable product catalog, cart, and checkout, with a React front end talking to a Django REST Framework API over MySQL.',
    technologies: ['React JS', 'CSS', 'Bootstrap', 'Django REST framework', 'MySQL'],
    image: '/showcase/ecommerce.jpg',
  },
  {
    id: 'ai-image-generator',
    name: 'AI Image Generator',
    tagline: 'Type a prompt, get an image from the OpenAI API, share it.',
    description:
      'Write a prompt (or hit “Surprise me”), generate an image with the OpenAI API, and post it to a shared community gallery.',
    technologies: ['React JS', 'CSS', 'Node JS', 'Express JS', 'OpenAI API'],
    image: '/showcase/image-generator.jpg',
  },
  {
    id: 'instagram-clone',
    name: 'Instagram Clone',
    tagline: 'A photo feed with posts, likes, and comments on Firebase.',
    description: 'An Instagram-style photo feed with sign-in, image posts, likes, and comments, built on Next.js with Firebase for auth, storage, and data.',
    technologies: ['Next JS', 'Tailwind CSS', 'Firebase'],
    image: '/showcase/instagram-clone.jpg',
  },
  {
    id: 'linkedin-clone',
    name: 'LinkedIn Clone',
    tagline: 'A professional feed with posts and profiles on Firebase.',
    description: 'A LinkedIn-style professional feed with posts, reactions, and profile pages, built on Next.js with Firebase.',
    technologies: ['Next JS', 'Tailwind CSS', 'Firebase'],
    image: '/showcase/linkedin-clone.jpg',
  },
];

export const education: Education[] = [
  {
    id: 'monash-mai',
    degree: 'Master of Artificial Intelligence',
    institution: 'Monash University',
    location: 'Clayton, Australia',
    start: '2026',
    end: '2027',
    tagline: 'Master of Artificial Intelligence, starting 2026.',
    achievements: ['Key courses: IT Research and Innovation, Fundamentals of AI'],
  },
  {
    id: 'bracu-bsc',
    degree: 'B.Sc. in Computer Science',
    institution: 'BRAC University',
    location: 'Dhaka, Bangladesh',
    start: '2020',
    end: '2024',
    tagline: 'B.Sc. in Computer Science, graduated with distinction (CGPA 3.59).',
    achievements: [
      'Graduated with distinction, CGPA 3.59 / 4.00',
      'Thesis: A Smart Avatar Tutor for Mimicking Characters of Bangla Sign Language (supervisor: Md. Golam Rabiul Alam, PhD)',
      'Key courses: Artificial Intelligence, Natural Language Processing, Data Science',
      'Web developer for BRACU Team Dichari, the first team from Bangladesh to reach the European Robotics League final',
    ],
    logo: '/showcase/brac-logo.png',
  },
];
