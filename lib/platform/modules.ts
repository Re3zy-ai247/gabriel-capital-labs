// CreditVector platform-module registry (Platform Phase B, Sprint 5).
// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT DATA — one row per current/future module, driving the executive
// dashboard and the dormant /modules/[slug] shells. This is the five-declaration
// spine's single index: MODULES (lib/brand.ts, marketing) → pricing matrix row →
// capability key (config/capabilityMatrix.ts) → kernel registration → this
// registry (runtime/nav). A module that skips the spine is a bolt-on; don't.
//
// Dormant modules stay INVISIBLE in production: their route 404s unless the
// module's env flag is on AND the viewer is ADMIN. Flags default OFF. No
// regulated functionality ships here — shells carry no advice, no claims, no
// user-facing copy beyond an internal preview banner. Funding Hub and Business
// Credit OS remain counsel-gated for any REAL functionality.
export type ModuleStatus = "live" | "dormant" | "counsel_gated";

export interface PlatformModule {
  slug: string;
  name: string;
  capability: string; // capability key in config/capabilityMatrix.ts
  flagEnv: string; // env var gating the dormant shell (default OFF)
  status: ModuleStatus;
  gate: string; // what unlocks real work on it
  completion: number; // 0-100, ASSESSMENT (architecture-readiness, not measured output)
}

export const PLATFORM_MODULES: readonly PlatformModule[] = [
  { slug: "community", name: "Operator Network", capability: "community.access", flagEnv: "", status: "live", gate: "shipped (every paid tier — Phase 1.1)", completion: 100 },
  { slug: "credit-builder", name: "Credit Builder", capability: "credit.strategy.plan", flagEnv: "", status: "live", gate: "shipped (guidance)", completion: 100 },
  { slug: "advanced-analytics", name: "Advanced Analytics", capability: "analytics.advanced.view", flagEnv: "MODULE_ANALYTICS", status: "dormant", gate: "read-models over ProductEvent (this sprint) → tier views", completion: 45 },
  { slug: "persistent-memory", name: "Persistent Memory (Kai Pro)", capability: "kai.memory.persist", flagEnv: "MODULE_MEMORY", status: "dormant", gate: "ADR-0006 founder gate", completion: 20 },
  { slug: "automation", name: "Automation", capability: "automation.rule.run", flagEnv: "MODULE_AUTOMATION", status: "dormant", gate: "ADR-0027 + durable audit #11 + KERNEL_DURABLE", completion: 15 },
  { slug: "marketplace", name: "Kai Marketplace", capability: "platform.api.access", flagEnv: "MODULE_MARKETPLACE", status: "dormant", gate: "kernel ABI freeze + partner PDP", completion: 10 },
  // Reserved capability keys — NOT yet declared in config/capabilityMatrix.ts;
  // they enter the matrix (flag OFF) when counsel clears real work. One module =
  // one capability key; sharing another module's key would break the spine.
  { slug: "funding-hub", name: "Funding Hub", capability: "funding.hub.access (reserved)", flagEnv: "MODULE_FUNDING", status: "counsel_gated", gate: "outside counsel (RESPA/ECOA/TILA) + PMF", completion: 5 },
  { slug: "business-credit", name: "Business Credit OS", capability: "bizcredit.profile.manage (reserved)", flagEnv: "MODULE_BIZCREDIT", status: "counsel_gated", gate: "outside counsel (commercial regime) + PMF", completion: 5 },
] as const;

export function moduleBySlug(slug: string): PlatformModule | undefined {
  return PLATFORM_MODULES.find((m) => m.slug === slug);
}

export function moduleShellEnabled(m: PlatformModule): boolean {
  return Boolean(m.flagEnv) && process.env[m.flagEnv] === "true";
}
