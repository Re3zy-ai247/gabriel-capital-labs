// CreditVector Growth Center Foundation Preview — pure, synthetic projection.
//
// This client-safe module contains review vocabulary only. It owns no participant,
// organization, Community, Marketplace, reputation, qualification, economic, or
// Kai runtime truth. Every explanation is deterministic and explicitly fictional.

export const GROWTH_CENTER_EXPERIENCE_VERSION = "1.0.0-preview" as const;
export const GROWTH_CENTER_FIXTURE_SOURCE =
  "GCF-PREVIEW-01 · fictional operator review fixture · 2026-07-31" as const;

export const GROWTH_CENTER_REVIEW_DISCLOSURE =
  "Internal review · Synthetic · No live program. This is a synthetic design preview. No Growth Network program is active. Enrollment, qualification, mentorship bookings, courses, listings, purchases, sales, compensation, Growth Distributions, and payouts are unavailable. Nothing shown creates eligibility, an obligation, or a promise of earnings." as const;

export const GROWTH_CENTER_REVIEW_SUMMARY =
  "Internal Founder review · Synthetic · No live program. Enrollment, qualification, live mentorship, courses, listings, purchases, sales, compensation, Growth Distributions, and payouts are unavailable." as const;

export const GROWTH_CENTER_KAI_DISCLOSURE =
  "I can explain fixed fictional examples of what an operator might build, learn, teach, or contribute in this synthetic preview. I am not analyzing your organization or eligibility. I do not provide legal, tax, financial, employment, or business-opportunity advice, promise earnings or results, create records, enroll you, or take action." as const;

export const GROWTH_CENTER_KAI_NO_ACTION_RECEIPT =
  "Preview only. No model was called. Nothing was saved, sent, assigned, scheduled, purchased, or changed." as const;

export const GROWTH_CENTER_DISTRICT_IDS = Object.freeze([
  "growth-center",
  "professional-development",
  "mentorship",
  "education-center",
  "marketplace-preview",
  "community-contribution",
  "agency-builder",
] as const);

export type GrowthCenterDistrictId =
  (typeof GROWTH_CENTER_DISTRICT_IDS)[number];

export type GrowthCenterPlane =
  | "protagonist"
  | "professional-capability"
  | "ecosystem-value"
  | "organization-path";

export interface GrowthCenterDistrict {
  id: GrowthCenterDistrictId;
  label: string;
  shortLabel: string;
  plane: GrowthCenterPlane;
  purpose: string;
  opportunity: string;
  evidence: string;
  nextAction: string;
  boundary: string;
}

export const GROWTH_CENTER_DISTRICTS = Object.freeze([
  {
    id: "growth-center",
    label: "Growth Center · Your Growth Brief",
    shortLabel: "Growth Center",
    plane: "protagonist",
    purpose:
      "Orient a fictional operator around capability, useful contribution, and responsible stewardship.",
    opportunity:
      "Choose one human-sized contribution to develop before exploring any future program.",
    evidence:
      "Synthetic source · GCF-01 Growth Brief · no participant record exists.",
    nextAction: "Review the fixed next-contribution brief",
    boundary:
      "Review fixture only. No participant profile, status, eligibility, program record, or live opportunity exists.",
  },
  {
    id: "professional-development",
    label: "Professional Development",
    shortLabel: "Development",
    plane: "professional-capability",
    purpose:
      "Develop stronger operations, compliance, accessibility, teaching, and platform-use capabilities.",
    opportunity:
      "Map one capability to practice, evidence, reflection, and a useful operator outcome.",
    evidence:
      "Synthetic source · GCF-02 Capability Map · not a credential or performance record.",
    nextAction: "Explore a competence roadmap",
    boundary:
      "Future concept only. No training enrollment, certification, employment status, eligibility, or income outcome exists.",
  },
  {
    id: "mentorship",
    label: "Mentorship",
    shortLabel: "Mentorship",
    plane: "professional-capability",
    purpose:
      "Prepare for deliberate B2B operator coaching through goals, boundaries, feedback, and reflection.",
    opportunity:
      "Draft a mentorship preparation note that names one skill, one question, and one follow-through step.",
    evidence:
      "Synthetic source · GCF-03 Mentorship Preparation · never production-verified evidence.",
    nextAction: "Preview a mentorship preparation plan",
    boundary:
      "Preview a possible future B2B operator professional-development experience. No mentor matching, booking, contract, payment, or live mentorship is available. It would not cover consumer-specific credit improvement, dispute execution, legal advice, bureau or creditor representation, advance-fee guidance, or promised outcomes.",
  },
  {
    id: "education-center",
    label: "Education Center",
    shortLabel: "Education",
    plane: "professional-capability",
    purpose:
      "Explore structured operator learning and responsible teaching around defined professional outcomes.",
    opportunity:
      "Turn one repeatable operator lesson into a clear objective, practice activity, and review prompt.",
    evidence:
      "Synthetic source · GCF-04 Teaching Outline · not a course, completion, or credential record.",
    nextAction: "Inspect a teaching opportunity",
    boundary:
      "Future concept only. No course sale, class, webinar, credential, seller access, rank, compensation, or promised result exists.",
  },
  {
    id: "marketplace-preview",
    label: "Marketplace Preview",
    shortLabel: "Marketplace",
    plane: "ecosystem-value",
    purpose:
      "Preview how future templates, SOPs, Kai assets, and educational products could be held to usefulness and quality gates.",
    opportunity:
      "Describe a reusable asset by the operator problem it solves, its safe-use boundary, and the evidence needed to review it.",
    evidence:
      "Synthetic source · GCF-05 Asset Quality Brief · no listing or seller record exists.",
    nextAction: "Review the future asset quality gates",
    boundary:
      "Future concept only. There are no listings, seller access, purchases, checkout, fees, commissions, sales, or payouts. Any future marketplace requires separate approval, terms, review, delivery, and refund policy.",
  },
  {
    id: "community-contribution",
    label: "Community Contribution",
    shortLabel: "Contribution",
    plane: "ecosystem-value",
    purpose:
      "Explore knowledge sharing that is judged by provenance and usefulness rather than attention or popularity.",
    opportunity:
      "Prepare one concise field note with a source, an operator use case, and a limitation.",
    evidence:
      "Synthetic source · GCF-06 Contribution Note · no Community post or recognition record exists.",
    nextAction: "Preview a useful contribution format",
    boundary:
      "Future concept only. Community is not read or changed. Posts, likes, views, followers, attendance, volume, referrals, and recruiting create no eligibility, Growth Reputation, or compensation.",
  },
  {
    id: "agency-builder",
    label: "Agency Builder",
    shortLabel: "Agency Builder",
    plane: "organization-path",
    purpose:
      "Explore organization stewardship through onboarding quality, mentoring, operator success, retention quality, and ecosystem health.",
    opportunity:
      "Draft one stewardship practice that helps operators become more capable without rewarding recruitment.",
    evidence:
      "Synthetic source · GCF-07 Stewardship Review · no organization or operator data is connected.",
    nextAction: "Review healthy-organization principles",
    boundary:
      "No live Growth Distribution exists, and this preview does not enroll or qualify anyone. Recruiting, headcount, participant purchases, subscriptions, paid retention, credit outcomes, rank, popularity, XP, and Growth Reputation cannot qualify an organization or increase any future allocation. Organization ownership alone creates no right to payment.",
  },
] as const satisfies readonly GrowthCenterDistrict[]);

export const GROWTH_CENTER_HEARTBEAT = Object.freeze([
  {
    id: "develop",
    label: "Develop",
    meaning: "Practice a relevant professional capability.",
  },
  {
    id: "mentor-or-teach",
    label: "Mentor or Teach",
    meaning: "Help another operator understand and apply it responsibly.",
  },
  {
    id: "contribute",
    label: "Contribute",
    meaning: "Create something useful to the ecosystem.",
  },
  {
    id: "verify",
    label: "Verify",
    meaning: "Examine provenance, quality, boundaries, and observed usefulness.",
  },
  {
    id: "strengthen-ecosystem",
    label: "Strengthen Ecosystem",
    meaning: "Carry learning forward into healthier work and organizations.",
  },
] as const);

export const GROWTH_CENTER_VALUES = Object.freeze([
  "Learn",
  "Teach",
  "Mentor",
  "Create",
  "Collaborate",
  "Grow",
  "Lead",
  "Contribute",
  "Prosper",
] as const);

export const GROWTH_CENTER_LENS_IDS = Object.freeze([
  "building",
  "deepening",
  "leading",
] as const);
export type GrowthCenterLensId = (typeof GROWTH_CENTER_LENS_IDS)[number];

export const GROWTH_CENTER_LENSES = Object.freeze({
  building: {
    label: "Building foundations",
    context:
      "Shape reliable habits, clear service boundaries, and one useful contribution.",
    firstStep: "Name one operator problem you can help make clearer.",
  },
  deepening: {
    label: "Deepening practice",
    context:
      "Improve the quality, repeatability, and evidence behind work you already understand.",
    firstStep: "Choose one existing practice to make easier to teach and review.",
  },
  leading: {
    label: "Leading responsibly",
    context:
      "Strengthen other operators through stewardship, education, and useful standards.",
    firstStep: "Choose one capability your peers could apply more consistently.",
  },
} as const);

export const GROWTH_EXPLANATION_INTENT_IDS = Object.freeze([
  "BUILD_NEXT",
  "BECOME_BETTER",
  "FIND_OPPORTUNITIES",
  "LEARN_SKILLS",
  "EDUCATE_OTHERS",
  "CONTRIBUTE",
] as const);
export type GrowthExplanationIntentId =
  (typeof GROWTH_EXPLANATION_INTENT_IDS)[number];

export const GROWTH_EXPLANATION_INTENTS = Object.freeze([
  { id: "BUILD_NEXT", label: "Explain a build-next example" },
  { id: "BECOME_BETTER", label: "Explain a practice-development example" },
  { id: "FIND_OPPORTUNITIES", label: "Explain an opportunity-exploration example" },
  { id: "LEARN_SKILLS", label: "Explain a skill-learning example" },
  { id: "EDUCATE_OTHERS", label: "Explain an education example" },
  { id: "CONTRIBUTE", label: "Explain a contribution example" },
] as const satisfies readonly { id: GrowthExplanationIntentId; label: string }[]);

interface GrowthExplanationIntentPlan {
  districtId: GrowthCenterDistrictId;
  title: string;
  rationale: string;
  steps: readonly [string, string];
}

const GROWTH_EXPLANATION_INTENT_PLANS: Readonly<
  Record<GrowthExplanationIntentId, GrowthExplanationIntentPlan>
> = Object.freeze({
  BUILD_NEXT: {
    districtId: "growth-center",
    title: "Build one useful operator brief",
    rationale:
      "A small, well-bounded contribution makes the problem, audience, and learning need visible before a future program exists.",
    steps: [
      "Describe the operator question in one sentence.",
      "Draft a short explanation with one source and one limitation.",
    ],
  },
  BECOME_BETTER: {
    districtId: "professional-development",
    title: "Practice one capability deliberately",
    rationale:
      "Focused practice creates a clearer path to reflection than collecting activity or attention signals.",
    steps: [
      "Define what responsible execution looks like.",
      "Review the practice against a fixed quality checklist.",
    ],
  },
  FIND_OPPORTUNITIES: {
    districtId: "community-contribution",
    title: "Look for an unanswered operator question",
    rationale:
      "Useful opportunities begin with a real knowledge gap, not a recruiting target or popularity signal.",
    steps: [
      "List one recurring question an operator may face.",
      "Choose whether a field note, lesson, or template would help most.",
    ],
  },
  LEARN_SKILLS: {
    districtId: "professional-development",
    title: "Strengthen explanation and safe-use boundaries",
    rationale:
      "Clear explanation, provenance, and limitations support trustworthy operator work across every future path.",
    steps: [
      "Practice explaining one concept without jargon.",
      "Add a source, a limitation, and a responsible next step.",
    ],
  },
  EDUCATE_OTHERS: {
    districtId: "education-center",
    title: "Design one outcome-led teaching outline",
    rationale:
      "A learning objective and practice activity make education useful without rewarding completion volume.",
    steps: [
      "Write one observable operator learning objective.",
      "Pair it with a practice activity and reflection prompt.",
    ],
  },
  CONTRIBUTE: {
    districtId: "mentorship",
    title: "Prepare a focused mentorship conversation",
    rationale:
      "A bounded coaching question can help another operator learn while preserving professional and compliance limits.",
    steps: [
      "Name the skill and the question to explore.",
      "Define a follow-through step that the operator controls.",
    ],
  },
});

export interface GrowthExplanationPlan {
  lensId: GrowthCenterLensId;
  intentId: GrowthExplanationIntentId;
  districtId: GrowthCenterDistrictId;
  title: string;
  rationale: string;
  source: string;
  steps: readonly [string, string, string];
}

export function resolveGrowthExplanationPlan(
  lensId: GrowthCenterLensId,
  intentId: GrowthExplanationIntentId,
): GrowthExplanationPlan {
  const lens = GROWTH_CENTER_LENSES[lensId];
  const plan = GROWTH_EXPLANATION_INTENT_PLANS[intentId];
  return Object.freeze({
    lensId,
    intentId,
    districtId: plan.districtId,
    title: plan.title,
    rationale: `${lens.context} ${plan.rationale}`,
    source: `${GROWTH_CENTER_FIXTURE_SOURCE} · ${lens.label} · ${intentId}`,
    steps: Object.freeze([lens.firstStep, ...plan.steps]) as readonly [
      string,
      string,
      string,
    ],
  });
}

export const GROWTH_CENTER_VISIT_FIXTURES = Object.freeze({
  first: {
    label: "First visit fixture",
    note: "Runs the route-instance arrival and starts at Your Growth Brief.",
    districtId: "growth-center",
  },
  return: {
    label: "Return visit fixture",
    note: "Starts settled with a fictional Continue from Mentorship cue.",
    districtId: "mentorship",
  },
} as const);

export type GrowthCenterVisitFixture = keyof typeof GROWTH_CENTER_VISIT_FIXTURES;
