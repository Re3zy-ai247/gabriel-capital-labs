import { Sidebar, MobileNav } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { AgencyBar } from "./AgencyBar";
import { ImpersonationBanner } from "./admin/ImpersonationBanner";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { HeaderLogout } from "./HeaderLogout";
import { NewDisputeCta } from "./NewDisputeCta";
import { KaiPresence } from "./kai/KaiPresence";
import { CinematicToggle } from "./cxos/CinematicToggle";

export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink-700/70 bg-ink-900/70 px-5 py-3 backdrop-blur">
          <h1 className="text-sm font-medium text-slate-300">{title}</h1>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            {/* RC1 S7 (Founder Decision D-6, finding C-01): the cinematic
                control is reachable INSIDE the product too, not only on the
                marketing footer — a signed-in consumer who wants the entrance
                (or wants no cinematic motion at all) should not have to sign
                out to find the switch. Hidden on the narrowest viewports where
                the header is already at capacity; the footer mount is the
                always-available one. Review L-7: it used to be `hidden
                sm:inline`, which put it out of reach on exactly the viewport
                most consumers use; it is visible at every width now, with a
                shorter label so the header still fits. */}
            <CinematicToggle label="Cinematic" className="whitespace-nowrap" />
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
