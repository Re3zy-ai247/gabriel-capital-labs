// The Kai Kernel — public surface (Sprint 1, ADR-0024/0025/0026). Mechanism only.
// A pure library: `new Kernel(ports)`, register plugins, then `resolve()` / `dispatch()`.
// Everything side-effecting is an injected port (hexagonal). ABI is NOT frozen until
// CreditVector has been migrated as Plugin #1 and exercised it (Sprint 3).
export * from "./types";
export { Kernel, inMemoryIdempotency, type KernelPorts, type IdempotencyStore, type IdemState, type ReplayReceipt } from "./kernel";
export { Registry } from "./registry";
export { resolve } from "./resolve";
export { authorize } from "./pep";
export { parseKey, formatKey, isValidKey, domainOf, type ParsedKey } from "./namespace";
export { stamp, memoryClock } from "./clock";
export { inMemoryAudit, inMemoryEventLog, inMemoryMemory } from "./adapters";
// Platform Phase B — tier & quota surfaces (mechanism types + the single evaluator).
export type { PlanTier, LimitKey, TierGrant, TierCapabilityMatrix } from "./tiers";
export { withinLimit, type QuotaDecision } from "./quota";
