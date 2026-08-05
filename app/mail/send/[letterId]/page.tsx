"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Disclaimer } from "@/components/Disclaimer";
import { MAIL_STATUS_LABEL, type MailStatus } from "@/lib/mail/MailStatus"; // pure module — no prisma in the client bundle
import { Loader2, ShieldCheck, FileText, CheckCircle2, Lock, ArrowRight } from "lucide-react";

interface PriceLine { label: string; cents: number }
interface Prep {
  mailId: string; status: string; recipientOneLine: string;
  recipient: { name: string; line1: string; line2?: string; city: string; state: string; zip: string };
  pages: number; mailClass: string; certified: boolean;
  price: { lines: PriceLine[]; totalCents: number; providerCostCents: number; currency: string };
  contentHash: string; letterId: string; round: number; creditorName: string | null;
}
interface Manifest {
  mailId: string; status: MailStatus; provider: string; createdAt: string; recipient: { name: string };
  pages: number; color: boolean; doubleSided: boolean; mailClass: string; certified: boolean;
  auditTrail: { seq: number; at: string; actor: string; event: string; detail?: string }[];
}

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

// The immutable proof-of-intent hash comes from the manifest's own audit trail,
// not a recompute — it reflects exactly what was approved.
function hashFromAudit(m: Manifest): string | null {
  for (const e of m.auditTrail) {
    const match = /content hash:\s*([0-9a-f]{64})/i.exec(e.detail ?? "");
    if (match) return match[1];
  }
  return null;
}

export default function SendMailPage() {
  const { letterId } = useParams<{ letterId: string }>();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [prep, setPrep] = useState<Prep | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [manifestError, setManifestError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAddress, setNeedsAddress] = useState<string | null>(null);

  const loadManifest = useCallback(async (mailId: string) => {
    setManifestError(false);
    const res = await fetch(`/api/mail/${mailId}`).catch(() => null);
    const j = await res?.json().catch(() => ({}));
    if (res?.ok && j.manifest) setManifest(j.manifest);
    else setManifestError(true);
  }, []);

  const load = useCallback(async () => {
    setError(null); setNeedsAddress(null);
    try {
      const res = await fetch("/api/mail/prepare", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ letterId }),
      }).catch(() => null);
      if (!res) { setError("The connection dropped mid-request. Try again — nothing was lost."); return; }
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.error || "Couldn't prepare this for mailing."); setNeedsAddress(j.needsAddress ?? null); return; }
      setPrep(j);
      if (j.status === "QUEUED") { setStep(3); loadManifest(j.mailId); }
      else if (j.status === "APPROVED" || j.status === "PAID") setStep(2); // PAID resumes at Confirm to finish queuing
      else setStep(1);
    } finally { setLoading(false); }
  }, [letterId, loadManifest]);

  useEffect(() => { load(); }, [load]);

  async function approve() {
    if (!prep) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/mail/${prep.mailId}/approve`, { method: "POST" }).catch(() => null);
      if (!res) { setError("The connection dropped mid-request. Try again — nothing was lost."); return; }
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.error || "Couldn't record your approval."); return; }
      setStep(2);
    } finally { setBusy(false); }
  }

  async function confirm() {
    if (!prep) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/mail/${prep.mailId}/confirm`, { method: "POST" }).catch(() => null);
      if (!res) { setError("The connection dropped mid-request. Try again — nothing was lost."); return; }
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.error || "Couldn't queue this dispute."); return; }
      setManifest(j.manifest);
      setStep(3);
    } finally { setBusy(false); }
  }

  return (
    <AppShell title="/ Mail a dispute">
      <div className="mx-auto max-w-2xl">
        <Steps step={step} />
        {loading ? (
          <Spinner />
        ) : error && !prep ? (
          <div className="card p-6">
            <p className="text-sm text-slate-300" role="alert">{error}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {needsAddress === "sender"
                ? <Link href="/settings" className="btn-primary min-h-[44px]">Add your address in Settings →</Link>
                : <button onClick={() => { setLoading(true); load(); }} className="btn-primary min-h-[44px]">Try again</button>}
              <Link href={`/letters/print/${letterId}`} target="_blank" className="btn-ghost min-h-[44px]">Download &amp; mail it yourself →</Link>
              <Link href="/letters" className="btn-ghost min-h-[44px]">Back to letters</Link>
            </div>
          </div>
        ) : prep && step === 1 ? (
          <Approval prep={prep} busy={busy} error={error} onApprove={approve} letterId={letterId} />
        ) : prep && step === 2 ? (
          <Payment prep={prep} busy={busy} error={error} onConfirm={confirm} onBack={() => setStep(1)} />
        ) : prep && step === 3 && manifest ? (
          <Receipt manifest={manifest} />
        ) : prep && step === 3 && manifestError ? (
          <div className="card p-6">
            <p className="text-sm text-slate-300" role="alert">We couldn&apos;t load your Mail Manifest just now — your dispute is safe.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => loadManifest(prep.mailId)} className="btn-primary min-h-[44px]">Retry</button>
              <Link href="/mail" className="btn-ghost min-h-[44px]">Go to the Mail Center</Link>
            </div>
          </div>
        ) : (
          <Spinner />
        )}
      </div>
    </AppShell>
  );
}

function Spinner() {
  return <div className="card grid h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-slate-500" aria-label="Loading" /></div>;
}

function Steps({ step }: { step: 1 | 2 | 3 }) {
  const items = ["Review & approve", "Confirm", "Queued"];
  return (
    <ol className="mb-4 flex items-center gap-2 text-xs" aria-label="Progress">
      {items.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const state = n < step ? "done" : n === step ? "current" : "todo";
        return (
          <li key={label} aria-current={state === "current" ? "step" : undefined} className="flex items-center gap-2">
            <span aria-hidden className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${state === "done" ? "bg-success-500/20 text-success-300" : state === "current" ? "bg-brand-500/20 text-brand-300" : "bg-ink-700 text-slate-500"}`}>
              {state === "done" ? "✓" : n}
            </span>
            <span className={state === "current" ? "text-slate-200" : "text-slate-500"}>
              <span className="sr-only">{state === "done" ? "Completed: " : state === "current" ? "Current step: " : "Upcoming: "}</span>{label}
            </span>
            {i < 2 && <span aria-hidden className="text-slate-600">→</span>}
          </li>
        );
      })}
    </ol>
  );
}

function Approval({ prep, busy, error, onApprove, letterId }: { prep: Prep; busy: boolean; error: string | null; onApprove: () => void; letterId: string }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
        <h2 className="text-lg font-semibold">Review your dispute before it&apos;s mailed</h2>
      </div>
      <p className="mb-4 text-sm text-slate-400">I never send anything without your say-so. Check the details, then approve.</p>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <Field label="Recipient"><span className="font-medium text-slate-200">{prep.recipient.name}</span></Field>
        <Field label="Round">Round {prep.round}{prep.creditorName ? ` · ${prep.creditorName}` : ""}</Field>
        <Field label="Address">
          {prep.recipient.line1}{prep.recipient.line2 ? `, ${prep.recipient.line2}` : ""}<br />
          {prep.recipient.city}, {prep.recipient.state} {prep.recipient.zip}
        </Field>
        <Field label="Mail class">First-class · {prep.pages} page{prep.pages === 1 ? "" : "s"}</Field>
        <Field label="Estimated postage & printing">{money(prep.price.providerCostCents)}</Field>
        <Field label="Expected mailing">Queued now — it mails once live mailing is switched on.</Field>
      </dl>

      <Link href={`/letters/print/${letterId}`} target="_blank" className="btn-ghost mt-4 inline-flex min-h-[44px]">
        <FileText className="h-4 w-4" aria-hidden /> Open the exact letter (PDF preview) →
      </Link>

      <p className="mt-4 rounded-lg border border-ink-700 bg-ink-900/50 p-3 text-xs text-slate-400">
        <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-slate-500" aria-hidden />
        CreditVector is an educational tool, not a credit-repair organization or law firm, and this isn&apos;t legal advice.
        Mailing a dispute starts a process under the FCRA — it doesn&apos;t guarantee any item is removed or changed.
      </p>

      <p className="mt-3 min-h-[1rem] text-xs text-rose-400" role="alert" aria-live="polite">{error ?? ""}</p>
      <div className="mt-1 flex flex-wrap gap-2">
        <button onClick={onApprove} disabled={busy} className="btn-primary min-h-[44px]">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />} Approve &amp; continue
        </button>
        <Link href={`/letters/print/${letterId}`} target="_blank" className="btn-ghost min-h-[44px]">Or download &amp; mail it yourself</Link>
      </div>
      {/* Evidence-asymmetry disclosure (Phase 1A honesty triple, part b) —
          wherever Download and Send are both presented. Scoped to this one
          sentence; the wizard itself is otherwise unchanged. */}
      <p className="mt-2 text-[11px] text-slate-500">
        Evidence differs by path: self-mail leaves your own mailing record as proof. CreditVector Fulfillment
        (soon) adds a certified-mail receipt and tracking evidence once it&apos;s live.
      </p>
    </div>
  );
}

function Payment({ prep, busy, error, onConfirm, onBack }: { prep: Prep; busy: boolean; error: string | null; onConfirm: () => void; onBack: () => void }) {
  const p = prep.price;
  return (
    <div className="card p-5">
      <h2 className="mb-3 text-lg font-semibold">Confirm</h2>
      <div className="rounded-lg border border-ink-700 bg-ink-900/50 p-4">
        {p.lines.map((l, i) => (
          <div key={i} className="flex justify-between py-1 text-sm">
            <span className="text-slate-400">{l.label}</span>
            <span className={`tnum ${l.cents < 0 ? "text-success-300" : "text-slate-200"}`}>{l.cents < 0 ? "−" : ""}{money(Math.abs(l.cents))}</span>
          </div>
        ))}
        <div className="mt-1 flex justify-between border-t border-ink-700 py-1 text-sm text-slate-500">
          <span>Certified mail</span><span className="italic">Available after live mail integration</span>
        </div>
        <div className="flex justify-between py-1 text-sm text-slate-500">
          <span>Taxes</span><span className="italic">Calculated at live mailing</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-ink-700 pt-2 text-base font-semibold">
          <span>Total</span><span className="tnum text-brand-300">{money(p.totalCents)}</span>
        </div>
      </div>

      <p className="mt-3 rounded-lg border border-gold-500/30 bg-gold-500/10 p-3 text-xs text-gold-400">
        <Lock className="mr-1 inline h-3.5 w-3.5" aria-hidden />
        Live mailing isn&apos;t switched on yet, so <strong>no card is charged and no letter is sent</strong>. Confirming
        saves this dispute to your mailing queue at today&apos;s listed price — you can review, edit, or remove it any time,
        and you&apos;ll approve the final price before anything mails.
      </p>

      <p className="mt-3 min-h-[1rem] text-xs text-rose-400" role="alert" aria-live="polite">{error ?? ""}</p>
      <div className="mt-1 flex flex-wrap gap-2">
        <button onClick={onConfirm} disabled={busy} className="btn-primary min-h-[44px]">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowRight className="h-4 w-4" aria-hidden />} Confirm &amp; queue this dispute
        </button>
        <button onClick={onBack} disabled={busy} className="btn-ghost min-h-[44px]">Back</button>
      </div>
    </div>
  );
}

function Receipt({ manifest }: { manifest: Manifest }) {
  const queued = manifest.status === "QUEUED";
  const hash = hashFromAudit(manifest);
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        {queued ? <CheckCircle2 className="h-5 w-5 text-success-400" aria-hidden /> : <Lock className="h-5 w-5 text-gold-400" aria-hidden />}
        <h2 className="text-lg font-semibold">
          {queued ? "Queued — this dispute is ready to mail" : `${MAIL_STATUS_LABEL[manifest.status]} — not yet queued`}
        </h2>
      </div>
      <p className="mb-4 text-sm text-slate-400">
        {queued
          ? "Your Mail Manifest is your permanent proof of what you approved. It moves to the printer the moment live mailing is enabled — nothing about a bureau's response is promised, only that your dispute is queued and logged."
          : "Payment is recorded but this isn't queued yet. Head back to Confirm to finish queuing it."}
      </p>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <Field label="Manifest ID"><span className="tnum text-xs">{manifest.mailId}</span></Field>
        <Field label="Generated">{new Date(manifest.createdAt).toLocaleString()}</Field>
        <Field label="Recipient">{manifest.recipient.name}</Field>
        <Field label="Print spec">{manifest.pages} page{manifest.pages === 1 ? "" : "s"} · {manifest.color ? "color" : "B/W"} · {manifest.doubleSided ? "double-sided" : "single-sided"} · first-class</Field>
        {hash && <Field label="Letter hash (proof of intent)"><span className="tnum break-all text-[10px] text-slate-500">{hash}</span></Field>}
        <Field label="Mail status">{MAIL_STATUS_LABEL[manifest.status]}</Field>
        <Field label="Audit"><span className="text-success-300">{manifest.auditTrail.length} events · append-only</span></Field>
        <Field label="Provider stages">Available after live mail integration</Field>
      </dl>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/mail" className="btn-primary min-h-[44px]">See it in the Mail Center →</Link>
        <Link href="/journey" className="btn-ghost min-h-[44px]">View the case timeline</Link>
      </div>
      <Disclaimer />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-300">{children}</dd>
    </div>
  );
}
