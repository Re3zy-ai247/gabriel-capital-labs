// Arena Contribution Policy — COMPATIBILITY RE-EXPORT (Sprint 10 ownership move).
//
// The canonical scoring policy MOVED to lib/reputation/scoring.ts. Reputation is the
// PLATFORM SERVICE that owns reputation policy (weights, classes, evidence caps,
// refusals, the idempotency-key rule, the level/rank curve); Arena is an EXPERIENCE that
// consumes it — the constitutional direction is Identity → Event Fabric → Reputation →
// Arena. This file re-exports the canonical implementation UNCHANGED, so the shipped
// arena UI (app/arena, app/admin/arena) and lib/arena/* keep working byte-for-byte.
//
// DO NOT add or edit policy here — change lib/reputation/scoring.ts. Human-readable
// policy: ARENA-CONTRIBUTION-POLICY.md. (This seam exists only for compatibility during
// the Arena-consumes-Reputation transition; Arena never re-defines reputation policy.)
export * from "@/lib/reputation/scoring";
