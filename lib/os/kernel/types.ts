// The Kai Kernel — core types & ports (Sprint 1, ADR-0024/0025/0026).
// MECHANISM ONLY. The kernel knows Identity, Dispatch, Registry, Namespace, the Policy
// Enforcement Point, the Memory Interface, the Event Bus, Audit, Capability Resolution,
// and the Clock/Version Authority — and NOTHING about credit, mortgage, funding, etc.
// It is a pure library (no DB, no Date.now); all side-effecting concerns are PORTS the
// host injects (hexagonal). Every primitive here is unit/property-testable with fakes.

// ---- Identity ----
export type TrustTier = "first_party" | "verified_partner" | "third_party" | "private";
// The security principal for every call. `tenantId` scopes EVERYTHING (the #1 invariant).
export interface Actor {
  id: string;
  tenantId: string;
  trust: TrustTier;
}

// ---- Time (Clock / Version Authority) ----
// A monotonic, kernel-issued version. No plugin may mint one (preserves determinism +
// causality + audit integrity). Issued only via ClockSource.
export type Version = number & { readonly __brand: "Version" };
// Bitemporal stamp: when it was true in the world + when we learned it + its version.
export interface Stamp {
  validTime: string;   // ISO — when the fact is/was true
  txTime: string;      // ISO — when the kernel recorded it
  version: Version;
}
// PORT: the single source of monotonic versions + logical time. In prod: a DB sequence.
export interface ClockSource {
  nextVersion(): Version;   // strictly increasing
  now(): string;            // ISO transaction time
}

// ---- Capability namespace ----
// `domain.entity.action[@major]` — e.g. "credit.dispute.create", "funding.sba.qualify@2".
export type CapabilityKey = string & { readonly __brand: "CapabilityKey" };
export type CapabilityState =
  | "available"       // registered, entitled, flag on, permitted
  | "coming_soon"     // registered but flagged off (advertised future)
  | "not_entitled"    // plan/entitlement doesn't grant it
  | "not_permitted"   // compliance/policy forbids it in this context
  | "unavailable";    // not registered / no provider

// ---- Compliance & permissions ----
export type Regime = "FCRA" | "FDCPA" | "GLBA" | "RESPA" | "TILA" | "ECOA" | "SEC" | "UPL" | "none";
export interface ComplianceBoundary {
  regimes: Regime[];             // what this capability/module touches (declared, not implied)
  permissiblePurposes: string[]; // lawful purposes this capability may serve
}
export type Permission = string; // e.g. "memory:read", "memory:write", "letters:generate"
export type PurposeToken = string; // the declared purpose-of-use for a call (R5)

// ---- Module Contract (the plug — ADR-0024/0026; ABI NOT frozen until Sprint 3) ----
export interface Confidence { level: "high" | "moderate" | "low" | "insufficient"; basis: string }
export interface Receipt { summary: string; evidence: string[] } // cited reasoning (KAI-OS §4)
export interface ModuleResult { ok: boolean; data?: unknown; receipt: Receipt; confidence: Confidence }

export interface CapabilitySpec {
  key: CapabilityKey;
  requiredPermissions: Permission[];
  compliance: ComplianceBoundary;
  reasoning: "deterministic" | "retrieval" | "generative";
}
export interface KaiModule {
  id: string;                 // "credit" — the domain prefix it owns
  name: string;               // "Kai Credit"
  trust: TrustTier;
  capabilities(): CapabilitySpec[];
  // Executes a capability over the already-loaded OsContext. Deterministic capabilities are
  // pure + synchronous (return a value); retrieval/generative capabilities are async (they
  // await a provider). ABI refinement (Sprint 2 Inc 2): async is required — a real capability
  // (response intelligence) is AI-backed. The kernel awaits it and wraps it with
  // authorization, audit, and events. (ABI stays unfrozen until Sprint 3 for exactly this.)
  execute(ctx: OsContext, key: CapabilityKey, input: unknown): ModuleResult | Promise<ModuleResult>;
}

// ---- Policy (PDP) & entitlement providers (POLICY lives in plugins, not the kernel) ----
export interface PolicyDecision { allow: boolean; reason: string }
export interface PolicyContext { actor: Actor; key: CapabilityKey; spec: CapabilitySpec; purpose: PurposeToken }
export interface PolicyDecisionProvider {
  id: string;
  decide(pc: PolicyContext): PolicyDecision; // pure; a single "deny" vetoes
}
// Preloaded ONCE per request (single-context PEP — no lookups mid-flow, R3).
export interface EntitlementSnapshot {
  grantedCapabilities: ReadonlySet<CapabilityKey>; // entitled by plan
  flags: ReadonlyMap<CapabilityKey, boolean>;      // feature flags
  grantedPermissions: ReadonlySet<Permission>;     // what the actor may do
}

// ---- Audit (append-only, tamper-proof, kernel-only) ----
export interface AuditEntry {
  stamp: Stamp;
  actorId: string;
  tenantId: string;
  key: CapabilityKey | string;
  decision: "allow" | "deny" | "event" | "error";
  reason: string;
}
export interface AuditSink { append(e: AuditEntry): void } // append-only; no update/delete

// ---- Event Bus (durable log in prod; at-least-once → handlers MUST be idempotent) ----
export interface KaiEvent {
  id: string;          // idempotency key (dedupe on redelivery)
  type: string;        // e.g. "report.uploaded"
  tenantId: string;
  stamp: Stamp;
  payload: Record<string, unknown>;
}
export interface EventLog { append(e: KaiEvent): void } // durable append; delivery is host-driven

// ---- Memory Interface (the Kai Memory Graph port; EVERY access is PEP-gated) ----
export interface MemoryNode { id: string; type: string; tenantId: string; regime: Regime; stamp: Stamp; data: Record<string, unknown> }
export interface MemoryStore {
  read(tenantId: string, id: string): MemoryNode | null;
  write(node: MemoryNode): void;
}

// ---- OsContext — built ONCE per request (single-load, R3). What modules receive. ----
export interface OsContext {
  actor: Actor;
  clock: ClockSource;
  entitlements: EntitlementSnapshot;
  // Kernel-mediated capabilities (all tenant-scoped + audited). Modules never touch raw ports.
  audit(entry: Omit<AuditEntry, "stamp">): void;
  emit(type: string, payload: Record<string, unknown>, id: string): void;
  memoryRead(id: string, purpose: PurposeToken): MemoryNode | null; // PEP-gated
}
