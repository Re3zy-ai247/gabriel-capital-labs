// Guard for Platform Phase B — B1 (dormant capability matrix). Run:
//   npx tsx scripts/capability-matrix.test.ts
//
// B1 acceptance (Phase-B architecture package): the dormant matrix must be
// provably consistent with the LIVE gates it will one day replace — before any
// resolver (B2) or live flip (B3/B4) exists. This guard is the lockstep law.
// The matrix stays data-only and dormant: importing it here must cause no side
// effects and no production route consumes it.
import { CAPABILITY_MATRIX, TIER_ORDER } from "../config/capabilityMatrix";
import type { PlanTier } from "../lib/os/kernel/tiers";
import { agencyClientLimit, FREE_LETTER_LIMIT } from "../lib/entitlements";
import { entitlementSnapshot } from "../lib/os/host/entitlements";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) passed++;
  else {
    failed++;
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const M = CAPABILITY_MATRIX;
const POST = new Date("2026-08-01"); // post-packaging account (no grandfather)
const PRE = new Date("2026-07-01"); // pre-packaging account (grandfathered)

// ── 1. TIER_ORDER integrity ──────────────────────────────────────────────────
const EXPECTED: PlanTier[] = ["explorer", "professional", "professional_plus", "agency", "agency_pro", "scale", "enterprise"];
check("TIER_ORDER lists all 7 tiers exactly once", TIER_ORDER.length === 7 && new Set(TIER_ORDER).size === 7);
check("TIER_ORDER matches the upgrade path", JSON.stringify(TIER_ORDER) === JSON.stringify(EXPECTED));
check("matrix has a grant for every tier", EXPECTED.every((t) => !!M[t]));

// ── 2. LOCKSTEP LAW: matrix workspace limits === live agencyClientLimit ─────
const wl = (t: PlanTier) => M[t].limits.get("CLIENT_WORKSPACE_LIMIT");
check("lockstep: agency 15", wl("agency") === 15 && agencyClientLimit({ isAgency: true, createdAt: POST }) === 15);
check("lockstep: agency_pro 40", wl("agency_pro") === 40 && agencyClientLimit({ plan: "agency_pro", isAgency: true, createdAt: POST }) === 40);
check("lockstep: scale 100", wl("scale") === 100 && agencyClientLimit({ plan: "scale", isAgency: true, createdAt: POST }) === 100);
check("lockstep: enterprise negotiated (null)", wl("enterprise") === null && agencyClientLimit({ plan: "enterprise", isAgency: true, createdAt: POST }) === null);
check("lockstep: consumer tiers hold zero workspaces", wl("explorer") === 0 && wl("professional") === 0 && wl("professional_plus") === 0 && agencyClientLimit({ createdAt: POST }) === 0);

// ── 3. GRANDFATHER CLAUSE: sold entitlements never shrink ───────────────────
check("grandfather: pre-2026-07-17 Agency keeps 20", agencyClientLimit({ isAgency: true, createdAt: PRE }) === 20);
check("grandfather: pre-2026-07-17 Agency Pro keeps unlimited", agencyClientLimit({ plan: "agency_pro", isAgency: true, createdAt: PRE }) === null);
check("grandfather: missing createdAt treated as NEW packaging (fail-closed to 15)", agencyClientLimit({ isAgency: true }) === 15);
check("grandfather: ADMIN always unlimited", agencyClientLimit({ role: "ADMIN", createdAt: PRE }) === null && agencyClientLimit({ role: "ADMIN", createdAt: POST }) === null);

// ── 4. SUPERSET LAWS (two branches sharing a trunk) ──────────────────────────
const caps = (t: PlanTier) => M[t].capabilities;
const isSuperset = (a: PlanTier, b: PlanTier) => [...caps(b)].every((k) => caps(a).has(k));
check("consumer branch: professional ⊇ explorer", isSuperset("professional", "explorer"));
check("consumer branch: professional_plus ⊇ professional", isSuperset("professional_plus", "professional"));
check("agency branch: agency_pro ⊇ agency", isSuperset("agency_pro", "agency"));
check("agency branch: scale ⊇ agency_pro", isSuperset("scale", "agency_pro"));
check("agency branch: enterprise ⊇ scale", isSuperset("enterprise", "scale"));
check("cross-branch: agency_pro ⊇ professional_plus ∪ agency", isSuperset("agency_pro", "professional_plus") && isSuperset("agency_pro", "agency"));
check("agency ⊇ professional (trunk)", isSuperset("agency", "professional"));

// ── 5. GATED CAPABILITIES stay flag-OFF in every tier that declares them ────
const GATED = ["kai.memory.persist", "automation.rule.run", "platform.api.access", "platform.webhook.emit", "team.member.manage", "team.permission.manage"];
for (const g of GATED) {
  check(
    `gated flag-off everywhere: ${g}`,
    EXPECTED.every((t) => {
      const declared = [...caps(t)].some((k) => String(k) === g);
      const flag = [...M[t].flags.entries()].find(([k]) => String(k) === g)?.[1];
      return !declared || flag === false;
    })
  );
}

// ── 6. LIMITS: letters, sessions ─────────────────────────────────────────────
const lim = (t: PlanTier, k: Parameters<typeof M.explorer.limits.get>[0]) => M[t].limits.get(k);
check("letters: explorer capped at the live FREE_LETTER_LIMIT", lim("explorer", "LETTERS_MONTHLY_LIMIT") === FREE_LETTER_LIMIT);
check("letters: every paid tier unlimited", EXPECTED.slice(1).every((t) => lim(t, "LETTERS_MONTHLY_LIMIT") === null));
const SESSIONS: Array<[PlanTier, number]> = [["explorer", 1], ["professional", 1], ["professional_plus", 1], ["agency", 1], ["agency_pro", 3], ["scale", 5], ["enterprise", 10]];
for (const [t, n] of SESSIONS) check(`sessions declared (NOT enforced): ${t} = ${n}`, lim(t, "CONCURRENT_SESSION_LIMIT") === n);

// ── 7. LIVE-EQUIVALENCE + the KNOWN DIVERGENCE, recorded exactly ─────────────
// The live kernel-host snapshot (dormant, binary premium) and the approved
// matrix agree on the paid axis: response.analyze is premium-only.
const freeSnap = entitlementSnapshot({ premium: false });
const paidSnap = entitlementSnapshot({ premium: true });
const has = (s: { grantedCapabilities: ReadonlySet<unknown> }, k: string) => [...s.grantedCapabilities].some((c) => String(c) === k);
check("live axis: response.analyze is paid-only in BOTH systems",
  !has(freeSnap, "credit.response.analyze") && has(paidSnap, "credit.response.analyze") &&
  ![...caps("explorer")].some((k) => String(k) === "credit.response.analyze") &&
  [...caps("professional")].some((k) => String(k) === "credit.response.analyze"));
// KNOWN DIVERGENCE (must be resolved consciously at B3 activation, not silently):
// today's host grants campaign.compose + notify.plan to ALL users ("deterministic
// → free"); the approved packaging prices campaign.compose as paid and scopes
// notify.plan as platform-internal. Assert the delta is EXACTLY this set so any
// drift in either direction fails loudly.
const freeCaps = new Set([...freeSnap.grantedCapabilities].map(String));
const explorerCaps = new Set([...caps("explorer")].map(String));
const hostOnly = [...freeCaps].filter((k) => !explorerCaps.has(k)).sort();
check(
  "known divergence is exactly {campaign.compose, notify.plan} (resolve at B3)",
  JSON.stringify(hostOnly) === JSON.stringify(["credit.campaign.compose", "notify.plan.compose"]),
  `host-only free caps: ${JSON.stringify(hostOnly)}`
);
const explorerOnly = [...explorerCaps].filter((k) => !freeCaps.has(k)).sort();
check("matrix explorer grants nothing the live host doesn't", explorerOnly.length === 0, JSON.stringify(explorerOnly));

// ── 8. DORMANCY: data-only, deterministic ────────────────────────────────────
check("matrix is pure data (sets/maps materialized, no functions)", EXPECTED.every((t) => caps(t) instanceof Set && M[t].limits instanceof Map && M[t].flags instanceof Map));

console.log(`capability-matrix.test.ts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
