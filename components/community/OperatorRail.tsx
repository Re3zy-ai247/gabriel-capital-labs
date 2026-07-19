import Link from "next/link";
import { Hash, Building2, Bookmark, CalendarDays, Users } from "lucide-react";
import { CATEGORIES } from "@/lib/communityShared";

// Operator Network channel rail. Server-rendered links (no client state):
// channel selection is a URL (?channel=…), so switching is navigation — fast,
// prefetched, keyboard-accessible for free, zero hydration.
//
// Channels map 1:1 onto the EXISTING CommunityThread.category values (Phase 1
// law: no new records, no new category semantics). Entries whose backing does
// not exist yet (Events, Lounges, Bookmarks) render honestly as non-navigable
// "Soon" items — nothing fabricated, nothing clickable that goes nowhere.

function railItem(active: boolean): string {
  return `flex min-h-[44px] items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
    active
      ? "border-brand-500/40 bg-brand-500/10 font-medium text-brand-300"
      : "border-transparent text-slate-400 hover:border-ink-600 hover:text-slate-200"
  }`;
}

function SoonItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <li>
      <span aria-disabled="true" className="flex min-h-[44px] cursor-default items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600">
        {icon}
        <span className="truncate">{label}</span>
        <span className="ml-auto rounded bg-ink-700/70 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-500">SOON</span>
      </span>
    </li>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 mt-5 px-3 text-[11px] font-medium uppercase tracking-wide text-slate-600 first:mt-0">{children}</div>;
}

export function OperatorRail({ channel }: { channel: string }) {
  return (
    <nav aria-label="Channels" className="text-sm">
      <GroupLabel>Channels</GroupLabel>
      <ul className="space-y-0.5">
        <li>
          <Link href="/community" aria-current={channel === "" ? "page" : undefined} className={railItem(channel === "")}>
            <Hash className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Lobby</span>
          </Link>
        </li>
        {CATEGORIES.map((c) => (
          <li key={c.key}>
            <Link
              href={`/community?channel=${c.key}`}
              aria-current={channel === c.key ? "page" : undefined}
              className={railItem(channel === c.key)}
              title={c.blurb}
            >
              <Hash className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{c.label}</span>
            </Link>
          </li>
        ))}
        <SoonItem icon={<CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />} label="Events" />
      </ul>

      <GroupLabel>Lounges</GroupLabel>
      <ul className="space-y-0.5">
        <li>
          <span className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400">
            <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Agency Lounge</span>
            <span className="ml-auto rounded bg-success-500/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-success-400">HERE</span>
          </span>
        </li>
        <SoonItem icon={<Users className="h-4 w-4 shrink-0" aria-hidden="true" />} label="Pro Strategy" />
      </ul>

      <GroupLabel>Library</GroupLabel>
      <ul className="space-y-0.5">
        <SoonItem icon={<Bookmark className="h-4 w-4 shrink-0" aria-hidden="true" />} label="Bookmarks" />
      </ul>
    </nav>
  );
}

// Compact horizontal variant for small viewports — same links, chip form.
export function ChannelChips({ channel }: { channel: string }) {
  const chip = (active: boolean) =>
    `inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
      active ? "border-brand-500 bg-brand-500/15 text-brand-300" : "border-ink-600 text-slate-400 hover:border-slate-500"
    }`;
  return (
    <nav aria-label="Channels" className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
      <Link href="/community" aria-current={channel === "" ? "page" : undefined} className={chip(channel === "")}>Lobby</Link>
      {CATEGORIES.map((c) => (
        <Link key={c.key} href={`/community?channel=${c.key}`} aria-current={channel === c.key ? "page" : undefined} className={chip(channel === c.key)}>
          {c.label}
        </Link>
      ))}
    </nav>
  );
}
