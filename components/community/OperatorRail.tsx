import Link from "next/link";
import { CATEGORIES, BRIEFING_ROOM } from "@/lib/communityShared";

// Operator Network workspace rail (Phase 1.2). These are ROOMS inside
// headquarters, not chat channels: no hashes, no chat language. Each entry is a
// door — the room's name plus its LIVE operational state (briefs filed, briefs
// awaiting a first response), derived from the same server query as the queue.
// Server-rendered links: entering a room is prefetched navigation (?channel=…
// over the frozen category keys), zero hydration, keyboard-accessible for free.
//
// data-workspace lets the Living Intelligence layer (a single delegated
// listener) shift the ambient field when a door is considered — behavior, not
// decoration. Selection uses the accent language; green stays reserved for
// verified (Design Bible Law C1).

export interface RoomState {
  total: number;
  awaiting: number; // open loops: zero responses, unlocked
}

function doorClasses(active: boolean): string {
  return `block rounded-lg border px-3 py-2.5 transition ${
    active
      ? "border-brand-500/40 bg-brand-500/10"
      : "border-transparent hover:border-ink-600 hover:bg-ink-800/40"
  }`;
}

function Door({ href, roomKey, name, byline, state, active }: {
  href: string; roomKey: string; name: string; byline: string; state?: RoomState; active: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        data-workspace={roomKey || "briefing"}
        title={byline}
        className={doorClasses(active)}
      >
        <span className={`block text-sm ${active ? "font-medium text-brand-300" : "text-slate-200"}`}>{name}</span>
        {state && (
          <span className="mt-0.5 block text-[11px] text-slate-500 tnum">
            {state.awaiting > 0 ? (
              <>
                <span className="font-medium text-gold-400">{state.awaiting}</span> awaiting
                <span aria-hidden="true"> · </span>
              </>
            ) : null}
            {state.total} {state.total === 1 ? "brief" : "briefs"}
          </span>
        )}
      </Link>
    </li>
  );
}

export function OperatorRail({ channel, rooms }: { channel: string; rooms: Record<string, RoomState> }) {
  return (
    <nav aria-label="Workspaces" className="text-sm">
      <div className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-wide text-slate-400">Workspaces</div>
      <ul className="space-y-1">
        <Door
          href="/community"
          roomKey=""
          name={BRIEFING_ROOM.label}
          byline={BRIEFING_ROOM.blurb}
          state={rooms[""]}
          active={channel === ""}
        />
        {CATEGORIES.map((c) => (
          <Door
            key={c.key}
            href={`/community?channel=${c.key}`}
            roomKey={c.key}
            name={c.label}
            byline={c.blurb}
            state={rooms[c.key]}
            active={channel === c.key}
          />
        ))}
      </ul>
    </nav>
  );
}

// Compact horizontal variant for small viewports — the same doors, chip form.
export function ChannelChips({ channel }: { channel: string }) {
  const chip = (active: boolean) =>
    `inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
      active ? "border-brand-500 bg-brand-500/15 text-brand-300" : "border-ink-600 text-slate-400 hover:border-slate-500"
    }`;
  return (
    <nav aria-label="Workspaces" className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
      <Link href="/community" aria-current={channel === "" ? "page" : undefined} data-workspace="briefing" className={chip(channel === "")}>
        {BRIEFING_ROOM.label}
      </Link>
      {CATEGORIES.map((c) => (
        <Link key={c.key} href={`/community?channel=${c.key}`} aria-current={channel === c.key ? "page" : undefined} data-workspace={c.key} className={chip(channel === c.key)}>
          {c.label}
        </Link>
      ))}
    </nav>
  );
}
