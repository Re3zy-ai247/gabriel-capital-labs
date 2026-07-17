// GIOS Executive Platform Health (Platform Phase B, Sprint 1).
// ─────────────────────────────────────────────────────────────────────────────
// One derivation for the /admin/platform dashboard. HONESTY LAW (house rule):
// every value is either MEASURED (derived from env/code/DB at request time) or
// an ASSESSMENT (structured judgment recorded in this file with its date) — the
// `basis` field says which, and nothing is ever presented as measured when it
// isn't. Unmeasurable-in-this-deployment values say so instead of guessing.
import { CAPABILITY_MATRIX, TIER_ORDER } from "@/config/capabilityMatrix";
import { PLATFORM_MODULES, moduleShellEnabled } from "@/lib/platform/modules";
import { caseMemoryStoreEnabled } from "@/lib/intelligence";
import { kaiSelfTest } from "@/lib/intelligence/selfTest";

export type Basis = "measured" | "assessment";
export interface HealthItem { label: string; value: string; basis: Basis; detail?: string; ok?: boolean }

export interface FlagStatus { name: string; on: boolean; scope: string }

const FLAGS: Array<{ name: string; scope: string }> = [
  { name: "MAIL_LIVE", scope: "physical mail-as-a-service (must stay OFF pre-CSO/CCO)" },
  { name: "KERNEL_DURABLE", scope: "GIOS durable dispatch (must stay OFF pre-#11 gates)" },
  { name: "CAPABILITY_PLATFORM", scope: "Phase-B entitlement adapter (B4 flips are owner-gated)" },
  { name: "TEAM_FOUNDATION", scope: "dormant team/workspace foundation" },
  { name: "SESSION_FOUNDATION", scope: "dormant device/session foundation (no enforcement)" },
  { name: "KAI_CASE_MEMORY", scope: "persistent Kai memory store — ADR-0006 founder gate, must stay OFF" },
  ...PLATFORM_MODULES.filter((m) => m.flagEnv).map((m) => ({ name: m.flagEnv, scope: `dormant module shell: ${m.name}` })),
];

export function flagStatuses(): FlagStatus[] {
  return FLAGS.map((f) => ({ name: f.name, on: process.env[f.name] === "true", scope: f.scope }));
}

export function capabilityStats() {
  const allCaps = new Set<string>();
  let gatedOff = 0;
  for (const tier of TIER_ORDER) {
    for (const c of CAPABILITY_MATRIX[tier].capabilities) allCaps.add(String(c));
  }
  for (const [, on] of CAPABILITY_MATRIX.enterprise.flags) if (!on) gatedOff++;
  return {
    tiers: TIER_ORDER.length,
    capabilities: allCaps.size,
    gatedOff,
    engineState: process.env.CAPABILITY_PLATFORM === "true" ? "ADAPTER LIVE (flag on)" : "DORMANT (adapter built, flag off)",
  };
}

// Readiness assessments — dated judgments. Sources: .ai/CURRENT-STATE.md plus
// the owner-approved launch-strategy governing model (Gabriel-Capital-Labs-AIOS/
// BETA-LAUNCH-STRATEGY.md §1/§10). NOT measurements; labeled as assessments.
// KNOWN_DEBT below is a curated executive subset — the full register stays in
// .ai/CURRENT-STATE.md (the dashboard card says so).
export const READINESS: HealthItem[] = [
  { label: "Private Alpha", value: "READY (ops gates open)", basis: "assessment", ok: true, detail: "Code+copy ready 2026-07-16; open owner ops: counsel engagement, backup drill, alert wiring, env actions" },
  { label: "Closed Beta", value: "GATED on counsel", basis: "assessment", ok: false, detail: "Counsel sign-off gates recruiting beyond trusted circle (governing model, §1 launch strategy)" },
  { label: "Public Beta", value: "GATED", basis: "assessment", ok: false, detail: "Counsel + hardening list (auth lockout, DMARC, E2E smoke, dunning)" },
  { label: "Production (1.0)", value: "NOT YET", basis: "assessment", ok: false, detail: "MAIL_LIVE, MFA, remaining tier checkouts, GLBA program" },
];

export const KNOWN_DEBT: Array<{ item: string; severity: "high" | "medium" | "low" }> = [
  { item: "Stale $799/$7,990 Agency Pro Stripe prices active (unreachable; replace at Agency Pro activation — do NOT run admin price sync until then)", severity: "medium" },
  { item: "GitHub→Vercel auto-deploy did not fire on last push (manual `vercel --prod` used); integration needs a look", severity: "medium" },
  { item: "Checkout coerces unknown plan → premium instead of 400", severity: "low" },
  { item: "GIOS kernel D-07/D-08 effect-safety debt (harmless until an effect crosses dispatch; pre-#11)", severity: "medium" },
  { item: "TEAM_MEMBER_LIMIT / API_CALLS_MONTHLY_LIMIT placeholder values pending owner decision", severity: "low" },
  { item: "resolveProduct/reconcileTaxCodes retain display-name fallback (delete once all products confirmed metadata-tagged)", severity: "low" },
];

// Kai Intelligence health (Phase C, Sprint 7) — MEASURED where possible: the
// reasoning self-test genuinely runs the pipeline on a fixed synthetic case at
// request time and validates the trace through the no-hallucination law. What
// needs real customer volume (letter success rates) comes from the DB in the
// route, or reports "not yet measurable" — never a fake number.
export function kaiIntelligence() {
  // SYNTHETIC self-test — proves the pipeline + validators work at request
  // time; measures NO customer. The fixture lives in lib/intelligence/selfTest
  // (the platform layer holds no Kai domain data — ownership boundary).
  const t = kaiSelfTest();
  return {
    reasoningSelfTest: { pass: t.pass, findings: t.findings, recommendations: t.recommendations, errors: t.errors, basis: "measured" as Basis, synthetic: true },
    explainability: { citedFindings: t.citedFindings, totalFindings: t.findings, score: t.findings ? `${Math.round((t.citedFindings / t.findings) * 100)}%` : "n/a", basis: "measured" as Basis, synthetic: true, note: "validator rejects any uncited finding — enforced, not aspirational (synthetic self-test case)" },
    proactiveSignals: { generated: t.signals, allCarryReceipts: t.signalsCarryReceipts, basis: "measured" as Basis, synthetic: true },
    memory: { mode: "projection (case record IS the memory)", persistentStore: caseMemoryStoreEnabled() ? "ENABLED" : "DORMANT (ADR-0006 gate closed)", basis: "measured" as Basis },
    confidence: { engineLaw: "never 'high' without verified own outcomes; per-item focus; basis always stated", basis: "assessment" as Basis },
  };
}

export function platformHealth() {
  const modules = PLATFORM_MODULES.map((m) => ({
    slug: m.slug, name: m.name, status: m.status, gate: m.gate,
    completion: m.completion, shellEnabled: m.flagEnv ? moduleShellEnabled(m) : false,
  }));
  const flags = flagStatuses();
  const caps = capabilityStats();
  // Architecture score: deterministic formula over real booleans, labeled as such.
  // 1 point each: safety flags correctly OFF (MAIL_LIVE, KERNEL_DURABLE), dormant
  // foundations present (capability adapter, teams, sessions — existence is this
  // build), modules registered, no module shell leaking (flag off or admin-gated).
  const checks: Array<[string, boolean]> = [
    ["MAIL_LIVE off", !flags.find((f) => f.name === "MAIL_LIVE")?.on],
    ["KERNEL_DURABLE off", !flags.find((f) => f.name === "KERNEL_DURABLE")?.on],
    // Falsifiable: the adapter flag is registered AND (per the B4 owner gate) not
    // enabled in this environment — flips red the moment someone turns it on
    // without updating this expectation at the reviewed call site.
    ["Capability adapter flag-governed and OFF (B4 owner-gated)",
      flags.some((f) => f.name === "CAPABILITY_PLATFORM") && !flags.find((f) => f.name === "CAPABILITY_PLATFORM")?.on],
    ["KAI_CASE_MEMORY off (ADR-0006 founder gate)", !flags.find((f) => f.name === "KAI_CASE_MEMORY")?.on],
    ["All 8 modules registered on the spine", modules.length >= 8],
    ["No dormant module shell enabled in this environment", modules.every((m) => !m.shellEnabled)],
    ["Capability matrix covers all 7 tiers", caps.tiers === 7],
  ];
  const passed = checks.filter(([, ok]) => ok).length;
  return {
    release: {
      sha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local/dev (no VERCEL_GIT_COMMIT_SHA)",
      env: process.env.VERCEL_ENV ?? "local",
      basis: "measured" as Basis,
    },
    flags,
    capabilities: caps,
    modules,
    readiness: READINESS,
    debt: KNOWN_DEBT,
    architecture: {
      score: `${passed}/${checks.length}`,
      checks: checks.map(([label, ok]) => ({ label, ok })),
      basis: "measured" as Basis,
      formula: "count of passing structural checks — not a quality grade",
    },
  };
}
