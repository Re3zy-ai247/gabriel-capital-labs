import { Sidebar, MobileNav } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { AgencyBar } from "./AgencyBar";
import Link from "next/link";

export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink-700/70 bg-ink-900/70 px-5 py-3 backdrop-blur">
          <h1 className="text-sm font-medium text-slate-300">{title}</h1>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <ThemeToggle />
            <Link href="/upload" className="btn-primary !py-1.5">+ New Dispute</Link>
            <span className="hidden sm:inline">Demo User</span>
          </div>
        </header>
        <AgencyBar />
        <main className="flex-1 px-5 py-6 pb-24 md:pb-6">{children}</main>
        <MobileNav />
      </div>
    </div>
  );
}
