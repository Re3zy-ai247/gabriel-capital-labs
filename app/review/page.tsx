import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { CXOS_ROOMS } from "@/lib/cxos/rooms";
import { reviewBuildAllowed } from "@/lib/cxos/reviewMode";

// Isolated RC1 review index. Only routes present in this candidate are listed.
export default function ReviewHub() {
  if (!reviewBuildAllowed()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink-950 p-8 text-slate-400">
        <p className="text-sm">Founder Review is not enabled in this build.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ink-950 px-6 py-14 text-white">
      <div className="mx-auto max-w-4xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-brand-300">
          {BRAND.product} · Isolated Founder Review
        </p>
        <h1 className="h-display mt-2 text-3xl md:text-4xl">
          CXOS Core Runtime RC1
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          This protected candidate contains only Agency Headquarters, its
          headless Core Runtime reference integration, and the reviewed Mission
          Control return destination. It does not represent production
          integration approval.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {CXOS_ROOMS.map((room) => (
            <article key={room.key} className="card p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-100">
                  {room.name}
                </h2>
                <span className="rounded-full border border-brand-500/50 px-2 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">
                  {room.status}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                {room.line}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-500">
                <span>{room.phase}</span>
                <Link
                  href={room.href}
                  className="font-semibold text-brand-300 hover:text-brand-200"
                >
                  Enter →
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
