// content/site.ts
// Single source of truth for all copy on the Gabriel Capital Labs site.
// Components are purely presentational — they read from here, never invent copy.

export type ContactCategory = {
  label: string;
  description: string;
};

export type Pillar = {
  numeral: string;
  title: string;
  definition: string;
};

export type EcosystemDomain = {
  numeral: string;
  name: string;
  designation: string;
  status: string;
  description: string;
  link?: { label: string; href: string };
};

export type LabDomain = {
  numeral: string;
  title: string;
};

export type Principle = {
  numeral: string;
  title: string;
  statement: string;
};

// ---------------------------------------------------------------------------
// Contact resolution — never invent an address. Read from env, else the
// literal placeholder the spec mandates.
// ---------------------------------------------------------------------------
const CONTACT_PLACEHOLDER = "[contact email pending]";
export const contactEmail: string =
  process.env.NEXT_PUBLIC_GCL_CONTACT_EMAIL || CONTACT_PLACEHOLDER;
export const contactHref: string =
  contactEmail === CONTACT_PLACEHOLDER ? "#contact" : `mailto:${contactEmail}`;
export const contactIsPlaceholder = contactEmail === CONTACT_PLACEHOLDER;

// ---------------------------------------------------------------------------
// Global
// ---------------------------------------------------------------------------
export const site = {
  name: "Gabriel Capital Labs",
  legalName: "Gabriel Capital Labs, LLC",
  domain: "https://www.gabrielcapitallabs.com",
  wordmarkTop: "GABRIEL",
  wordmarkBottom: "CAPITAL LABS",
  title: "Gabriel Capital Labs — Building Intelligent Infrastructure.",
  description:
    "Gabriel Capital Labs is the parent institution behind intelligent infrastructure — operating systems for credit, intelligence execution, and spatial computing. Building intelligent infrastructure. Engineering the future of intelligence.",
  tagline: [
    "Building Intelligent Infrastructure.",
    "Engineering the Future of Intelligence.",
  ],
};

// ---------------------------------------------------------------------------
// Chapter 1 — Arrival
// ---------------------------------------------------------------------------
export const arrival = {
  scrollCue: "Enter",
  skipLabel: "Skip",
  replayLabel: "Replay arrival",
  markAlt:
    "The Gateway G — the monolithic mark of Gabriel Capital Labs, golden light rising from its open gateway floor.",
};

// ---------------------------------------------------------------------------
// Chapter 2 — The Institution
// ---------------------------------------------------------------------------
export const institution = {
  chapterMark: "01 — The Institution",
  // Verbatim statement, split into lines for the staggered scroll reveal —
  // concatenating headingLines with single spaces reproduces the statement exactly.
  headingLines: [
    "Gabriel Capital Labs is the parent institution",
    "behind intelligent infrastructure — operating systems",
    "for credit, intelligence execution, and spatial computing.",
  ],
  paragraphs: [
    "We operate on the timeline of institutions, not release cycles — building the foundational systems that intelligent industries will run on for decades, not the quarter.",
    "Research comes first, engineering discipline second, and only then the product surface. Every system we ship is built to be depended upon.",
  ],
};

// ---------------------------------------------------------------------------
// Chapter 3 — Mission Architecture
// ---------------------------------------------------------------------------
export const mission = {
  chapterMark: "02 — Mission Architecture",
  pillars: [
    {
      numeral: "01",
      title: "INTELLIGENCE",
      definition:
        "We study how intelligence — human and artificial — reasons, decides, and compounds. Every system begins as research before it becomes infrastructure.",
    },
    {
      numeral: "02",
      title: "INFRASTRUCTURE",
      definition:
        "Intelligence without infrastructure is theory. We build the operating systems, execution layers, and platforms that carry intelligence into durable, dependable use.",
    },
    {
      numeral: "03",
      title: "IMPACT",
      definition:
        "Infrastructure without impact is idle. Our systems are measured by the outcomes they compound for the people and institutions that rely on them.",
    },
  ] satisfies Pillar[],
};

// ---------------------------------------------------------------------------
// Chapter 4 — Ecosystem Architecture
// Statuses are exact and locked — never imply availability beyond this.
// ---------------------------------------------------------------------------
export const ecosystem = {
  chapterMark: "03 — Ecosystem Architecture",
  intro: "One parent institution. Four domains.",
  domains: [
    {
      numeral: "01",
      name: "CreditVector",
      designation: "The Credit Operating System",
      status: "Active platform",
      description:
        "A consumer-credit education and intelligence platform, live today.",
      link: { label: "www.creditvector.app", href: "https://www.creditvector.app" },
    },
    {
      numeral: "02",
      name: "GIOS",
      designation: "The Operating System for Intelligence Execution",
      status: "Platform foundation — in development",
      description:
        "The execution layer beneath our intelligent products — under active construction.",
    },
    {
      numeral: "03",
      name: "HELIOS",
      designation: "Spatial Operating Environment",
      status: "Research program",
      description:
        "Early-stage research into spatial computing as a substrate for intelligent systems.",
    },
    {
      numeral: "04",
      name: "Kai",
      designation: "Chief Intelligence presence across products",
      status: "Active within CreditVector; expanding across the ecosystem",
      description:
        "The intelligence presence guiding users inside our live products today, extending to the rest of the ecosystem over time.",
    },
  ] satisfies EcosystemDomain[],
};

// ---------------------------------------------------------------------------
// Chapter 5 — The Lab
// ---------------------------------------------------------------------------
export const lab = {
  chapterMark: "04 — The Lab",
  intro: "Seven domains of research and engineering.",
  domains: [
    { numeral: "01", title: "Intelligent operating systems" },
    { numeral: "02", title: "Applied credit intelligence" },
    { numeral: "03", title: "Autonomous execution architecture" },
    { numeral: "04", title: "Spatial computing environments" },
    { numeral: "05", title: "Applied AI research" },
    { numeral: "06", title: "Systems engineering & infrastructure" },
    { numeral: "07", title: "Human-centered intelligence augmentation" },
  ] satisfies LabDomain[],
};

// ---------------------------------------------------------------------------
// Chapter 6 — Principles
// ---------------------------------------------------------------------------
export const principles = {
  chapterMark: "05 — Principles",
  items: [
    { numeral: "01", title: "Intelligence", statement: "We seek truth." },
    { numeral: "02", title: "Infrastructure", statement: "We build enduring systems." },
    { numeral: "03", title: "Innovation", statement: "We create the future." },
    { numeral: "04", title: "Integrity", statement: "We do what is right." },
    { numeral: "05", title: "Impact", statement: "We compound value." },
  ] satisfies Principle[],
};

// ---------------------------------------------------------------------------
// Chapter 7 — Engagement + Footer
// ---------------------------------------------------------------------------
export const engagement = {
  chapterMark: "06 — Engagement",
  heading: "Enter the future we are engineering.",
  categories: [
    { label: "Partnerships", description: "Institutional and platform partnerships." },
    { label: "Research", description: "Collaboration across our research programs." },
    { label: "Enterprise collaboration", description: "Enterprise-scale engagement." },
    {
      label: "Investment & strategic relationships",
      description: "Investment and strategic relationships.",
    },
    { label: "Careers", description: "Building the team behind the institution." },
    { label: "General inquiries", description: "All other inquiries." },
  ] satisfies ContactCategory[],
};

export const footer = {
  legalLine: "Gabriel Capital Labs, LLC",
  creditVectorLinkLabel: "www.creditvector.app",
  creditVectorLinkHref: "https://www.creditvector.app",
};
