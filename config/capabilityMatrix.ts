// CreditVector capability matrix — PRODUCT DATA (Platform Phase B, B1).
// ─────────────────────────────────────────────────────────────────────────────
// STATUS: DORMANT. Zero production consumers. lib/entitlements.ts remains the
// live gate. This file is the single future source of truth for "which
// capability does each plan grant" — approved agency packaging 2026-07-16:
//   Agency $399 · 15 workspaces · 1 concurrent session  (solo operator)
//   Agency Pro $699 · 40 workspaces · 3 sessions        (growing team)
//   Scale $1,299 · 100 workspaces · 5 sessions          (established agency)
//   Enterprise custom · negotiated capacity · 10 sessions DEFAULT, configurable
//     per account via entitlement override — never permanently hardcoded.
//
// LOCKSTEP LAW: until Phase-B activation, the CLIENT_WORKSPACE_LIMIT values here
// MUST equal lib/entitlements.agencyClientLimit (15/40/100/null) — the golden
// test in Phase B2/B3 asserts it. CONCURRENT_SESSION_LIMIT is DECLARED here but
// NOT ENFORCEABLE today (NextAuth stateless JWT, no session registry) — it must
// not be advertised in the UI until the session-architecture package ships.
// TEAM_MEMBER_LIMIT values marked below are placeholders pending owner decision;
// no team system exists in the repository yet.
//
// Capability-first: capability → grant → bundle → plan. The ladder has TWO
// BRANCHES sharing a trunk: consumer (explorer → professional → professional_plus)
// and agency (agency → agency_pro → scale → enterprise). Supersets are strict
// WITHIN a branch; across branches, agency_pro ⊇ professional_plus ∪ agency (the
// pricing page's comparison matrix is the reference). agency itself deliberately
// lacks long-term memory/advanced analytics (page: memory "Case", analytics
// "roster"). The kernel PEP consumes the resolved snapshot; plan names are never
// checked directly for authorization.
//
// GRANDFATHER NOTE: live enforcement (lib/entitlements.agencyClientLimit) keeps
// pre-2026-07-17 accounts at their sold caps (Agency 20, Agency Pro unlimited);
// this matrix declares the NEW packaging — activation must preserve the
// grandfather clause (a per-account entitlement override, the same mechanism
// Enterprise session limits need).
import type { CapabilityKey, Permission } from "@/lib/os/kernel/types";
import type { LimitKey, PlanTier, TierCapabilityMatrix, TierGrant } from "@/lib/os/kernel/tiers";

const cap = (k: string) => k as CapabilityKey;

// ── Capability keys (namespaced domain.entity.action; * = live today) ────────
const CORE = [
  cap("credit.letter.draft"), //*
  cap("credit.tradeline.insight"), //*
  cap("credit.obsolescence.window"), //*
] as const;
const PAID = [
  cap("credit.strategy.plan"), //* (AI Action Plan)
  cap("credit.response.analyze"), //*
  cap("credit.campaign.compose"), //*
] as const;
const COMMUNITY = cap("community.access"); //* (agency-gated today)
const MEMORY = cap("kai.memory.persist"); // ADR-0006 gated — flag OFF
const ANALYTICS = cap("analytics.advanced.view");
const WORKSPACES = cap("workspace.client.manage"); //* (agency roster)
const TEAM = cap("team.member.manage"); // no team system yet — flag OFF
const BULK = cap("automation.bulk.run"); // BULK_ACTIONS
const AUTOMATION = cap("automation.rule.run"); // ADR-0027 gated — flag OFF
const API_ACCESS = cap("platform.api.access"); // ABI-freeze gated — flag OFF
const WEBHOOKS = cap("platform.webhook.emit"); // ABI-freeze gated — flag OFF
const MANAGER_DASH = cap("analytics.manager.view"); // MANAGER_DASHBOARDS
const ADV_PERMS = cap("team.permission.manage"); // ADVANCED_PERMISSIONS
const BRANDING = cap("brand.custom.apply"); // CUSTOM_BRANDING (lite)
const WHITE_LABEL = cap("brand.whitelabel.apply"); // WHITE_LABEL (full)
const SSO = cap("org.sso.enable");
const PRIORITY_SUPPORT = cap("support.priority.access"); // service-backed
const ACCOUNT_MGMT = cap("support.dedicated.access"); // DEDICATED_ACCOUNT_MANAGEMENT (service)
const PRIVATE_DEPLOY = cap("org.deployment.private"); // where supported

const OFF_UNTIL_GATED: ReadonlyArray<[CapabilityKey, boolean]> = [
  [MEMORY, false], // ADR-0006 founder gate
  [AUTOMATION, false], // ADR-0027 + durable audit #11 + KERNEL_DURABLE
  [API_ACCESS, false], // kernel ABI freeze (Sprint 3)
  [WEBHOOKS, false], // kernel ABI freeze (Sprint 3)
  [TEAM, false], // team system not built
  [ADV_PERMS, false], // team system not built
];

function grant(
  capabilities: CapabilityKey[],
  permissions: Permission[],
  limits: Array<[LimitKey, number | null]>,
  extraFlags: ReadonlyArray<[CapabilityKey, boolean]> = []
): TierGrant {
  return {
    capabilities: new Set(capabilities),
    permissions: new Set(permissions),
    limits: new Map(limits),
    flags: new Map([...OFF_UNTIL_GATED, ...extraFlags]),
  };
}

const BASE_PERMS: Permission[] = ["letters:generate", "obsolescence:check", "tradeline:read"];
const PAID_PERMS: Permission[] = [...BASE_PERMS, "responses:analyze", "campaign:compose", "strategy:plan"];
const AGENCY_PERMS: Permission[] = [...PAID_PERMS, "clients:manage", "community:read", "community:write"];

// ── The matrix: each tier = a bundle; higher tiers are supersets ─────────────
export const CAPABILITY_MATRIX: TierCapabilityMatrix = {
  explorer: grant([...CORE], BASE_PERMS, [
    ["LETTERS_MONTHLY_LIMIT", 3],
    ["CLIENT_WORKSPACE_LIMIT", 0],
    ["CONCURRENT_SESSION_LIMIT", 1],
    ["TEAM_MEMBER_LIMIT", 0],
    ["API_CALLS_MONTHLY_LIMIT", 0],
  ]),
  professional: grant([...CORE, ...PAID], PAID_PERMS, [
    ["LETTERS_MONTHLY_LIMIT", null],
    ["CLIENT_WORKSPACE_LIMIT", 0],
    ["CONCURRENT_SESSION_LIMIT", 1],
    ["TEAM_MEMBER_LIMIT", 0],
    ["API_CALLS_MONTHLY_LIMIT", 0],
  ]),
  professional_plus: grant([...CORE, ...PAID, COMMUNITY, MEMORY, ANALYTICS], PAID_PERMS, [
    ["LETTERS_MONTHLY_LIMIT", null],
    ["CLIENT_WORKSPACE_LIMIT", 0],
    ["CONCURRENT_SESSION_LIMIT", 1],
    ["TEAM_MEMBER_LIMIT", 0],
    ["API_CALLS_MONTHLY_LIMIT", 0],
  ]),
  agency: grant([...CORE, ...PAID, COMMUNITY, WORKSPACES], AGENCY_PERMS, [
    ["LETTERS_MONTHLY_LIMIT", null],
    ["CLIENT_WORKSPACE_LIMIT", 15], // lockstep with agencyClientLimit
    ["CONCURRENT_SESSION_LIMIT", 1], // declared; NOT enforceable yet
    ["TEAM_MEMBER_LIMIT", 0],
    ["API_CALLS_MONTHLY_LIMIT", 0],
  ]),
  agency_pro: grant(
    [...CORE, ...PAID, COMMUNITY, WORKSPACES, TEAM, MEMORY, ANALYTICS, BULK, BRANDING, PRIORITY_SUPPORT],
    AGENCY_PERMS,
    [
      ["LETTERS_MONTHLY_LIMIT", null],
      ["CLIENT_WORKSPACE_LIMIT", 40],
      ["CONCURRENT_SESSION_LIMIT", 3],
      ["TEAM_MEMBER_LIMIT", 5], // PLACEHOLDER — owner decision pending; team system not built
      ["API_CALLS_MONTHLY_LIMIT", 0],
    ]
  ),
  scale: grant(
    [...CORE, ...PAID, COMMUNITY, WORKSPACES, TEAM, MEMORY, ANALYTICS, BULK, BRANDING, PRIORITY_SUPPORT,
     AUTOMATION, API_ACCESS, WEBHOOKS, MANAGER_DASH, ADV_PERMS, ACCOUNT_MGMT],
    AGENCY_PERMS,
    [
      ["LETTERS_MONTHLY_LIMIT", null],
      ["CLIENT_WORKSPACE_LIMIT", 100],
      ["CONCURRENT_SESSION_LIMIT", 5],
      ["TEAM_MEMBER_LIMIT", null], // repository truth: no bound defined; unlimited per pricing spec
      ["API_CALLS_MONTHLY_LIMIT", 10_000], // PLACEHOLDER — owner decision pending
    ]
  ),
  enterprise: grant(
    [...CORE, ...PAID, COMMUNITY, WORKSPACES, TEAM, MEMORY, ANALYTICS, BULK, BRANDING, PRIORITY_SUPPORT,
     AUTOMATION, API_ACCESS, WEBHOOKS, MANAGER_DASH, ADV_PERMS, ACCOUNT_MGMT,
     SSO, WHITE_LABEL, PRIVATE_DEPLOY],
    AGENCY_PERMS,
    [
      ["LETTERS_MONTHLY_LIMIT", null],
      ["CLIENT_WORKSPACE_LIMIT", null], // negotiated per account
      ["CONCURRENT_SESSION_LIMIT", 10], // DEFAULT ONLY — per-account entitlement override at activation
      ["TEAM_MEMBER_LIMIT", null],
      ["API_CALLS_MONTHLY_LIMIT", null],
    ]
  ),
};

/** Ordered upgrade path — the operational progression the pricing tells. */
export const TIER_ORDER: readonly PlanTier[] = [
  "explorer", "professional", "professional_plus", "agency", "agency_pro", "scale", "enterprise",
];
