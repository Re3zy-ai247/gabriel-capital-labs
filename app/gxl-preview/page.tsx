import Link from "next/link";
import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { GxlField } from "@/components/gxl/GxlField";
import { GxlPull } from "@/components/gxl/GxlPull";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";
import { ensureCommunityTables, CATEGORY_KEYS } from "@/lib/community";
import { CATEGORIES, BRIEFING_ROOM, categoryLabel } from "@/lib/communityShared";
import styles from "./gxl.module.css";

// ─────────────────────────────────────────────────────────────────────────────
// GXL PREVIEW — a TEMPORARY, NON-DESTRUCTIVE styleframe of the GIOS Experience
// Language on the Operator Network's real production data.
//
//  • Additive only: no production component, route, record, or style is touched.
//  • Same data contract as the Operator Network page (read-only; take 200).
//  • FOUNDER-ONLY: gated to ADMIN — GXL is unratified and must not reach members.
//  • Functionality unchanged: entries link into the real /community/[id] pages.
//
// What it demonstrates, per GXL v1.0: the Living Ledger (Plane 1 folio — serif
// record register, hairline rules, dated entries), the Quiet Lattice field
// (real-aggregate thread density), the Provenance Pull (press-and-hold any
// entry title), light-as-luminance (the lamp on the first item needing a
// person), gold flags + attention breath on open loops, engraved instrument
// labels, room doors with live state, and honest restraint: no verified-green
// appears anywhere because nothing in this data IS verified yet (§16).
// Delete this route after the founder review — it is a styleframe, not a surface.
// ─────────────────────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata: Metadata = { robots: { index: false, follow: false }, title: "GXL Preview" };

const ATMOSPHERE: Record<string, string> = {
  "": "from-ocean-500/[0.05]",
  general: "from-slate-400/[0.04]",
  wins: "from-gold-500/[0.03]",
  strategy: "from-ocean-500/[0.07]",
  tools: "from-slate-400/[0.05]",
  questions: "from-brand-500/[0.05]",
};

interface Entry {
  id: string; title: string; category: string; authorName: string;
  pinned: boolean; locked: boolean; replyCount: number; kaiAnswered: boolean;
  lastActivityAt: string; excerpt: string;
}
const isOpen = (t: Entry) => t.replyCount === 0 && !t.locked;

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

async function loadEntries(): Promise<{ entries: Entry[]; degraded: boolean }> {
  try {
    await ensureCommunityTables();
    const rows = await prisma.communityThread.findMany({
      orderBy: [{ pinned: "desc" }, { lastActivityAt: "desc" }],
      take: 200,
    });
    const ids = rows.map((t) => t.id);
    const kai = ids.length
      ? await prisma.communityReply.findMany({ where: { threadId: { in: ids }, isKai: true }, distinct: ["threadId"], select: { threadId: true } })
      : [];
    const kaiSet = new Set(kai.map((r) => r.threadId));
    return {
      degraded: false,
      entries: rows.map((t) => ({
        id: t.id, title: t.title, category: t.category, authorName: t.authorName,
        pinned: t.pinned, locked: t.locked, replyCount: t.replyCount,
        kaiAnswered: kaiSet.has(t.id), lastActivityAt: t.lastActivityAt.toISOString(),
        excerpt: t.body.slice(0, 180),
      })),
    };
  } catch (e) {
    console.error("gxl-preview: load failed", e);
    return { entries: [], degraded: true };
  }
}

export default async function GxlPreviewPage({ searchParams }: { searchParams?: { channel?: string } }) {
  let account: Awaited<ReturnType<typeof currentAccount>> = null;
  try { account = await currentAccount(); } catch (e) { console.error("gxl-preview: account failed", e); }
  if (account?.role !== "ADMIN") {
    return (
      <AppShell title="/ GXL Preview">
        <div className="card mx-auto mt-6 max-w-md p-8 text-center text-sm text-slate-400">
          This is a founder-only styleframe of an unratified design language. Nothing to see here yet.
          <div className="mt-4"><Link href="/community" className="btn-ghost text-sm">Operator Network</Link></div>
        </div>
      </AppShell>
    );
  }

  const raw = searchParams?.channel ?? "";
  const channel = CATEGORY_KEYS.includes(raw) ? raw : "";
  const { entries, degraded } = await loadEntries();
  const scoped = channel ? entries.filter((t) => t.category === channel) : entries;

  // The attention queue in ledger order: pinned → open loops → recency → id.
  const cls = (t: Entry) => (t.pinned ? 0 : isOpen(t) ? 1 : 2);
  const queue = scoped.slice().sort((a, b) =>
    cls(a) - cls(b) || +new Date(b.lastActivityAt) - +new Date(a.lastActivityAt) || (a.id < b.id ? -1 : 1));
  const attention = queue.filter((t) => t.pinned || isOpen(t));
  const record = queue.filter((t) => !t.pinned && !isOpen(t));

  const awaiting = scoped.filter(isOpen).length;
  const now = Date.now();
  const active7d = scoped.filter((t) => now - +new Date(t.lastActivityAt) < 7 * 864e5).length;
  const kaiCount = scoped.filter((t) => t.kaiAnswered).length;
  const roomMeta = channel ? CATEGORIES.find((c) => c.key === channel) : null;
  const roomName = roomMeta ? roomMeta.label : BRIEFING_ROOM.label;
  const rooms = [{ key: "", label: BRIEFING_ROOM.label, blurb: BRIEFING_ROOM.blurb }, ...CATEGORIES]
    .map((c) => {
      const inRoom = c.key ? entries.filter((t) => t.category === c.key) : entries;
      return { ...c, total: inRoom.length, awaiting: inRoom.filter(isOpen).length };
    });

  // The lamp rests on the single first entry that needs a person (§6: one key).
  const lampId = queue.find(isOpen)?.id ?? null;

  const renderEntry = (t: Entry, i: number) => {
    const open = isOpen(t);
    const lamp = t.id === lampId;
    return (
      <li key={t.id}>
        <Link
          href={`/community/${t.id}`}
          className={[
            styles.entry,
            open ? `${styles.flagged} ${styles.breathing}` : "",
            open ? styles.lifted : "",
            lamp ? styles.lamp : "",
          ].join(" ")}
        >
          <div className="flex items-baseline gap-3">
            <span className="tnum shrink-0 font-mono text-[10px] text-slate-600">№ {String(i + 1).padStart(3, "0")}</span>
            <span className={styles.engraved}>{categoryLabel(t.category)}</span>
            <span className="tnum ml-auto shrink-0 font-mono text-[10px] text-slate-600">{fmtDate(t.lastActivityAt)}</span>
          </div>
          <p
            data-gxl-claim
            data-gxl-title={t.title}
            data-gxl-room={categoryLabel(t.category)}
            data-gxl-filed={fmtDate(t.lastActivityAt)}
            data-gxl-author={t.authorName}
            data-gxl-responses={String(t.replyCount)}
            data-gxl-state={t.locked ? "Closed" : open ? "Awaiting first response" : "In session"}
            tabIndex={0}
            className={`${styles.record} mt-1.5 cursor-pointer text-[15px] leading-snug text-slate-100`}
            title="Press and hold (or click) to pull provenance"
          >
            {t.title}
          </p>
          {t.excerpt && <p className={`${styles.record} mt-1 line-clamp-2 text-[13px] leading-relaxed text-slate-500`}>{t.excerpt}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
            {open ? (
              <span className="font-medium text-gold-400">awaiting first response</span>
            ) : (
              <span className="tnum">{t.replyCount} {t.replyCount === 1 ? "response" : "responses"}</span>
            )}
            {t.kaiAnswered && (
              <span className="rounded bg-brand-500/15 px-1 py-px text-[9px] font-bold tracking-widest text-brand-300">KAI</span>
            )}
            <span className="ml-auto truncate text-slate-600">entered by {t.authorName}</span>
          </div>
        </Link>
      </li>
    );
  };

  let idx = 0;
  return (
    <AppShell title="/ GXL Preview">
      <div className={`${styles.room} relative isolate -mx-5 -my-6 min-h-[calc(100vh-3.5rem)] px-6 py-6 md:px-8`}>
        <GxlField
          state={{ total: entries.length, awaiting: entries.filter(isOpen).length, active: active7d }}
          tint={ATMOSPHERE[channel] ?? ATMOSPHERE[""]}
        />
        <GxlPull />

        {/* Command strip — the room, engraved; its live state, set in figures. */}
        <header className="mb-6 flex flex-wrap items-baseline gap-x-5 gap-y-1 border-b border-ink-700/50 pb-3">
          <h2 className={`${styles.record} text-base font-semibold tracking-wide text-slate-100`}>{roomName}</h2>
          <span className="tnum font-mono text-[11px] text-slate-500">
            {awaiting > 0 && <><span className="text-gold-400">{awaiting}</span> awaiting · </>}
            <span className="text-slate-300">{active7d}</span> active this week
            {kaiCount > 0 && <> · <span className="text-brand-300">{kaiCount}</span> Kai answers</>}
          </span>
          <span className={`${styles.engraved} ml-auto hidden md:block`}>GXL styleframe · founder preview</span>
        </header>

        <div className="grid gap-8 lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[210px_minmax(0,1fr)_240px]">
          {/* Workspace doors */}
          <nav aria-label="Workspaces" className="hidden self-start lg:sticky lg:top-20 lg:block">
            <div className={`${styles.engraved} mb-2 px-1`}>Workspaces</div>
            <ul className="space-y-px">
              {rooms.map((r) => (
                <li key={r.key}>
                  <Link
                    href={r.key ? `/gxl-preview?channel=${r.key}` : "/gxl-preview"}
                    aria-current={channel === r.key ? "page" : undefined}
                    title={r.blurb}
                    className={`${styles.door} block border-l px-3 py-2 ${
                      channel === r.key
                        ? "border-ocean-400/70 bg-ocean-500/[0.06] text-slate-100"
                        : "border-ink-700/50 text-slate-400 hover:border-slate-500/60 hover:text-slate-200"
                    }`}
                  >
                    <span className={`${styles.record} block text-[13px]`}>{r.label}</span>
                    <span className="tnum mt-0.5 block font-mono text-[10px] text-slate-600">
                      {r.awaiting > 0 && <span className="text-gold-400">{r.awaiting} awaiting · </span>}
                      {r.total} {r.total === 1 ? "brief" : "briefs"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* The Folio — Plane 1, the Living Ledger */}
          <main className="min-w-0">
            {degraded ? (
              <p className={`${styles.record} py-10 text-center text-sm text-slate-400`}>
                The record is unreachable right now — nothing about your account caused this. The book is safe.
              </p>
            ) : queue.length === 0 ? (
              <p className={`${styles.record} py-10 text-center text-sm text-slate-400`}>
                Watch has been kept. Nothing in {roomName} requires you — the first entry will be appended in your presence.
              </p>
            ) : (
              <>
                {attention.length > 0 && (
                  <section aria-label="Requires attention" className="mb-8">
                    <div className={`${styles.engraved} mb-1 flex items-center gap-2`}>
                      <span className="text-gold-400">Requires attention</span>
                      <span className="tnum font-mono text-slate-600">{attention.length}</span>
                    </div>
                    <ol className={styles.folio}>{attention.map((t) => renderEntry(t, idx++))}</ol>
                  </section>
                )}
                {record.length > 0 && (
                  <section aria-label="The record">
                    <div className={`${styles.engraved} mb-1 flex items-center gap-2`}>
                      <span>The record</span>
                      <span className="tnum font-mono text-slate-600">{record.length}</span>
                    </div>
                    <ol className={styles.folio}>{record.map((t) => renderEntry(t, idx++))}</ol>
                  </section>
                )}
                <p className={`${styles.engraved} mt-8 text-center`}>
                  End of the record — <span className="tnum font-mono">{queue.length}</span> entries in {roomName}
                </p>
              </>
            )}
          </main>

          {/* Marginalia — situation notes + the exhibit anchor */}
          <aside id="gxl-exhibit-anchor" aria-label="Marginalia" className="hidden self-start xl:sticky xl:top-20 xl:block">
            <div className={`${styles.engraved} mb-3`}>Situation</div>
            <dl className="space-y-4 border-l border-ink-700/50 pl-4 text-[12px] leading-relaxed text-slate-400">
              <div>
                <dt className={styles.engraved}>Awaiting response</dt>
                <dd className={awaiting > 0 ? "text-gold-400" : ""}>
                  <span className="tnum font-mono text-lg">{awaiting}</span>
                  <span className="ml-1.5 text-slate-600">{awaiting === 0 ? "— the queue is clear" : "open loops"}</span>
                </dd>
              </div>
              <div>
                <dt className={styles.engraved}>Active this week</dt>
                <dd><span className="tnum font-mono text-lg text-slate-300">{active7d}</span></dd>
              </div>
              <div>
                <dt className={styles.engraved}>Kai in the record</dt>
                <dd className={styles.record}>
                  {kaiCount === 0 ? "No analyses entered yet." : <><span className="tnum font-mono text-lg text-brand-300">{kaiCount}</span><span className="ml-1.5 text-slate-600">{kaiCount === 1 ? "analysis entered" : "analyses entered"}</span></>}
                </dd>
              </div>
              <p className="pt-2 text-[11px] text-slate-600">
                Press and hold any entry title — its thread pulls taut to the exhibit. Every statement traces to its record.
              </p>
            </dl>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
