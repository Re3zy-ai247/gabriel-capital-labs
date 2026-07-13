import type { Bureau } from "@prisma/client";

// Presence enum as type (not exported by Prisma since it's only used in JSON)
export type Presence = "PRESENT" | "ABSENT" | "UNKNOWN";

export interface BureauFields {
  presence: Presence;
  status?: string;
  balanceCents?: number;
  dateReported?: string;
  dofd?: string; // date of first delinquency (ISO)
  remarks?: string;
}

export type BureauData = Partial<Record<Bureau, BureauFields>>;

export function getBureauData(json: unknown): BureauData {
  if (!json || typeof json !== "object") return {};
  return json as BureauData;
}

// Bureaus for which we actually have data parsed.
export function presentBureaus(data: BureauData): Bureau[] {
  return (Object.keys(data) as Bureau[]).filter((b) => data[b]?.presence === "PRESENT");
}

// True only when we can legitimately compare across 2+ bureaus.
export function hasCrossBureauKnowledge(data: BureauData): boolean {
  const known = (Object.keys(data) as Bureau[]).filter(
    (b) => data[b]?.presence === "PRESENT" || data[b]?.presence === "ABSENT"
  );
  return known.length >= 2;
}

// Which specific fields disagree across the bureaus reporting this account —
// ONLY computed when we have knowledge of 2+ bureaus. Never fabricates "other
// bureau doesn't report this". Drives both the conflict sentences below and the
// per-field highlighting in the side-by-side bureau comparison.
export type ConflictField = "balance" | "status" | "dofd";

export function conflictFields(data: BureauData): Set<ConflictField> {
  const out = new Set<ConflictField>();
  if (!hasCrossBureauKnowledge(data)) return out;
  const present = presentBureaus(data);

  const balances = present.map((b) => data[b]?.balanceCents).filter((v) => v != null) as number[];
  if (new Set(balances).size > 1) out.add("balance");

  const statuses = present.map((b) => data[b]?.status?.toLowerCase()).filter(Boolean) as string[];
  if (new Set(statuses).size > 1) out.add("status");

  const dofds = present.map((b) => data[b]?.dofd).filter(Boolean) as string[];
  if (new Set(dofds).size > 1) out.add("dofd");

  return out;
}

const CONFLICT_TEXT: Record<ConflictField, string> = {
  balance: "Balance differs across bureaus reporting this account.",
  status: "Account status differs across bureaus reporting this account.",
  dofd: "Date of first delinquency differs across bureaus — possible re-aging.",
};

// Real, defensible cross-bureau discrepancies as sentences (scoring, letters,
// Kai). Wording is load-bearing — downstream copy quotes these strings.
export function crossBureauConflicts(data: BureauData): string[] {
  return [...conflictFields(data)].map((f) => CONFLICT_TEXT[f]);
}
