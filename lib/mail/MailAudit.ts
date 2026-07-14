// The mail audit trail — CreditVector's record of process. Every meaningful
// moment in a mail piece's life is appended here; entries are never edited or
// removed. Append-only is enforced by the application at the store boundary
// (assertAppendOnly, called in MailStore.saveProgress) — not by an external
// tamper-proof mechanism, so we describe it as "append-only", not "tamper-proof".
// It records the process story: "report uploaded → Kai analysis → letter
// generated → reviewed → approved → paid → printed → carrier accepted →
// delivered → response logged" — facts about what happened, never a prediction
// of a dispute outcome.
import type { MailStatus } from "./MailStatus";

export class MailAuditError extends Error {
  constructor(message: string) { super(message); this.name = "MailAuditError"; }
}

export type AuditActor = "system" | "user" | "provider" | "kai";

export interface AuditEntry {
  seq: number;              // monotonic, 0-based; gaps/reorders are detectable
  at: string;               // ISO timestamp (caller supplies — deterministic in tests)
  actor: AuditActor;
  event: string;            // short verb phrase, e.g. "job.created", "status.advanced"
  fromStatus?: MailStatus;
  toStatus?: MailStatus;
  detail?: string;          // human-readable; never secrets, never raw PII dumps
  providerRef?: string;     // provider job id / tracking number when relevant
}

// Append returns a NEW array; the input is never mutated. Callers persist the
// returned trail. `seq` is assigned from the current length, so a correct caller
// always appends to the latest trail.
export function appendAudit(
  trail: readonly AuditEntry[],
  entry: Omit<AuditEntry, "seq">,
): AuditEntry[] {
  return [...trail, { ...entry, seq: trail.length }];
}

// Verify the trail is well-formed: contiguous seq from 0 and non-decreasing time.
// Used by the store before persisting and by guards. Returns the first problem
// or null when the trail is sound.
export function validateAuditTrail(trail: readonly AuditEntry[]): string | null {
  for (let i = 0; i < trail.length; i++) {
    if (trail[i].seq !== i) return `seq gap at index ${i}: expected ${i}, got ${trail[i].seq}`;
    if (i > 0 && trail[i].at < trail[i - 1].at) return `time went backwards at seq ${i}`;
  }
  return null;
}

// Enforce append-only at a write boundary: `next` must extend `prev` with every
// existing entry byte-identical and be internally well-formed. Throws
// MailAuditError otherwise. This is what makes the store — not just the caller —
// the guarantor of the append-only record.
export function assertAppendOnly(prev: readonly AuditEntry[], next: readonly AuditEntry[]): void {
  if (next.length < prev.length) {
    throw new MailAuditError(`audit trail shrank (${prev.length} → ${next.length}) — trails are append-only`);
  }
  for (let i = 0; i < prev.length; i++) {
    if (JSON.stringify(prev[i]) !== JSON.stringify(next[i])) {
      throw new MailAuditError(`audit entry ${i} was rewritten — existing entries are immutable`);
    }
  }
  const problem = validateAuditTrail(next);
  if (problem) throw new MailAuditError(`audit trail invalid: ${problem}`);
}

// A one-line, user-safe rendering of the trail for the process-record view.
export function summarizeAudit(trail: readonly AuditEntry[]): string[] {
  return trail.map((e) => {
    const when = e.at.slice(0, 10);
    const what = e.toStatus ? `${e.event} → ${e.toStatus}` : e.event;
    return `${when} · ${what}`;
  });
}
