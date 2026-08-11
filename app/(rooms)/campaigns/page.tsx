"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Disclaimer } from "@/components/Disclaimer";
import {
  Loader2, Layers, CheckCircle2, Clock, XCircle, AlertTriangle, Scale, Sparkles,
  ChevronDown, ArrowRight, ShieldCheck, Send,
} from "lucide-react";

// ---- types mirrored from the campaign API (pure display shapes) ----
type Family = "bureau_reinvestigation" | "obsolescence" | "furnisher_direct" | "collector_validation" | "mixed";
type WarnCat = "law" | "policy" | "recommendation";
interface Warn { category: WarnCat; text: string }
interface Item {
  tradelineId: string; creditorName: string; recipientType: string; bureaus: string[];
  strategyId: string | null; strategyLabel: string; decision: "included" | "deferred" | "excluded";
  reason: string; pages: number; letterId: string | null; queued: boolean;
}
interface Recommended {
  strategyFamily: Family; items: Item[]; rationale: string; warnings: Warn[];
  nextUnlock: string[]; hasRecommendation: boolean; pages: number; includedCount: number;
}
interface CaseItem {
  tradelineId: string; creditorName: string; recipientType: string; strategyLabel: string;
  probability: string; bureaus: string[]; disputable: boolean; activeInvestigation: boolean; alreadyInFlight: boolean;
}
interface Review {
  size: { verdict: "within" | "warn" | "over_ceiling"; includedCount: number; messages: string[] };
  families: { family: Family; label: string; count: number }[];
  recipientCount: number; conflicts: string[];
  weakItems: { tradelineId: string; creditorName: string; reason: string }[];
  recommendedSplit: { includeNow: string[]; defer: string[] };
  projectedSequence: { family: Family; label: string; count: number }[];
  warnings: Warn[]; expandedAllowed: boolean;
}
interface CampaignSummary {
  id: string; sequence: number; status: string; strategyFamily: Family; rationale: string;
  includedCount: number; createdAt: string; approvedAt: string | null; userDecision: string | null;
}
interface Data {
  recommended: Recommended; caseItems: CaseItem[]; nextSequence: number;
  policy: { recommendedMax: number; hardCeiling: number; warnThreshold: number };
  campaigns: CampaignSummary[];
}

const FAMILY_LABEL: Record<Family, string> = {
  bureau_reinvestigation: "Bureau reinvestigation (§611)",
  obsolescence: "Obsolete-item removal (§605)",
  furnisher_direct: "Direct furnisher dispute (§623)",
  collector_validation: "Debt validation (FDCPA §1692g)",
  mixed: "Mixed pathways",
};
const RECIPIENT_LABEL: Record<string, string> = { bureau: "Credit bureaus", furnisher: "Furnisher", collector: "Collector" };
const CAT_LABEL: Record<WarnCat, string> = { law: "The law", policy: "CreditVector policy", recommendation: "Kai's take" };
const CAT_TONE: Record<WarnCat, string> = {
  law: "border-ocean-500/30 bg-ocean-500/10 text-ocean-300",
  policy: "border-gold-500/30 bg-gold-500/10 text-gold-400",
  recommendation: "border-brand-500/30 bg-brand-500/10 text-brand-200",
};
const STATUS_TONE: Record<string, string> = {
  RECOMMENDED: "bg-brand-500/15 text-brand-300", NEEDS_REVIEW: "bg-gold-500/15 text-gold-400",
  APPROVED: "bg-ocean-500/15 text-ocean-300", ACTIVE: "bg-ocean-500/15 text-ocean-300",
  WAITING: "bg-slate-500/15 text-slate-300", RESPONSE_RECEIVED: "bg-gold-500/15 text-gold-400",
  COMPLETED: "bg-success-500/15 text-success-300", CANCELED: "bg-slate-500/15 text-slate-400",
  SUPERSEDED: "bg-slate-500/15 text-slate-400",
};

export default function CampaignsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"overview" | "customize">("overview");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/campaigns").catch(() => null);
    const j = await res?.json().catch(() => null);
    if (res?.ok && j) setData(j);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function useRecommended() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", mode: "recommended" }),
      }).catch(() => null);
      const j = await res?.json().catch(() => ({}));
      if (!res?.ok) { setError(j?.error || "Couldn't build that campaign."); return; }
      const id = j.campaign.id;
      const ap = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      }).catch(() => null);
      const aj = await ap?.json().catch(() => ({}));
      if (!ap?.ok) { setError(aj?.error || "Couldn't approve the campaign."); return; }
      setFlash(`Campaign ${aj.campaign.sequence} approved. Draft and mail these letters — I'll keep them under this campaign.`);
      await load();
    } catch { setError("The connection dropped mid-request. Try again — nothing was lost."); }
    finally { setBusy(false); }
  }

  if (loading) return <CenterSpinner />;
  if (!data) return <div className="card p-6 text-sm text-slate-400" role="alert">Couldn&apos;t load your campaigns. <button onClick={load} className="text-brand-300 underline">Retry</button></div>;

  const disputable = data.caseItems.filter((i) => i.disputable);
  const rec = data.recommended;

  return (
    <>
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
          <h2 className="text-xl font-semibold">Campaign planner</h2>
        </div>
        <p className="mb-5 text-sm text-slate-400">
          Rather than mail every item at once, I organize your file into focused, evidence-supported campaigns —
          sequenced so each dispute gets its clearest footing. You&apos;re always free to send more; this is guidance, not a limit.
        </p>

        {flash && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-success-500/40 bg-success-500/10 p-3 text-sm text-success-200" role="status">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {flash}
          </div>
        )}
        {error && <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300" role="alert">{error}</div>}

        {disputable.length === 0 ? (
          <EmptyState />
        ) : mode === "overview" ? (
          <>
            {rec.hasRecommendation ? (
              <RecommendedCard rec={rec} seq={data.nextSequence} busy={busy}
                onUse={useRecommended} onCustomize={() => setMode("customize")} />
            ) : (
              <div className="card p-6">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
                  <h3 className="text-lg font-semibold">Nothing new to send right now</h3>
                </div>
                <p className="text-sm text-slate-400">{rec.rationale}</p>
                {rec.nextUnlock.length > 0 && <UnlockList lines={rec.nextUnlock} />}
                <DecisionLists rec={rec} />
              </div>
            )}
          </>
        ) : (
          <Customize
            caseItems={disputable} policy={data.policy} seq={data.nextSequence}
            defaultSelected={rec.items.filter((i) => i.decision === "included").map((i) => i.tradelineId)}
            onBack={() => setMode("overview")}
            onDone={(msg) => { setMode("overview"); setFlash(msg); load(); }}
            onError={setError}
          />
        )}

        {data.campaigns.length > 0 && <ExistingCampaigns campaigns={data.campaigns} onChanged={load} />}
        <Disclaimer />
      </div>
    </>
  );
}

function RecommendedCard({ rec, seq, busy, onUse, onCustomize }: {
  rec: Recommended; seq: number; busy: boolean; onUse: () => void; onCustomize: () => void;
}) {
  const included = rec.items.filter((i) => i.decision === "included");
  return (
    <div className="card p-5">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI RECOMMENDS</span>
        <h3 className="text-lg font-semibold">Campaign {seq} — {FAMILY_LABEL[rec.strategyFamily]}</h3>
      </div>
      <p className="mb-4 text-sm text-slate-300">{rec.rationale}</p>

      <div className="mb-4 flex flex-wrap gap-2 text-[11px]">
        <Stat icon={<Layers className="h-3.5 w-3.5" />} label={`${rec.includedCount} item${rec.includedCount === 1 ? "" : "s"}`} />
        <Stat icon={<Send className="h-3.5 w-3.5" />} label={`~${rec.pages} page package`} />
      </div>

      <ul className="mb-4 space-y-2">
        {included.map((i) => (
          <li key={i.tradelineId} className="rounded-lg border border-ink-700 bg-ink-900/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium text-slate-200">{i.creditorName}</div>
              <span className="pill bg-ink-700 text-slate-300">{RECIPIENT_LABEL[i.recipientType] ?? i.recipientType}{i.recipientType === "bureau" && i.bureaus.length ? ` · ${i.bureaus.length}` : ""}</span>
            </div>
            <div className="mt-1 text-xs text-slate-400">{i.strategyLabel}</div>
            <div className="mt-1 text-[11px] text-slate-500">{i.reason}</div>
            <Link href={`/letters?tradeline=${i.tradelineId}${i.strategyId ? `&strategy=${i.strategyId}` : ""}`}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-300 hover:underline">
              Draft &amp; mail this <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>

      {rec.warnings.length > 0 && <Warnings warnings={rec.warnings} />}
      <DecisionLists rec={rec} />
      {rec.nextUnlock.length > 0 && <UnlockList lines={rec.nextUnlock} />}

      <p className="mt-4 flex items-start gap-2 rounded-lg border border-ink-700 bg-ink-900/50 p-3 text-[11px] text-slate-400">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
        This is a focused, evidence-supported sequence — not a guaranteed or &ldquo;optimal&rdquo; outcome. Mailing any dispute starts a
        process under the FCRA; it doesn&apos;t promise any item is changed or removed.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={onUse} disabled={busy} className="btn-primary min-h-[44px]">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />} Use this campaign
        </button>
        <button onClick={onCustomize} disabled={busy} className="btn-ghost min-h-[44px]">Review &amp; customize</button>
      </div>
    </div>
  );
}

function DecisionLists({ rec }: { rec: Recommended }) {
  const deferred = rec.items.filter((i) => i.decision === "deferred");
  const excluded = rec.items.filter((i) => i.decision === "excluded");
  if (deferred.length === 0 && excluded.length === 0) return null;
  return (
    <div className="mt-2 space-y-2">
      {deferred.length > 0 && (
        <Disclosure summary={`Held for a later campaign (${deferred.length})`} icon={<Clock className="h-3.5 w-3.5 text-gold-400" />}>
          {deferred.map((i) => <ReasonRow key={i.tradelineId} name={i.creditorName} reason={i.reason} />)}
        </Disclosure>
      )}
      {excluded.length > 0 && (
        <Disclosure summary={`Set aside — not recommended to dispute (${excluded.length})`} icon={<XCircle className="h-3.5 w-3.5 text-slate-500" />}>
          {excluded.map((i) => <ReasonRow key={i.tradelineId} name={i.creditorName} reason={i.reason} />)}
        </Disclosure>
      )}
    </div>
  );
}

function Customize({ caseItems, policy, seq, defaultSelected, onBack, onDone, onError }: {
  caseItems: CaseItem[]; policy: Data["policy"]; seq: number; defaultSelected: string[];
  onBack: () => void; onDone: (msg: string) => void; onError: (e: string) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultSelected));
  const [review, setReview] = useState<Review | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ack, setAck] = useState(false);
  const [rationale, setRationale] = useState("");
  const ids = useMemo(() => [...selected], [selected]);

  useEffect(() => {
    if (ids.length === 0) { setReview(null); return; }
    setReviewing(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      const res = await fetch("/api/campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "review", tradelineIds: ids }), signal: ctrl.signal,
      }).catch(() => null);
      const j = await res?.json().catch(() => null);
      if (res?.ok && j?.review) setReview(j.review);
      setReviewing(false);
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [ids]);

  function toggle(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function create(mode: "custom" | "expanded") {
    setBusy(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", mode, tradelineIds: ids }),
      }).catch(() => null);
      const j = await res?.json().catch(() => ({}));
      if (!res?.ok) { onError(j?.error || "Couldn't build that campaign."); setBusy(false); return; }
      const id = j.campaign.id;
      const ap = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", expandedAck: mode === "expanded", rationale: mode === "expanded" ? rationale : undefined }),
      }).catch(() => null);
      const aj = await ap?.json().catch(() => ({}));
      if (!ap?.ok) { onError(aj?.error || "Couldn't approve the campaign."); setBusy(false); return; }
      onDone(`Campaign ${aj.campaign.sequence} approved (${aj.campaign.items.filter((x: Item) => x.decision === "included").length} items). Draft and mail these letters — I'll keep them under this campaign.`);
    } catch { onError("The connection dropped mid-request. Try again — nothing was lost."); setBusy(false); }
  }

  const over = review?.size.verdict === "over_ceiling";
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Review &amp; customize</h3>
        <button onClick={onBack} className="btn-ghost text-xs">← Back to Kai&apos;s pick</button>
      </div>
      <p className="mb-3 text-sm text-slate-400">Pick the items you want to send. I&apos;ll show you how they fit together and recommend a focused sequence — the choice stays yours.</p>

      <ul className="mb-4 divide-y divide-ink-700/50">
        {caseItems.map((i) => (
          <li key={i.tradelineId} className="flex items-start gap-3 py-2">
            <input type="checkbox" checked={selected.has(i.tradelineId)} onChange={() => toggle(i.tradelineId)}
              className="mt-1 h-4 w-4 accent-brand-500" aria-label={`Select ${i.creditorName}`} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-200">
                {i.creditorName}
                <span className="pill bg-ink-700 text-slate-400">{RECIPIENT_LABEL[i.recipientType] ?? i.recipientType}</span>
                {i.activeInvestigation && <span className="pill bg-gold-500/15 text-gold-400">dispute open</span>}
                {i.alreadyInFlight && !i.activeInvestigation && <span className="pill bg-slate-500/15 text-slate-400">in progress</span>}
              </div>
              <div className="text-xs text-slate-500">{i.strategyLabel} · grounds: {i.probability.toLowerCase()}</div>
            </div>
          </li>
        ))}
      </ul>

      {reviewing && <p className="text-xs text-slate-500"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" aria-hidden /> Kai is reviewing your selection…</p>}
      {review && (
        <div className="rounded-lg border border-ink-700 bg-ink-900/40 p-4">
          <div className="mb-2 text-sm font-semibold text-slate-200">Strategy review — {ids.length} selected</div>
          <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
            <Stat icon={<Layers className="h-3.5 w-3.5" />} label={`${review.families.length} pathway${review.families.length === 1 ? "" : "s"}`} />
            <Stat icon={<Send className="h-3.5 w-3.5" />} label={`${review.recipientCount} recipient${review.recipientCount === 1 ? "" : "s"}`} />
            {review.weakItems.length > 0 && <Stat icon={<AlertTriangle className="h-3.5 w-3.5 text-gold-400" />} label={`${review.weakItems.length} thin-grounds`} />}
          </div>

          {review.conflicts.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 text-xs font-semibold text-gold-400">Worth a look before sending</div>
              <ul className="space-y-1 text-[11px] text-slate-400">{review.conflicts.map((c, n) => <li key={n} className="flex gap-1.5"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-gold-400" aria-hidden />{c}</li>)}</ul>
            </div>
          )}

          {review.families.length > 1 && (
            <div className="mb-3 text-[11px] text-slate-400">
              Your selection spans different procedures: {review.families.map((f) => `${f.label} (${f.count})`).join(", ")}. These are usually easier to run — and to review — as separate, sequenced campaigns.
            </div>
          )}

          {review.warnings.length > 0 && <Warnings warnings={review.warnings} />}

          <div className="mt-3 rounded-lg border border-brand-500/25 bg-brand-500/[0.06] p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-brand-200">
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> Kai&apos;s recommended sequence
            </div>
            <p className="text-[11px] text-slate-300">
              Send {review.recommendedSplit.includeNow.length} now as a focused campaign
              {review.recommendedSplit.defer.length > 0 ? `, hold ${review.recommendedSplit.defer.length} for the next one` : ""}.
              {review.projectedSequence.length > 0 && ` Then: ${review.projectedSequence.map((p) => p.label).join(" → ")}.`}
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <button onClick={() => create("custom")} disabled={busy || review.recommendedSplit.includeNow.length === 0}
              className="btn-primary min-h-[44px]">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />} Use Kai&apos;s focused sequence
            </button>

            {/* Expanded override — always available, never silent; requires an explicit acknowledgment. */}
            <div className="rounded-lg border border-ink-700 p-3">
              <div className="mb-1 text-xs font-semibold text-slate-300">Prefer to send everything you selected as one campaign?</div>
              <p className="mb-2 text-[11px] text-slate-500">
                That&apos;s your call. {over
                  ? `This selection is above CreditVector's ${policy.hardCeiling}-item ceiling for a single mailed campaign (an operational limit to keep the package reviewable) — reduce it to continue.`
                  : "A larger, mixed package can be harder to review and may mix issues that need different procedures — but the decision is yours."}
              </p>
              {!over && (
                <>
                  <label className="mb-2 flex items-start gap-2 text-[11px] text-slate-400">
                    <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-brand-500" />
                    I understand this sends more items together and isn&apos;t Kai&apos;s recommended sequence.
                  </label>
                  <input value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="Optional: note why (recorded with the campaign)"
                    className="input mb-2 text-xs" />
                  <button onClick={() => create("expanded")} disabled={busy || !ack} className="btn-ghost min-h-[44px] text-xs">
                    Continue with expanded campaign
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Statuses a campaign can still be canceled FROM (every non-terminal status —
// mirrors lib/campaign/CampaignModel.ts's CAMPAIGN_TERMINAL set verbatim,
// re-declared rather than imported: this is a "use client" page, and
// @/lib/campaign pulls in prisma via CampaignStore — the same client/prisma-
// import gotcha this file's own packageIdFor() comment documents (CLAUDE.md
// gotcha 2). Keep in sync if the terminal set ever changes.
const CAMPAIGN_TERMINAL_STATUSES = new Set(["COMPLETED", "CANCELED", "SUPERSEDED"]);

function ExistingCampaigns({ campaigns, onChanged }: { campaigns: CampaignSummary[]; onChanged: () => void }) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Phase 1A-R RB-6 Opus follow-up (FIX-C — planner dead-end): an APPROVED
  // (or otherwise non-terminal) campaign that's abandoned shadow-blocks its
  // own items from ever being recommended again — CAMPAIGN_PLANNED_STATUSES
  // only releases them on COMPLETED/CANCELED/SUPERSEDED, and this page had no
  // control that reaches any of those from here. The API already exposes
  // action:"cancel" (CampaignService.cancel, PATCH /api/campaigns/[id]); this
  // only surfaces the existing action — no new API logic, no redesign.
  async function cancel(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", reason: "Canceled by the user." }),
      }).catch(() => null);
      if (res?.ok) { setConfirmingId(null); onChanged(); }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8">
      <h3 className="mb-3 text-lg font-semibold">Your campaigns</h3>
      <div className="card divide-y divide-ink-700/50">
        {campaigns.map((c) => {
          const cancellable = !CAMPAIGN_TERMINAL_STATUSES.has(c.status);
          return (
            <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-200">Campaign {c.sequence} — {FAMILY_LABEL[c.strategyFamily]}</div>
                <div className="truncate text-xs text-slate-500">{c.includedCount} item{c.includedCount === 1 ? "" : "s"} · {new Date(c.createdAt).toLocaleDateString()}</div>
              </div>
              <span className={`pill ${STATUS_TONE[c.status] ?? "bg-slate-500/15 text-slate-300"}`}>{c.status.replace(/_/g, " ").toLowerCase()}</span>
              {/* Quiet secondary action, two-step confirm — matches this
                  app's existing delete-letter idiom (app/letters/page.tsx's
                  confirming/onConfirmDelete/onCancelDelete pattern), not a
                  browser-native confirm(). */}
              {cancellable && (
                confirmingId === c.id ? (
                  <span className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Cancel this campaign?</span>
                    <button
                      onClick={() => cancel(c.id)}
                      disabled={busy}
                      className="rounded-md bg-rose-600 px-2 py-1 font-medium text-white keep-white hover:bg-rose-700"
                    >
                      {busy ? "…" : "Yes, cancel"}
                    </button>
                    <button
                      onClick={() => setConfirmingId(null)}
                      disabled={busy}
                      className="rounded-md border border-ink-600 px-2 py-1 text-slate-300"
                    >
                      Never mind
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmingId(c.id)}
                    className="btn-ghost text-xs text-slate-400 hover:text-rose-400"
                  >
                    Cancel campaign
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- small presentational bits ----
function Stat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <span className="inline-flex items-center gap-1 rounded-md border border-ink-700 bg-ink-900/50 px-2 py-1 text-slate-300">{icon}{label}</span>;
}
function Warnings({ warnings }: { warnings: Warn[] }) {
  return (
    <div className="mt-3 space-y-2">
      {warnings.map((w, i) => (
        <div key={i} className={`rounded-lg border p-2.5 text-[11px] ${CAT_TONE[w.category]}`}>
          <span className="mr-1.5 inline-flex items-center gap-1 rounded bg-black/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">
            {w.category === "law" ? <Scale className="h-2.5 w-2.5" aria-hidden /> : null}{CAT_LABEL[w.category]}
          </span>
          {w.text}
        </div>
      ))}
    </div>
  );
}
function UnlockList({ lines }: { lines: string[] }) {
  return (
    <div className="mt-3 rounded-lg border border-ink-700 bg-ink-900/40 p-3">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">What unlocks next</div>
      <ul className="space-y-1 text-[11px] text-slate-400">{lines.map((l, i) => <li key={i} className="flex gap-1.5"><ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-slate-500" aria-hidden />{l}</li>)}</ul>
    </div>
  );
}
function Disclosure({ summary, icon, children }: { summary: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <details className="group rounded-lg border border-ink-700 bg-ink-900/40">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium text-slate-300">
        {icon}{summary}<ChevronDown className="ml-auto h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-1.5 px-3 pb-3">{children}</div>
    </details>
  );
}
function ReasonRow({ name, reason }: { name: string; reason: string }) {
  return <div className="text-[11px]"><span className="font-medium text-slate-300">{name}</span> <span className="text-slate-500">— {reason}</span></div>;
}
function EmptyState() {
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center">
      <Layers className="h-8 w-8 text-slate-600" aria-hidden />
      <div className="flex items-center gap-1.5">
        <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
        <p className="text-sm font-medium text-slate-200">No disputable items to plan yet.</p>
      </div>
      <p className="max-w-sm text-sm text-slate-400">Upload a credit report and I&apos;ll flag what&apos;s worth challenging, then organize it into focused campaigns.</p>
      <Link href="/upload" className="btn-primary">Upload a credit report</Link>
    </div>
  );
}
function CenterSpinner() { return <div className="card grid h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-slate-500" aria-label="Loading" /></div>; }
