import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Disclaimer, EduBanner } from "@/components/Disclaimer";
import { ProbabilityBadge, BureauBadges } from "@/components/ui/Badge";
import { ReanalyzeButton } from "@/components/ReanalyzeButton";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { presentBureaus, getBureauData, crossBureauConflicts } from "@/lib/bureauData";
import { BUREAU_SHORT } from "@/lib/bureaus";
import { formatCents } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  REVOLVING: "Revolving", INSTALLMENT: "Installment", MORTGAGE: "Mortgage",
  COLLECTION: "Collection", CHARGE_OFF: "Charge-off", STUDENT_LOAN: "Student loan",
  PUBLIC_RECORD: "Public record", INQUIRY: "Inquiry", GOVERNMENT: "Government (non-disputable)", OTHER: "Other",
};

export default async function TradelinesPage() {
  const user = await currentUserOrDemo();
  const tradelines = user ? await prisma.tradeline.findMany({ where: { userId: user.id }, orderBy: { score: "desc" } }) : [];

  const high = tradelines.filter((t) => t.probability === "HIGH").length;
  const med = tradelines.filter((t) => t.probability === "MEDIUM").length;
  const weak = tradelines.filter((t) => t.probability === "LOW").length;

  // Real aggregate findings from fields already loaded — never invented.
  const conflictCount = tradelines.filter((t) => crossBureauConflicts(getBureauData(t.bureauData)).length > 0).length;
  const obsoleteCount = tradelines.filter((t) => t.reasons.some((r) => r.includes("§605"))).length;
  const debtBuyerCount = tradelines.filter((t) => t.isDebtBuyer).length;
  const findings = [
    conflictCount > 0 && `${conflictCount} carr${conflictCount === 1 ? "ies" : "y"} cross-bureau inconsistencies`,
    obsoleteCount > 0 && `${obsoleteCount} ${obsoleteCount === 1 ? "is" : "are"} past the §605 reporting window`,
    debtBuyerCount > 0 && `${debtBuyerCount} ${debtBuyerCount === 1 ? "is a debt-buyer collection" : "are debt-buyer collections"}`,
  ].filter(Boolean);

  return (
    <AppShell title="/ Tradelines">
      <EduBanner />
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Tradeline Analysis</h2>
        <ReanalyzeButton />
      </div>

      {tradelines.length > 0 && (
        <div className="card mb-4 p-4">
          <p className="text-sm text-slate-300">
            <span className="mr-2 rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
            I classified {tradelines.length === 1 ? "the tradeline" : `all ${tradelines.length} tradelines`} on your report.{" "}
            {findings.length > 0
              ? `${findings.join(", ")}. My read on each item is in its row.`
              : "No §605 or cross-bureau flags stand out yet — my read on each item is in its row."}
          </p>
        </div>
      )}

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="card p-4 text-center"><div className="text-xl font-bold text-brand-400">{high}</div><div className="text-[11px] uppercase text-slate-400">High confidence</div></div>
        <div className="card p-4 text-center"><div className="text-xl font-bold text-gold-400">{med}</div><div className="text-[11px] uppercase text-slate-400">Medium</div></div>
        <div className="card p-4 text-center"><div className="text-xl font-bold text-slate-300">{weak}</div><div className="text-[11px] uppercase text-slate-400">Weak / low priority</div></div>
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 border-b border-ink-700 px-4 py-2 text-[11px] uppercase tracking-wide text-slate-500">
          <div className="col-span-4">Creditor</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2">Balance</div>
          <div className="col-span-2">Bureaus</div>
          <div className="col-span-1">Priority</div>
          <div className="col-span-1"></div>
        </div>
        {tradelines.map((t) => {
          const data = getBureauData(t.bureauData);
          const present = presentBureaus(data).map((b) => BUREAU_SHORT[b]);
          return (
            <div key={t.id} className="grid grid-cols-12 items-center gap-2 border-b border-ink-700/50 px-4 py-3 text-sm last:border-0">
              <div className="col-span-4 min-w-0">
                <div className="truncate font-medium">{t.creditorName}{t.isDebtBuyer && <span className="ml-2 pill bg-rose-500/10 text-rose-300">debt buyer</span>}</div>
                {t.reasons[0] && <div className="truncate text-xs text-slate-500" title={t.reasons[0]}>{t.reasons[0]}</div>}
              </div>
              <div className="col-span-2 text-xs text-slate-400">{TYPE_LABEL[t.accountType]}</div>
              <div className="col-span-2 text-slate-300">{formatCents(t.balance)}</div>
              <div className="col-span-2"><BureauBadges bureaus={present} /></div>
              <div className="col-span-1"><ProbabilityBadge p={t.probability} /></div>
              <div className="col-span-1 text-right">
                {t.probability !== "NOT_RECOMMENDED" && (
                  <Link href={`/letters?tradeline=${t.id}`} className="text-xs font-semibold text-brand-400 hover:text-brand-300">
                    Dispute →
                  </Link>
                )}
              </div>
            </div>
          );
        })}
        {!tradelines.length && (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-slate-300">Nothing for me to classify yet.</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-slate-400">
              Upload a credit report and I&apos;ll break down every tradeline — type, balance, bureaus reporting it, and
              my dispute-priority read on each one.
            </p>
            <Link href="/upload" className="btn-primary mt-4 inline-flex">Upload your report</Link>
          </div>
        )}
      </div>
      <Disclaimer />
    </AppShell>
  );
}
