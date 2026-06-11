import { cn } from "@/lib/utils";

export function StatCard({ label, value, hint, accent }: { label: string; value: React.ReactNode; hint?: string; accent?: "brand" | "gold" | "rose" | "slate" }) {
  const color = { brand: "text-brand-400", gold: "text-gold-400", rose: "text-rose-300", slate: "text-slate-200" }[accent || "slate"];
  return (
    <div className="stat">
      <div className={cn("text-2xl font-bold", color)}>{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">{label}</div>
      {hint && <div className="mt-1 text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
}
