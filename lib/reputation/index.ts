// Operator Reputation — public surface (Sprint 10). The bounded context's barrel.
// Arena (and later Marketplace/Kai/Knowledge Graph) consume reputation ONLY through
// this module — projections and facts, never business logic or tables. Dormant behind
// OPERATOR_REPUTATION_ENABLED (fail-closed) until the owner-gated migration + Gate F.
export * from "./flags";
export * from "./policy";
export * from "./fold";
export * from "./milestones";
export * from "./events";
// repository is INTERNAL to the bounded context — reached only via ./service, which
// owns authorization + policy resolution. Deliberately not re-exported.
export * from "./service";
