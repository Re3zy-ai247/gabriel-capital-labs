// Platform Event Bus — in-process subscriber registry + fanout (Sprint 8).
//
// This is a DELIBERATE FORK of the kernel's emit/subscribe loop (lib/os/kernel/kernel.ts),
// NOT a reuse: the kernel handler signature is (type: string) => void — it delivers
// only the type string, which is useless to a real subscriber. Here handlers receive
// the FULL PlatformEvent (payload-widened). Event types are flat UPPER_SNAKE with no
// dotted hierarchy, so matching is exact-or-"*" (no prefix globbing needed).
//
// Delivery is best-effort and isolated: a throwing handler is caught and logged, never
// failing the publish (the event is already durably persisted, so a failed subscriber
// catches up via replayEvents). Handlers are TRUSTED system code and MUST be idempotent
// (at-least-once). Per-(event,subscription) dedupe mirrors the kernel's eventSeen set.
import type { EventType, PlatformEvent } from "./envelope";

export type EventHandler = (event: PlatformEvent) => void | Promise<void>;
type Pattern = EventType | "*";
interface Subscription { id: string; pattern: Pattern; handler: EventHandler }

const subscriptions: Subscription[] = [];
const delivered = new Set<string>(); // `${event.id}:${subscription.id}` — in-process at-least-once dedupe

// Register a subscriber. `id` is a stable subscription name (dedupe + idempotent
// re-registration). A repeated (id) replaces the prior handler rather than doubling it.
export function subscribe(id: string, pattern: Pattern, handler: EventHandler): void {
  const existing = subscriptions.findIndex((s) => s.id === id);
  if (existing >= 0) subscriptions.splice(existing, 1);
  subscriptions.push({ id, pattern, handler });
}

export function clearSubscriptions(): void {
  subscriptions.length = 0;
  delivered.clear();
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
    const key = `${event.id}:${s.id}`;
    if (delivered.has(key)) continue;
    delivered.add(key);
    try {
      await s.handler(event);
    } catch (e) {
      // Never fail the publish on a subscriber error — the event is durable; the
      // subscriber can be re-driven via replay. Log on the app's existing path.
      console.error(`eventBus: subscriber ${s.id} threw on ${event.type} (${event.id}):`, e);
    }
  }
}
