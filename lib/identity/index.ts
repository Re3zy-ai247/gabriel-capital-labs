// Operator Identity — public surface (Sprint 9). The bounded context's barrel; other
// platform services consume identity through this module, never by reaching into a table.
// Dormant behind OPERATOR_IDENTITY_ENABLED (fail-closed) until the owner-gated migration
// + activation.
export * from "./flags";
export * from "./state";
export * from "./rbac";
export * from "./validation";
export * from "./principal";
export * from "./events";
// repository is INTERNAL to the bounded context — reached only via ./service, which
// owns authorization + isolation. It is deliberately not re-exported here.
export * from "./service";
export * from "./profileMedia";
