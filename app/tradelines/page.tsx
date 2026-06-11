import { AppShell } from "@/components/AppShell";
import { Disclaimer, EduBanner } from "@/components/Disclaimer";
import { ProbabilityBadge, BureauBadges } from "@/components/ui/Badge";
import { ReanalyzeButton } from "@/components/ReanalyzeButton";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { presentBureaus, getBureauData } from "@/lib/bureauData";
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

  return (
    <AppShell title="/ Tradelines">
      <EduBanner />
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Tradeline Analysis</h2>
        <ReanalyzeButton />
      </div>

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
          <div className="col-span-2">Priority</div>
        </div>
        {tradelines.map((t) => {
          const data = getBureauData(t.bureauData);
          const present = presentBureaus(data).map((b) => BUREAU_SHORT[b]);
          return (
            <div key={t.id} className="grid grid-cols-12 items-center gap-2 border-b border-ink-700/50 px-4 py-3 text-sm last:border-0">
              <div className="col-span-4 truncate font-medium">{t.creditorName}{t.isDebtBuyer && <span className="ml-2 pill bg-rose-500/10 text-rose-300">debt buyer</span>}</div>
              <div className="col-span-2 text-xs text-slate-400">{TYPE_LABEL[t.accountType]}</div>
              <div className="col-span-2 text-slate-300">{formatCents(t.balance)}</div>
              <div className="col-span-2"><BureauBadges bureaus={present} /></div>
              <div className="col-span-2"><ProbabilityBadge p={t.probability} /></div>
            </div>
          );
        })}
        {!tradelines.length && <div className="px-4 py-10 text-center text-sm text-slate-500">No tradelines yet. Upload a report to begin.</div>}
      </div>
      <Disclaimer />
    </AppShell>
  );
}
