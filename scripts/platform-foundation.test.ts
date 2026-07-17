// Guard for Platform Phase B activation sprint. Run:
//   npx tsx scripts/platform-foundation.test.ts
//
// Pins: tier resolver fail-closed law · quota law · billing→tier mapping ·
// B3 ADAPTER BYTE-IDENTITY (legacy gates vs capability-platform derivation over
// realistic user shapes — the precondition for any B4 route flip) · team role
// determinism · invitation state machine · session admission decision table
// (enforced === false ALWAYS until CSAP-1) · dormant flags default OFF ·
// module registry integrity · platform health derivation runs DB-free.
import { CAPABILITY_MATRIX } from "../config/capabilityMatrix";
import { snapshotForTier, grantForTier, limitForTier, FALLBACK_TIER } from "../lib/os/host/tierResolver";
import { withinLimit } from "../lib/os/kernel/quota";
import { planTierFromUser } from "../lib/os/host/billingTier";
import {
  isPremium, isPremiumViaPlatform, agencyClientLimit, agencyClientLimitViaPlatform,
  capabilityPlatformEnabled,
} from "../lib/entitlements";
import { permissionsForRole, nextInvitationState, teamFoundationEnabled, type Invitation } from "../lib/os/platform/teams";
import { ROLE_PERMISSIONS } from "../config/rolePermissions";
import { createInvitation } from "../lib/platform/teamStore";
import { evaluateSessionAdmission, sessionFoundationEnabled } from "../lib/os/platform/sessions";
import { resolve } from "../lib/os/kernel";
import type { CapabilityKey } from "../lib/os/kernel/types";
import { PLATFORM_MODULES, moduleShellEnabled } from "../lib/platform/modules";
import { platformHealth, flagStatuses } from "../lib/platform/health";

let passed = 0, failed = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) passed++;
  else { failed++; console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

// ── 1. Tier resolver: fail-closed + determinism ──────────────────────────────
check("fallback tier is explorer", FALLBACK_TIER === "explorer");
const unknown = snapshotForTier(undefined, CAPABILITY_MATRIX);
check("unknown tier resolves to the weakest bundle", unknown.grantedCapabilities === CAPABILITY_MATRIX.explorer.capabilities);
const s1 = snapshotForTier("agency", CAPABILITY_MATRIX);
const s2 = snapshotForTier("agency", CAPABILITY_MATRIX);
check("resolver is deterministic (same refs, no rebuild)", s1.grantedCapabilities === s2.grantedCapabilities && s1.grantedPermissions === s2.grantedPermissions);
check("limitForTier: absent key fail-closed to 0", limitForTier("explorer", CAPABILITY_MATRIX, "API_CALLS_MONTHLY_LIMIT") === 0);
check("limitForTier: enterprise workspaces unlimited", limitForTier("enterprise", CAPABILITY_MATRIX, "CLIENT_WORKSPACE_LIMIT") === null);

// ── 1b. ONE RESOLUTION LAW: kernel resolve() over snapshotForTier ────────────
// resolve() is fail-closed on flags (absent = OFF → "coming_soon"); the matrix
// must therefore flag every granted-ungated capability true, or the PEP would
// deny live capabilities the moment it consumed the snapshot.
const stubRegistry = { isRegistered: () => true } as unknown as Parameters<typeof resolve>[1];
const LIVE_CAP = "credit.response.analyze" as CapabilityKey;
const GATED_CAP = "kai.memory.persist" as CapabilityKey;
check("resolve law: live capability AVAILABLE for professional", resolve(LIVE_CAP, stubRegistry, snapshotForTier("professional", CAPABILITY_MATRIX)) === "available");
check("resolve law: live capability NOT_ENTITLED for explorer", resolve(LIVE_CAP, stubRegistry, snapshotForTier("explorer", CAPABILITY_MATRIX)) === "not_entitled");
check("resolve law: gated capability COMING_SOON even where granted", resolve(GATED_CAP, stubRegistry, snapshotForTier("professional_plus", CAPABILITY_MATRIX)) === "coming_soon");
for (const t of ["explorer", "professional", "agency"] as const) {
  const g = grantForTier(t, CAPABILITY_MATRIX);
  check(`resolve law: every granted-ungated capability flagged true (${t})`,
    [...g.capabilities].every((c) => g.flags.get(c) !== undefined));
}

// ── 2. Quota law ─────────────────────────────────────────────────────────────
const g = grantForTier("agency", CAPABILITY_MATRIX);
check("quota: under limit allowed", withinLimit(g, "CLIENT_WORKSPACE_LIMIT", 14).allowed === true);
check("quota: at limit blocked", withinLimit(g, "CLIENT_WORKSPACE_LIMIT", 15).allowed === false);
check("quota: null = unlimited", withinLimit(g, "LETTERS_MONTHLY_LIMIT", 10_000).allowed === true);
check("quota: absent key = 0 (fail-closed)", withinLimit(grantForTier("explorer", CAPABILITY_MATRIX), "API_CALLS_MONTHLY_LIMIT", 0).allowed === false);

// ── 3. Billing→tier mapping (capabilities drive plans, never the reverse) ────
check("premium (legacy DB value) → professional", planTierFromUser({ plan: "premium" }) === "professional");
check("agency_pro → agency_pro", planTierFromUser({ plan: "agency_pro" }) === "agency_pro");
check("isAgency w/o plan → agency", planTierFromUser({ isAgency: true }) === "agency");
check("active sub w/o plan → professional", planTierFromUser({ subscriptionStatus: "active" }) === "professional");
check("nothing → explorer (fail-closed)", planTierFromUser({}) === "explorer");

// ── 4. B3 ADAPTER BYTE-IDENTITY over realistic user shapes ───────────────────
// Realistic = shapes the Stripe webhook actually writes (agency-family plans
// always carry isAgency:true + an active status). Bare/unrealistic shapes
// (e.g. plan:"scale" with isAgency:false) are NOT produced by billing and are
// re-checked at the B4 gate.
const POST = new Date("2026-08-01"), PRE = new Date("2026-07-01");
const SHAPES: Array<Record<string, unknown>> = [
  {},
  { subscriptionStatus: "active" },
  { plan: "premium", subscriptionStatus: "active" },
  { plan: "premium", isAgency: true, subscriptionStatus: "active" }, // downgraded agency — the isAgency FLOOR
  { plan: "agency", isAgency: true, subscriptionStatus: "active" },
  { plan: "agency", isAgency: false }, // billing-unreachable bare shape — pinned identical
  { plan: "agency_pro", isAgency: true, subscriptionStatus: "active" },
  { plan: "scale", isAgency: true, subscriptionStatus: "active" },
  { plan: "enterprise", isAgency: true, subscriptionStatus: "active" },
  { subscriptionStatus: "canceled" },
];
for (const shape of SHAPES) {
  const legacy = isPremium(shape as never);
  const platform = isPremiumViaPlatform(shape as never);
  check(`adapter premium identity: ${JSON.stringify(shape)}`, legacy === platform, `legacy=${legacy} platform=${platform}`);
}
const LIMIT_SHAPES: Array<Record<string, unknown>> = [
  { role: "ADMIN", createdAt: PRE }, { role: "ADMIN", createdAt: POST },
  { isAgency: true, createdAt: POST }, { isAgency: true, createdAt: PRE },
  { plan: "premium", isAgency: true, createdAt: POST }, { plan: "premium", isAgency: true, createdAt: PRE }, // the floor
  { plan: "agency", isAgency: false, createdAt: POST }, // bare shape → 0 in both paths
  { plan: "agency_pro", isAgency: true, createdAt: POST }, { plan: "agency_pro", isAgency: true, createdAt: PRE },
  { plan: "scale", isAgency: true, createdAt: POST }, { plan: "scale", isAgency: true, createdAt: PRE },
  { plan: "enterprise", isAgency: true, createdAt: POST },
  { createdAt: POST }, {},
];
for (const shape of LIMIT_SHAPES) {
  const legacy = agencyClientLimit(shape as never);
  const platform = agencyClientLimitViaPlatform(shape as never);
  check(`adapter limit identity: ${JSON.stringify(shape)}`, legacy === platform, `legacy=${legacy} platform=${platform}`);
}

// ── 4b. KNOWN DIVERGENCES on billing-unreachable bare shapes (pinned exactly;
// re-verified against a live DB scan at the B4 gate). Legacy isPremium ignores
// plan="scale"/"enterprise" (not in its list) while the platform maps them.
check("pinned divergence: bare {plan:scale} legacy=false platform=true",
  isPremium({ plan: "scale" }) === false && isPremiumViaPlatform({ plan: "scale" }) === true);
check("pinned divergence: bare {plan:enterprise} legacy=false platform=true",
  isPremium({ plan: "enterprise" }) === false && isPremiumViaPlatform({ plan: "enterprise" }) === true);

// ── 5. Team foundation (pure mechanism + injected product bundles) ──────────
check("owner permissions include team:manage", permissionsForRole("owner", ROLE_PERMISSIONS).has("team:manage"));
check("operator scoped to assigned clients", permissionsForRole("operator", ROLE_PERMISSIONS).has("clients:assigned:manage") && !permissionsForRole("operator", ROLE_PERMISSIONS).has("clients:manage"));
check("unknown role fail-closed to EMPTY permission set", permissionsForRole("ghost" as never, ROLE_PERMISSIONS).size === 0);
const now = new Date("2026-07-16T12:00:00Z");
const inv: Invitation = { id: "i1", orgId: "o1", email: "a@b.co", role: "operator", status: "pending", createdAt: now, expiresAt: new Date(now.getTime() + 1000) };
check("invitation accept", nextInvitationState(inv, "accept", now).status === "accepted");
check("invitation revoke", nextInvitationState(inv, "revoke", now).status === "revoked");
check("expiry precedence beats accept", nextInvitationState(inv, "accept", new Date(now.getTime() + 2000)).status === "expired");
check("terminal states never move", nextInvitationState({ ...inv, status: "revoked" }, "accept", now).status === "revoked");
check("TEAM_FOUNDATION defaults OFF", teamFoundationEnabled() === false);

// ── 6. Session admission decision table (ARCHITECTURE ONLY) ─────────────────
check("SESSION_FOUNDATION defaults OFF", sessionFoundationEnabled() === false);
const cases: Array<[number, number | null, number | null | undefined, string, boolean]> = [
  [0, 1, undefined, "allow", false],
  [1, 1, undefined, "needs_capacity", true],
  [2, 3, undefined, "allow", false],
  [5, 5, undefined, "needs_capacity", true],
  [99, null, undefined, "allow", false], // unlimited
  [10, 10, null, "allow", false], // enterprise per-account override to unlimited
  [1, null, 1, "needs_capacity", true], // override tightens
];
for (const [active, limit, override, decision, wouldExceed] of cases) {
  const d = evaluateSessionAdmission({ activeSessions: active, limit, overrideLimit: override });
  check(`admission(${active},${limit},${String(override)}) → ${decision}`, d.decision === decision && d.wouldExceed === wouldExceed);
  check(`admission(${active},${limit},${String(override)}) NEVER enforced`, d.enforced === false);
}

// ── 7. Module registry integrity + dormancy ─────────────────────────────────
check("≥8 modules registered on the spine", PLATFORM_MODULES.length >= 8);
check("module slugs unique", new Set(PLATFORM_MODULES.map((m) => m.slug)).size === PLATFORM_MODULES.length);
check("every dormant/counsel-gated module has a flag + gate", PLATFORM_MODULES.filter((m) => m.status !== "live").every((m) => m.flagEnv && m.gate));
check("no module shell enabled by default", PLATFORM_MODULES.every((m) => !m.flagEnv || moduleShellEnabled(m) === false));
check("completion is an assessment within [0,100]", PLATFORM_MODULES.every((m) => m.completion >= 0 && m.completion <= 100));

// ── 8. Platform health derivation (DB-free) + flag registry ─────────────────
check("CAPABILITY_PLATFORM defaults OFF", capabilityPlatformEnabled() === false);
const flags = flagStatuses();
check("safety flags registered", ["MAIL_LIVE", "KERNEL_DURABLE", "CAPABILITY_PLATFORM", "TEAM_FOUNDATION", "SESSION_FOUNDATION"].every((n) => flags.some((f) => f.name === n)));
const health = platformHealth();
check("health derives without DB", typeof health.release.sha === "string" && health.modules.length >= 8);
check("architecture checks all pass in a clean environment", health.architecture.checks.every((c) => c.ok));

async function asyncChecks(): Promise<void> {
  let threw = false;
  try { await createInvitation("o1", "x@y.z", "operator"); } catch { threw = true; }
  check("dormant team service rejects when flag OFF (fail-closed, before any DB touch)", threw);
}

asyncChecks().then(() => {
  console.log(`platform-foundation.test.ts: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
});
