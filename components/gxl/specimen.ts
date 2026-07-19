// GXL Experience Gallery — SPECIMEN data. Deterministic, hand-written, and
// clearly labeled throughout the UI: this is a language-validation playground,
// never real data (GXL L10 is honored by disclosure — every surface says
// SPECIMEN). Content stays process-language: no outcome promises, no deletion
// claims, no score gains — even fake data holds the compliance bar.

export interface SpecimenEntry {
  id: string;
  no: string; // ledger number, pre-typeset
  title: string;
  excerpt: string;
  filed: string; // display date
  author: string;
  responses: number;
  state: "awaiting" | "in_session" | "closed" | "verified" | "contested";
  kai?: boolean;
  agedNote?: string; // evidence-aging annotation (§9)
}

export interface RoomSpec {
  slug: string;
  name: string;
  question: string; // the one operational question (§3)
  atmosphere: string; // tint class for the field
  rhythm: string; // engraved rhythm line
  field: { total: number; awaiting: number; active: number }; // ambient aggregates (specimen)
  hero: "tape" | "briefing" | "exhibits" | "kai" | "council" | "lab";
}

export const ROOMS: RoomSpec[] = [
  { slug: "mission-control", name: "Mission Control", question: "What is the state of everything?", atmosphere: "from-ocean-500/[0.06]", rhythm: "Steady watch — the room that never closes", field: { total: 84, awaiting: 3, active: 12 }, hero: "tape" },
  { slug: "executive-briefing", name: "Executive Briefing", question: "What happened, and what needs me?", atmosphere: "from-ocean-500/[0.04]", rhythm: "Morning — a reading pace; everything already settled onto the page", field: { total: 22, awaiting: 1, active: 5 }, hero: "briefing" },
  { slug: "evidence-center", name: "Evidence Center", question: "What do we know, and how do we know it?", atmosphere: "from-slate-400/[0.05]", rhythm: "Archival — near-stillness; light moves, content doesn't", field: { total: 61, awaiting: 0, active: 2 }, hero: "exhibits" },
  { slug: "kai-intelligence", name: "Kai Intelligence", question: "What does the intelligence make of this?", atmosphere: "from-brand-500/[0.05]", rhythm: "Reasoning — the sweep's rhythm; motion exactly while thinking", field: { total: 17, awaiting: 1, active: 4 }, hero: "kai" },
  { slug: "strategy-council", name: "Strategy Council", question: "What should we do?", atmosphere: "from-ocean-500/[0.07]", rhythm: "Deliberation — slower cadence, heavier settles", field: { total: 9, awaiting: 1, active: 3 }, hero: "council" },
  { slug: "operations-lab", name: "Operations Lab", question: "What is being worked right now?", atmosphere: "from-gold-500/[0.03]", rhythm: "Work — the fastest honest rhythm in the building", field: { total: 31, awaiting: 4, active: 11 }, hero: "lab" },
];

export const roomBySlug = (slug: string) => ROOMS.find((r) => r.slug === slug) ?? null;

// ── The specimen folio (shared ledger entries, sliced per room) ──────────────
export const ENTRIES: SpecimenEntry[] = [
  { id: "s1", no: "041", title: "Bureau response received — method of verification not disclosed", excerpt: "The reinvestigation returned \"verified\" with no method stated. The §611(a)(7) demand is the documented next step in the record.", filed: "Jul 18", author: "Specimen Operator A", responses: 0, state: "awaiting" },
  { id: "s2", no: "040", title: "Round-two sequencing for a re-aged collection tradeline", excerpt: "Two furnisher statements carry different delinquency dates. The record preserves both; the strategy question is which inconsistency leads.", filed: "Jul 17", author: "Specimen Operator B", responses: 6, state: "in_session", kai: true },
  { id: "s3", no: "039", title: "Chain-of-custody check on the certified-mail receipt", excerpt: "Receipt imaged, dated, and entered. The custody check completed against the mailing log.", filed: "Jul 16", author: "Specimen Operator C", responses: 3, state: "verified" },
  { id: "s4", no: "038", title: "Duplicate reporting question across two bureaus", excerpt: "The same underlying account appears under two names. Both report entries are in the record with their fields side by side.", filed: "Jul 14", author: "Specimen Operator D", responses: 4, state: "in_session" },
  { id: "s5", no: "037", title: "Statutory window tracking for the pending reinvestigation", excerpt: "The 30-day clock is entered from the delivery receipt, not the mailing date. The window closes Aug 09.", filed: "Jul 12", author: "Specimen Operator A", responses: 2, state: "in_session" },
  { id: "s6", no: "036", title: "Older utility tradeline — evidence refresh due", excerpt: "The supporting statement is now four months old. Aging is shown; the refresh task is on the bench.", filed: "Mar 22", author: "Specimen Operator B", responses: 5, state: "closed", agedNote: "evidence aged 4 months — refresh before reliance" },
];

// ── Evidence Center exhibits (the Pull's home; one preserved contradiction) ──
export interface SpecimenExhibit {
  id: string;
  label: string;
  kind: string;
  dated: string;
  state: "verified" | "supported" | "contested" | "aged";
  note: string;
  pairsWith?: string; // the contradiction partner (E4: preserved, never resolved)
}

export const EXHIBITS: SpecimenExhibit[] = [
  { id: "e1", label: "Exhibit A — Certified-mail receipt", kind: "Postal record", dated: "Jul 02", state: "verified", note: "Custody check completed against the mailing log." },
  { id: "e2", label: "Exhibit B — Bureau response letter", kind: "Bureau correspondence", dated: "Jul 15", state: "supported", note: "States \"verified\"; discloses no method. Basis for the §611(a)(7) demand." },
  { id: "e3", label: "Exhibit C — Furnisher statement (March)", kind: "Furnisher record", dated: "Mar 10", state: "contested", note: "Delinquency dated 2019-11. Contradicts Exhibit D; both threads preserved.", pairsWith: "e4" },
  { id: "e4", label: "Exhibit D — Furnisher statement (June)", kind: "Furnisher record", dated: "Jun 28", state: "contested", note: "Delinquency dated 2021-02. Contradicts Exhibit C; both threads preserved.", pairsWith: "e3" },
  { id: "e5", label: "Exhibit E — Utility statement", kind: "Account record", dated: "Mar 22", state: "aged", note: "Four months old. Aging shown; refresh before reliance." },
];

// ── Strategy Council options (bearing lines converge; the human decides) ─────
export interface CouncilOption {
  id: string;
  label: string;
  basis: string;
  bearing: string; // what this course rests on
  recommended?: boolean;
}
export const COUNCIL: CouncilOption[] = [
  { id: "c1", label: "Method-of-verification demand first", basis: "Exhibit B discloses no method; §611(a)(7) provides the ask.", bearing: "Strongest documented gap; lowest cost; preserves later courses.", recommended: true },
  { id: "c2", label: "Lead with the date contradiction", basis: "Exhibits C and D disagree by fifteen months.", bearing: "High-leverage inconsistency, but spends the strongest evidence early." },
  { id: "c3", label: "Hold one cycle and refresh evidence", basis: "Exhibit E is aged; the utility statement refresh is on the bench.", bearing: "Patience course — trades time for a cleaner record." },
];

// ── Kai analysis script (typeset by the bench during a REAL run of the demo) ─
export const KAI_ANALYSIS = {
  read: "This room's specimen record only (6 entries, 5 exhibits).",
  lacked: "No live bureau data; no consumer file — this is a language demonstration.",
  confidence: "Grounds: Building — specimen record, assembled for validation.",
  lines: [
    "The record shows a response that asserts verification without stating a method.",
    "Exhibits C and D disagree on the first-delinquency date by fifteen months; the contradiction is preserved, not resolved.",
    "The documented next step under §611(a)(7) is a method-of-verification demand — a process step, never an outcome promise.",
  ],
  citations: ["Exhibit B", "Exhibits C·D", "§611(a)(7)"],
};
