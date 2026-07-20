// Platform Event Bus — outward-effect idempotency (Sprint 8).
//
// At-most-once outward effects (a push, an email) REUSE the kernel's durable 3-state
// claim-before-effect ledger (lib/os/host/durable.ts durableIdempotency() over the
// KernelIdempotency table, D-07-fixed). No second idempotency store is created. A
// subscriber claims BEFORE the effect: only the "won" caller performs it; a redelivery
// or replay observes "committed"/"pending" and does NOT re-fire. The key is the effect's
// OWN natural dedupe key (e.g. the notify plan.idempotencyKey), so a retry coalesces.
import type { IdempotencyStore, IdemState, ReplayReceipt } from "@/lib/os/kernel";

// Lazily constructed so importing this module never pulls prisma into a pure path.
// Injectable for tests (an in-memory store models the same 3-state semantics).
let store: IdempotencyStore | null = null;
async function idem(): Promise<IdempotencyStore> {
  if (store) return store;
  const { durableIdempotency } = await import("@/lib/os/host/durable");
  store = durableIdempotency();
  return store;
}

export function __setEffectStore(s: IdempotencyStore | null): void {
  store = s;
}

// Claim before the effect. Returns "won" (you may perform it), "committed" (already
// done — skip), "pending" (in-flight elsewhere — skip), or "failed" (reclaimable).
export async function claimEffect(key: string): Promise<IdemState> {
  return (await idem()).claim(`effect:${key}`);
}

export async function settleEffect(key: string, state: "committed" | "failed", receipt?: ReplayReceipt): Promise<void> {
  await (await idem()).settle(`effect:${key}`, state, receipt);
}
