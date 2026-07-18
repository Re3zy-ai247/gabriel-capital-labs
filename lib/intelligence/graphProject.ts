// projectGraphInput — the PURE, DETERMINISTIC core of the case → GraphInput loader.
// ─────────────────────────────────────────────────────────────────────────────
// Deliberately free of any I/O import (no prisma) so it is unit-testable with
// plain fixtures and runs with no database — mirroring the codebase's own split:
// graph.ts owns structure, snapshot/loaders own I/O (graph.ts header). The async,
// tenant-safe loader that reads the DB lives in ./graphLoader and calls this.
//
// AUTHORITY: introduces NO new concept — it feeds the already-ratified Unified
// Credit Graph (graph.ts, Phase C / ADR-0019). Reuse-first (Constitution
// Art. VI.3): reuses the existing bureau-provenance parser (lib/bureauData.ts)
// and the canonical §611 window constant (lib/forecast.ts); adds no second graph
// model and no new engine.
//
// HONESTY (Law V): absent data stays absent — never invented, never "verified".
// Furnisher/contact identity is derived downstream from the stored creditorName /
// recipientName, so passing those verbatim preserves any user correction on file.
// No address is read or synthesised. No LLM anywhere.
import { REINVESTIGATION_DAYS } from "@/lib/forecast";
import { getBureauData, presentBureaus } from "@/lib/bureauData";
import type { GraphInput } from "./graph";

// The exact fields the loader SELECTs, as explicit row shapes (not the full
// Prisma models) so this projector needs no database. Enum columns are carried
// as their string values — graph.ts and reasoning.ts key off node.kind and the
// canonical enum strings (e.g. probability "NOT_RECOMMENDED"), so no remapping
// is needed or wanted.
export interface TradelineRow {
  id: string;
  creditorName: string;
  accountType: string; // AccountType enum value
  isDebtBuyer: boolean;
  balance: number; // cents
  probability: string; // Probability enum value
  bureauData: unknown; // JSON keyed by bureau; getBureauData parses defensively
  dateReported: Date | null;
  dateOpened: Date | null;
}
export interface LetterRow {
  id: string;
  tradelineId: string | null;
  recipientName: string;
  recipientType: string; // "bureau" | "furnisher" | "collector"
  targetBureau: string | null; // Bureau enum value
  round: number;
  status: string; // LetterStatus enum value
  mailedAt: Date | null;
  responseAt: Date | null;
  responseOutcome: string | null;
}
export interface CaseRows {
  userId: string;
  tradelines: TradelineRow[];
  letters: LetterRow[];
}

const RECIPIENT_TYPES = ["bureau", "furnisher", "collector"] as const;
type RecipientType = (typeof RECIPIENT_TYPES)[number];
// Fail closed to the §611 bureau default (the same default buildCreditGraph
// applies) if a stored recipientType is ever outside the known set.
const normalizeRecipientType = (v: string): RecipientType =>
  (RECIPIENT_TYPES as readonly string[]).includes(v) ? (v as RecipientType) : "bureau";

const MS_PER_DAY = 86_400_000;
const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * PURE, DETERMINISTIC projection of a user's case rows into GraphInput.
 * Same rows + same `asOf` → deep-equal GraphInput regardless of input order
 * (rows are sorted by id). INQUIRY and PUBLIC_RECORD rows are partitioned into
 * their own graph sections (they are stored as Tradeline rows but are not
 * disputable tradelines); every other account type stays a tradeline
 * (buildCreditGraph classifies COLLECTION via its own regex). Bureau provenance
 * comes only from bureaus marked PRESENT. Open §611 windows are measured against
 * the injected `asOf` — the ONLY time input.
 */
export function projectGraphInput(rows: CaseRows, asOf: Date): GraphInput {
  const tls = [...rows.tradelines].sort(byId);
  const letterRows = [...rows.letters].sort(byId);

  const tradelines: NonNullable<GraphInput["tradelines"]> = [];
  const inquiries: NonNullable<GraphInput["inquiries"]> = [];
  const publicRecords: NonNullable<GraphInput["publicRecords"]> = [];

  for (const t of tls) {
    if (t.accountType === "INQUIRY") {
      inquiries.push({ id: t.id, name: t.creditorName, at: (t.dateReported ?? t.dateOpened)?.toISOString() ?? null });
    } else if (t.accountType === "PUBLIC_RECORD") {
      publicRecords.push({ id: t.id, kind: t.creditorName });
    } else {
      // Everything else (incl. GOVERNMENT) stays a tradeline node — a real account
      // is never dropped. GOVERNMENT is non-disputable by definition and every
      // canonical writer stores it NOT_RECOMMENDED, so reason() withholds any
      // dispute recommendation for it. PRE-PHASE-C-ACTIVATION GATE: before the
      // KAI_GRAPH_LOADER flag is ever flipped over real cases, mirror the explicit
      // accountType==="GOVERNMENT" exclusion in snapshot.ts/recommend.ts so the
      // graph path cannot diverge from the canonical disputable definition.
      tradelines.push({
        id: t.id,
        creditorName: t.creditorName,
        accountType: t.accountType,
        probability: t.probability,
        balance: t.balance,
        bureaus: presentBureaus(getBureauData(t.bureauData)), // provenance: PRESENT only, never fabricated
        isDebtBuyer: t.isDebtBuyer,
      });
    }
  }

  const letters: GraphInput["letters"] = letterRows.map((l) => ({
    id: l.id,
    tradelineId: l.tradelineId ?? undefined,
    recipient: l.recipientName,
    bureau: l.targetBureau ?? undefined,
    round: l.round,
    status: l.status,
    mailedAt: l.mailedAt?.toISOString() ?? undefined,
    responseOutcome: l.responseOutcome ?? undefined,
    responseAt: l.responseAt?.toISOString() ?? undefined,
  }));

  const asOfMs = asOf.getTime();
  const openWindows: NonNullable<GraphInput["openWindows"]> = [];
  for (const l of letterRows) {
    // An open window is a mailed letter with no logged response — the same
    // predicate loadSnapshot uses, extended with the letter's own recipientType
    // so the law stage cites the right statute (§611 · §623 · FDCPA §809).
    if (l.status === "MAILED" && l.mailedAt && !l.responseAt) {
      const daysElapsed = Math.floor((asOfMs - l.mailedAt.getTime()) / MS_PER_DAY);
      openWindows.push({
        letterId: l.id,
        recipient: l.recipientName,
        daysElapsed,
        daysLeft: REINVESTIGATION_DAYS - daysElapsed,
        recipientType: normalizeRecipientType(l.recipientType),
      });
    }
  }

  const out: GraphInput = { userId: rows.userId, tradelines, letters };
  // Optional sections are attached only when present — an empty section is left
  // absent (honesty), never emitted as a fabricated empty array.
  if (inquiries.length) out.inquiries = inquiries;
  if (publicRecords.length) out.publicRecords = publicRecords;
  if (openWindows.length) out.openWindows = openWindows;
  // readinessGoals / businessEntities have no persisted source today, so they
  // are omitted rather than invented; buildCreditGraph treats both as optional.
  return out;
}
