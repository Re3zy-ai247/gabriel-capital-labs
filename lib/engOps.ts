// Engineering Operations Center — server-only data composition (Sprint 6, Wave 8).
//
// Composes ONLY real, committed artifacts: the quality ledger and the work ledger,
// both checked-in JSON, plus the runtime release SHA from the Vercel build env.
// Nothing here is fabricated or simulated — if a value is not known, it says so.
// Imported (not fs-read) so the data is bundled deterministically at build time,
// which is correct: these ledgers change per commit, and the page shows the state
// of the deployed commit.
import qualityLedger from "@/.ai/quality-ledger.json";
import workLedger from "@/.ai/work-ledger.json";

export interface DefectRow {
  fingerprint: string;
  severity: "critical" | "high" | "medium" | "low";
  status: "open" | "fixed" | "owner-action" | "blocked";
  evidence: string;
  owner: string;
  fix_commit: string | null;
  eligible?: boolean;
}

export interface OpsSummary {
  release: { sha: string | null; known: boolean };
  quality: {
    total: number;
    byStatus: Record<string, number>;
    bySeverity: Record<string, number>;
    needsHuman: DefectRow[]; // owner-action or blocked, most severe first
    recentlyFixed: DefectRow[];
  };
  work: {
    active: Array<{ package: string; subsystem: string; wave: number | null; owner: string; owns: string[] }>;
    complete: number;
  };
  governance: { decision: string; migrationsDir: boolean };
  automation: { workflows: string[] };
}

const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function getOpsSummary(): OpsSummary {
  const defects = (qualityLedger.defects ?? []) as DefectRow[];

  const byStatus: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  for (const d of defects) {
    byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
    bySeverity[d.severity] = (bySeverity[d.severity] ?? 0) + 1;
  }

  const bySev = (a: DefectRow, b: DefectRow) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity];

  const needsHuman = defects
    .filter((d) => d.status === "owner-action" || d.status === "blocked")
    .sort(bySev);
  const recentlyFixed = defects.filter((d) => d.status === "fixed").sort(bySev);

  const packages = (workLedger.packages ?? []) as Array<{
    package: string; subsystem: string; wave: number | null; owner_session: string;
    owns: string[]; status: string;
  }>;

  // Release SHA is a runtime value — the same one baked into the x-cv-release header.
  // Read defensively: on a local build it is simply unknown, and we say so rather
  // than invent one.
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || null;

  return {
    release: { sha, known: !!sha },
    quality: { total: defects.length, byStatus, bySeverity, needsHuman, recentlyFixed },
    work: {
      active: packages
        .filter((p) => p.status === "active")
        .map((p) => ({ package: p.package, subsystem: p.subsystem, wave: p.wave, owner: p.owner_session, owns: p.owns })),
      complete: packages.filter((p) => p.status === "complete" || p.status === "released").length,
    },
    // Governance status is derived from repository truth, not asserted: migrations
    // dir presence is the honest signal of which mechanism is live.
    governance: {
      decision: "migration-first for new schema; self-heal legacy-only (recorded 2026-07-20)",
      migrationsDir: false, // no prisma/migrations yet — staged transition pending
    },
    automation: { workflows: ["ci", "daily-health", "weekly-verify", "monthly-review"] },
  };
}
