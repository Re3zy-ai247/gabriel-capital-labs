// Kai Case Memory (Phase C, Sprint 3) — CVI module.
// ─────────────────────────────────────────────────────────────────────────────
// PROJECTION-FIRST memory: the case record (letters, responses, rounds,
// windows, events) IS the memory — Kai "remembers" by deterministically
// projecting rows that already exist, so recall is auditable (every memory
// entry carries the graph ref it came from) and requires NO new persistence.
// This deliberately honors ADR-0006: the founder gate on a server-side
// persistent Kai memory STORE stays closed — the optional preference/notes
// store below is DORMANT behind KAI_CASE_MEMORY (default OFF) and holds only
// user-stated preferences (never derived profiles, never AI text).
import type { CreditGraph } from "./graph";

export interface MemoryEntry {
  kind: "dispute" | "response" | "strategy" | "deadline" | "note";
  text: string;
  evidence: string; // graph ref — every memory is auditable
  at: string | null; // ISO when the record carries one; never fabricated
}

export interface CaseMemory {
  entries: readonly MemoryEntry[];
  rounds: number; // highest letter round on record
  respondedCount: number;
  openDeadlines: number;
}

/** Pure projection: same graph → deep-equal memory. */
export function projectCaseMemory(g: CreditGraph): CaseMemory {
  const entries: MemoryEntry[] = [];
  let rounds = 0;
  for (const l of g.nodes.filter((n) => n.kind === "letter")) {
    rounds = Math.max(rounds, Number(l.facts.round ?? 1));
    entries.push({ kind: "dispute", text: l.label, evidence: l.ref, at: (l.facts.mailedAt as string | null) ?? null });
  }
  const responses = g.nodes.filter((n) => n.kind === "response");
  for (const r of responses) {
    entries.push({ kind: "response", text: r.label, evidence: r.ref, at: (r.facts.at as string | null) ?? null });
  }
  const windows = g.nodes.filter((n) => n.kind === "dispute_window");
  for (const w of windows) {
    entries.push({ kind: "deadline", text: `${w.label} — ${String(w.facts.daysLeft)} days left`, evidence: w.ref, at: null });
  }
  return { entries, rounds, respondedCount: responses.length, openDeadlines: windows.length };
}

export function caseMemoryStoreEnabled(): boolean {
  return process.env.KAI_CASE_MEMORY === "true"; // ADR-0006 founder gate — default OFF
}
