import { Sidebar, MobileNav } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { AgencyBar } from "./AgencyBar";
import { ImpersonationBanner } from "./admin/ImpersonationBanner";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { HeaderLogout } from "./HeaderLogout";
import { NewDisputeCta } from "./NewDisputeCta";
import { KaiPresence } from "./kai/KaiPresence";

export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink-700/70 bg-ink-900/70 px-5 py-3 backdrop-blur">
          <h1 className="text-sm font-medium text-slate-300">{title}</h1>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <ThemeToggle />
            {/* RC1 S2 (review MEDIUM-2): session-conditional — this shell renders on
                signed-out panels too, where "+ New Dispute" promised an action the
                visitor cannot take. S7 reworks this header next wave. */}
            <NewDisputeCta />
            <HeaderLogout />
          </div>
        </header>
        <ImpersonationBanner />
        <AnnouncementBanner />
        <AgencyBar />
        <main id="main" className="flex-1 px-5 py-6 pb-24 md:pb-6">{children}</main>
        <KaiPresence />
        <MobileNav />
      </div>
    </div>
  );
}
