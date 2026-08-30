import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { moduleBySlug, moduleShellEnabled } from "@/lib/platform/modules";
import { currentUserOrDemo } from "@/lib/session";

export const dynamic = "force-dynamic";

// Dormant module shell (Platform Phase B, Sprint 5). INVISIBLE in production:
// 404 unless the module's flag is on AND the viewer is ADMIN. Live modules
// redirect nowhere from here — they have real routes; this shell exists so
// future modules compile, route, and register through the capability spine
// before any real functionality is approved. It ships ZERO user-facing claims.
export default async function ModuleShellPage({ params }: { params: Promise<{ slug: string }> }) {
  const mod = moduleBySlug((await params).slug);
  if (!mod || mod.status === "live") notFound();
  if (!moduleShellEnabled(mod)) notFound();
  const user = await currentUserOrDemo();
  if (!user || user.role !== "ADMIN") notFound();

  return (
    <AppShell title={`/ Modules / ${mod.name}`}>
      <div className="card mx-auto max-w-2xl p-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded bg-gold-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-gold-300">
          Internal preview — dormant module
        </div>
        <h1 className="text-xl font-semibold text-white">{mod.name}</h1>
        <p className="mt-2 text-sm text-slate-400">
          This module is registered on the platform spine (capability <code className="text-brand-300">{mod.capability}</code>,
          flag <code className="text-brand-300">{mod.flagEnv}</code>) and is hidden from production.
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Unlock gate: <span className="text-slate-300">{mod.gate}</span>
        </p>
        <Link href="/admin/platform" className="btn-ghost mt-6 inline-flex">← Platform dashboard</Link>
      </div>
    </AppShell>
  );
}
