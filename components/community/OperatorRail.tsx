import Link from "next/link";
import { Hash } from "lucide-react";
import { CATEGORIES } from "@/lib/communityShared";

// Operator Network channel rail (Phase 1.1). Renders ONLY working destinations —
// no disabled placeholders, no advertised future features (a confident tool
// ships what exists). Server-rendered links (no client state): channel selection
// is a URL (?channel=…), so switching is prefetched navigation — keyboard-
// accessible for free, zero hydration.
//
// Channels map 1:1 onto the EXISTING CommunityThread.category values. Future
// tiered spaces (agency lounge, pro strategy) return only WITH server-side
// category-level enforcement — never as UI-only entries (no UI-only security).
//
// Depth: the rail is the navigation plane — bare text on the background, no
// card containment; selection is the accent border language, never a success
// color (green = verified, exclusively — Design Bible Law C1).

function railItem(active: boolean): string {
  return `flex min-h-[44px] items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
    active
      ? "border-brand-500/40 bg-brand-500/10 font-medium text-brand-300"
      : "border-transparent text-slate-400 hover:border-ink-600 hover:text-slate-200"
  }`;
}

export function OperatorRail({ channel }: { channel: string }) {
  return (
    <nav aria-label="Channels" className="text-sm">
      <div className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wide text-slate-400">Channels</div>
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
