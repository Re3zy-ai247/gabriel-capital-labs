import Link from "next/link";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import type { HealthSignal, CapacityInfo, Standing } from "@/lib/missionControl";

// CXOS Phase 4 — the Command Header: Mission Control's identity/status band.
// Pure presentation over REAL resolved state (zone 1 of the room). Account
// controls (sign out, settings, billing) already live in the Sidebar — this
// band reports who is operating, under what clearance and plan, and whether
// the room is green. Nothing here is invented; every value arrives from the
// same server load the dashboard already performs.
export function CommandHeader({
  firstName,
  identity,
  role,
  plan,
  health,
  standing,
  capacity,
  isAgency,
}: {
  firstName: string;
  identity: string;
  role: "ADMIN" | "AGENCY" | "OPERATOR";
  plan: string;
  health: Pick<HealthSignal, "label" | "status">[];
  /**
   * RC1 S7 (finding C-05). The band used to roll up `health` alone, and every
   * signal's else-branch is green, so an account that had done NOTHING scored
   * all-green and this pill read "ALL SYSTEMS GREEN" — beside "Upload your
   * credit report to get started" and "Still open: 1". On a credit product
   * that pill reads as a claim about the consumer's FILE. An empty queue is
   * not health, so the engine now hands the band its own fourth state and
   * this component reports it instead of inferring green from silence.
   *
   * Optional ONLY for the founder-review fixture stage
   * (app/review/mission-control/stage.tsx), which is gated behind
   * reviewBuildAllowed() and 404s in production, so it is not a consumer
   * surface and has no engine to ask. Every real render passes it, and
   * scripts/dashboard-ranking.test.ts pins that the live consumer room does.
   * (Do not name the live room's file path here: scripts/cxos-isolated-review
   * .test.ts scans this source for exactly that string, to prove a review
   * fixture never reaches into production code.)
   */
  standing?: Standing;
  capacity: CapacityInfo | null;
  isAgency: boolean;
}) {
  const reds = health.filter((h) => h.status === "red");
  const ambers = health.filter((h) => h.status === "amber");
  const rollup: Standing =
    standing === "unstarted" ? "unstarted" : reds.length ? "red" : ambers.length ? "amber" : "green";
  const tone =
    rollup === "unstarted"
      ? "border-ink-600 text-slate-400"
      : rollup === "green"
        ? "border-success-500/40 text-success-400"
        : rollup === "amber"
          ? "border-gold-400/40 text-gold-400"
          : "border-rose-500/40 text-rose-400";
  const label =
    rollup === "unstarted"
      ? "NOT STARTED"
      : rollup === "green"
        ? "ALL SYSTEMS GREEN"
        : rollup === "amber"
          ? "ATTENTION NEEDED"
          : "ACTION REQUIRED";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-ink-700/60 bg-ink-900/50 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/15 text-brand-300">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{firstName}</div>
          <div className="truncate text-[11px] text-slate-500">{identity}</div>
        </div>
      </div>

      <span className="rounded-full border border-ink-600 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-slate-300">
        {role === "ADMIN" ? "ADMINISTRATOR" : role === "AGENCY" ? "AGENCY OPERATOR" : "OPERATOR"}
      </span>
      <span className="rounded-full border border-brand-500/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-brand-300">
        {plan}
      </span>
      {isAgency && capacity && (
        <span className="text-[11px] tabular-nums text-slate-400">
          {capacity.stagedCount}/{capacity.policyMax} workspaces
        </span>
      )}

      <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-widest ${tone}`}>
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
        {label}
      </span>
      {reds.length > 0 && (
        <Link href="#health" className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-300 hover:text-rose-200">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {reds.length} urgent
        </Link>
      )}
    </div>
  );
}
