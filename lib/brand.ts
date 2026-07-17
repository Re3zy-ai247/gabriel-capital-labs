// Single source of truth for product branding. CreditVector™ is the platform;
// Gabriel Capital Labs is the umbrella company that operates it. Surface copy
// should read from here so a future rename touches one file.
export const BRAND = {
  product: "CreditVector",
  trademark: "CreditVector™",
  parent: "Gabriel Capital Labs",
  byline: "by Gabriel Capital Labs",
  full: "CreditVector™ by Gabriel Capital Labs",
  tagline: "The Credit Intelligence Operating System",
  shortName: "CreditVector",
} as const;

export type ModuleStatus = "live" | "soon";

export interface PlatformModule {
  key: string;
  name: string;
  tagline: string;
  status: ModuleStatus;
  /** lucide-react icon name, resolved by the rendering component. */
  icon: string;
  /** In-app destination when the module is live. */
  href?: string;
}

// The CreditVector platform suite. Today's product is the dispute stack (the
// first cluster); the rest are the roadmap that the "Intelligence Platform"
// framing is built to grow into. Keep names stable — they're the product vocabulary.
export const MODULES: PlatformModule[] = [
  {
    key: "bureauiq",
    name: "BureauIQ",
    tagline: "Cross-bureau report intelligence — every account and discrepancy across Equifax, Experian, and TransUnion.",
    status: "live",
    icon: "ScanSearch",
    href: "/tradelines",
  },
  {
    key: "dispute-engine",
    name: "Dispute Engine",
    tagline: "FCRA-grounded dispute letters, drafted and refined by Kai, ready to review and mail.",
    status: "live",
    icon: "Mails",
    href: "/letters",
  },
  {
    key: "response-intelligence",
    name: "Response Intelligence",
    tagline: "Reads each bureau response, scores the outcome, and builds your next escalation round automatically.",
    status: "live",
    icon: "Radar",
    href: "/letters",
  },
  {
    key: "fcra-engine",
    name: "FCRA Engine",
    tagline: "Every letter cites your actual rights under the Fair Credit Reporting Act — compliance-checked before you see it.",
    status: "live",
    icon: "Scale",
    href: "/letters",
  },
  {
    key: "cfpb-escalation",
    name: "CFPB Escalation",
    tagline: "When bureaus stall, escalate with regulator-grade framing — CFPB and state Attorney General pathways.",
    status: "live",
    icon: "Gavel",
    href: "/letters",
  },
  {
    key: "ai-advisor",
    name: "AI Credit Advisor",
    tagline: "A strategist that prioritizes your highest-impact moves and maps a 90-day plan.",
    status: "live",
    icon: "Compass",
    href: "/strategist",
  },
  {
    key: "credit-builder",
    name: "Credit Builder",
    tagline: "Optimization playbooks to build positive history, lower utilization, and strengthen your profile.",
    status: "soon",
    icon: "TrendingUp",
  },
  {
    key: "funding-hub",
    name: "Funding Hub",
    tagline: "A marketplace that matches you to personal and business funding options.",
    status: "soon",
    icon: "Landmark",
  },
  {
    key: "business-credit",
    name: "Business Credit",
    tagline: "Establish and grow business credit separate from your personal file.",
    status: "soon",
    icon: "Briefcase",
  },
];
