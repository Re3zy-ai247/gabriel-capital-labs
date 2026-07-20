// Platform Event Bus — in-process subscriber registry + fanout (Sprint 8).
//
// This is a DELIBERATE FORK of the kernel's emit/subscribe loop (lib/os/kernel/kernel.ts),
// NOT a reuse: the kernel handler signature is (type: string) => void — it delivers only
// the type string, which is useless to a real subscriber. Here handlers receive the FULL
// PlatformEvent (payload-widened). Event types are flat UPPER_SNAKE with no dotted
// hierarchy, so matching is exact-or-"*" (no prefix globbing needed).
//
// DELIVERY CONTRACT (honest): best-effort, AT-MOST-ONCE per persisted event. publish()
// fans out ONLY on a FRESH persist (a replayed/duplicate publish never calls deliver — see
// publish.ts), and within one deliver() each subscription id is visited once, so no
// subscriber is double-fired. There is NO automatic re-drive of a FAILED handler today: a
// throwing handler is caught and logged, the durable persist stands, and — for EFFECTFUL
// subscribers — the kernel durable effect ledger (effect.ts) already guarantees at-most-once
// (a redelivery observes "committed"→skip; a "failed" claim is reclaimable). A replay-DRIVEN
// redelivery worker that re-feeds unsettled events through deliver() is a deferred,
// owner-gated integration (readSince/replayEvents are read-only observability, not a
// re-drive path). Handlers MUST be idempotent regardless.
import type { EventType, PlatformEvent } from "./envelope";

export type EventHandler = (event: PlatformEvent) => void | Promise<void>;
type Pattern = EventType | "*";
interface Subscription { id: string; pattern: Pattern; handler: EventHandler }

const subscriptions: Subscription[] = [];

// Register a subscriber. `id` is a stable subscription name (idempotent re-registration).
// A repeated (id) replaces the prior handler rather than doubling it.
export function subscribe(id: string, pattern: Pattern, handler: EventHandler): void {
  const existing = subscriptions.findIndex((s) => s.id === id);
  if (existing >= 0) subscriptions.splice(existing, 1);
  subscriptions.push({ id, pattern, handler });
}

export function clearSubscriptions(): void {
  subscriptions.length = 0;
}

export function subscriberIds(): string[] {
  return subscriptions.map((s) => s.id);
}

function matches(pattern: Pattern, type: EventType): boolean {
  return pattern === "*" || pattern === type;
}

// Fan out one event to every matching subscriber, once each. Called by publish() ONLY
// after a fresh (non-replayed) durable persist, so a replay never double-delivers.
export async function deliver(event: PlatformEvent): Promise<void> {
  for (const s of subscriptions) {
    if (!matches(s.pattern, event.type)) continue;
    try {
      await s.handler(event);
    } catch (e) {
      // Never fail the publish on a subscriber error — the event is durable, and an
      // effectful subscriber's at-most-once is enforced by the durable effect ledger.
      console.error(`eventBus: subscriber ${s.id} threw on ${event.type} (${event.id}):`, e);
    }
  }
}
