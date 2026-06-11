import { ShieldCheck } from "lucide-react";
import { DISCLAIMER } from "@/lib/compliance";

export function Disclaimer() {
  return (
    <div className="card mt-8 flex gap-3 p-4 text-xs leading-relaxed text-slate-400">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
      <p>{DISCLAIMER}</p>
    </div>
  );
}

export function EduBanner() {
  return (
    <div className="mb-6 rounded-lg border border-gold-500/30 bg-gold-500/10 px-4 py-2 text-xs text-gold-400">
      Educational Tool — All dispute guidance is for informational purposes. No outcomes are guaranteed.
    </div>
  );
}
