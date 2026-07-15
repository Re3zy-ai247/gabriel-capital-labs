// Execution Engine — the five-bucket Executive Queue (Sprint XX, ADR-0020). It
// invents no state: each item's bucket is a pure function of the Mission Engine's
// existing `mission.state`, so the queue can never disagree with the engine that
// produced it. DO_NOW / WAITING / BLOCKED / OPTIONAL / COMPLETED.
import type { MissionState } from "@/lib/missionEngine";
import { comparePriority, type ExecutionPriority } from "./ExecutionPriority";

export type ExecutionBucket = "DO_NOW" | "WAITING" | "BLOCKED" | "OPTIONAL" | "COMPLETED";

export const BUCKETS: readonly { key: ExecutionBucket; label: string; blurb: string }[] = [
  { key: "DO_NOW", label: "Do now", blurb: "Actions waiting on you right now." },
  { key: "WAITING", label: "Waiting", blurb: "In flight — Kai is watching the clocks; nothing for you to do." },
  { key: "BLOCKED", label: "Blocked", blurb: "Held until a dependency clears." },
  { key: "OPTIONAL", label: "Optional", blurb: "Strengthening steps you can take any time." },
  { key: "COMPLETED", label: "Completed", blurb: "Already done — from your verified event history." },
];

// mission.state → bucket. Exhaustive over the Mission Engine's MissionState union.
export function bucketOf(state: MissionState): ExecutionBucket {
  switch (state) {
    case "available":
    case "needs_review":
    case "in_progress":
      return "DO_NOW";
    case "waiting":
      return "WAITING";
    case "blocked":
    case "locked":
      return "BLOCKED";
    case "deferred":
      return "OPTIONAL";
    case "completed":
    case "expired":
      return "COMPLETED";
    default:
      return "DO_NOW";
  }
}

// Order any list of priced items by the ladder — stable and reproducible.
export function orderItems<T extends { id: string; priority: ExecutionPriority }>(items: T[]): T[] {
  return [...items].sort((a, b) => comparePriority(a.priority, b.priority, a.id, b.id));
}

// Partition into the five ordered buckets. Empty buckets are still returned (with
// an empty list) so the UI can render every column deterministically.
export function groupIntoBuckets<T extends { id: string; bucket: ExecutionBucket; priority: ExecutionPriority }>(
  items: T[],
): { key: ExecutionBucket; label: string; blurb: string; items: T[] }[] {
  return BUCKETS.map((b) => ({ ...b, items: orderItems(items.filter((i) => i.bucket === b.key)) }));
}
