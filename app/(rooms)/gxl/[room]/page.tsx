import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { GxlField } from "@/components/gxl/GxlField";
import { GxlPull } from "@/components/gxl/GxlPull";
import { GxlBench } from "@/components/gxl/GxlBench";
import { GxlCouncil } from "@/components/gxl/GxlCouncil";
import { ROOMS, roomBySlug, ENTRIES, EXHIBITS, COUNCIL, KAI_ANALYSIS, type SpecimenEntry } from "@/components/gxl/specimen";
import { gxlGalleryAllowed } from "../allowed";
import styles from "../gallery.module.css";

// GXL Gallery — one room, fully interactive, specimen data only. Every room
// carries the full language (field, folio, pull, flags, engraved registers);
// its HERO organ demonstrates the room's operational identity.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata: Metadata = { robots: { index: false, follow: false }, title: "GXL Gallery" };

const STATE_LABEL: Record<SpecimenEntry["state"], string> = {
  awaiting: "Awaiting first response",
  in_session: "In session",
  closed: "Closed",
  verified: "Verified",
  contested: "Contested",
};

function Entry({ t, lamp }: { t: SpecimenEntry; lamp?: boolean }) {
  const open = t.state === "awaiting";
  return (
    <li>
      <div
        className={[styles.entry, open ? `${styles.flagged} ${styles.breathing} ${styles.lifted}` : "", lamp ? styles.lamp : ""].join(" ")}
      >
        <div className="flex items-baseline gap-3">
          <span className="tnum shrink-0 font-mono text-[10px] text-slate-600">№ {t.no}</span>
          <span className={styles.engraved}>Specimen</span>
          <span className="tnum ml-auto shrink-0 font-mono text-[10px] text-slate-600">{t.filed}</span>
        </div>
        <p
          data-gxl-claim
          data-gxl-title={t.title}
          data-gxl-room="Specimen folio"
          data-gxl-filed={t.filed}
          data-gxl-author={t.author}
          data-gxl-responses={String(t.responses)}
          data-gxl-state={STATE_LABEL[t.state]}
          tabIndex={0}
          className={`${styles.record} mt-1.5 cursor-pointer text-[15px] leading-snug text-slate-100`}
          title="Press and hold (or click) to pull provenance"
        >
          {t.title}
        </p>
        <p className={`${styles.record} mt-1 text-[13px] leading-relaxed text-slate-500`}>{t.excerpt}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
          {open ? (
            <span className="font-medium text-gold-400">awaiting first response</span>
          ) : t.state === "verified" ? (
            <span className="inline-flex items-center gap-1.5 text-slate-300"><span className={styles.verifiedLamp} /> verified</span>
          ) : t.state === "contested" ? (
            <span className="font-medium text-rose-400">contested — both threads preserved</span>
          ) : (
            <span className="tnum">{t.responses} {t.responses === 1 ? "response" : "responses"}</span>
          )}
          {t.kai && <span className="rounded bg-brand-500/15 px-1 py-px text-[9px] font-bold tracking-widest text-brand-300">KAI</span>}
          {t.agedNote && <span className="italic text-slate-600">{t.agedNote}</span>}
          <span className="ml-auto truncate text-slate-600">entered by {t.author}</span>
        </div>
      </div>
    </li>
  );
}

export default async function GxlRoom({ params }: { params: { room: string } }) {
  const room = roomBySlug(params.room);
  if (!room) notFound();
  if (!(await gxlGalleryAllowed())) {
    return (
      <div className="card mx-auto mt-6 max-w-md p-8 text-center text-sm text-slate-400">
        This is a founder-only validation gallery for an unratified design language.
      </div>
    );
  }

  const lampId = ENTRIES.find((t) => t.state === "awaiting")?.id ?? null;

  return (
    <>
      <div className={`${styles.room} relative isolate -mx-5 -my-6 min-h-[calc(100vh-3.5rem)] px-6 py-6 md:px-8`}>
        <GxlField state={room.field} tint={room.atmosphere} />
        <GxlPull />

        {/* Command strip */}
        <header className="mb-6 border-b border-ink-700/50 pb-3">
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <Link href="/gxl" className={`${styles.engraved} hover:text-slate-300`}>← Gallery</Link>
            <h2 className={`${styles.record} text-base font-semibold tracking-wide text-slate-100`}>{room.name}</h2>
            <span className={`${styles.record} text-[12.5px] italic text-slate-500`}>{room.question}</span>
            <span className={`${styles.engraved} ml-auto hidden md:block`}>{room.rhythm}</span>
          </div>
          <p className={`${styles.engraved} mt-2 text-slate-600`}>Specimen data · language validation · process language only</p>
        </header>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_240px]">
          <main className="min-w-0 space-y-10">
            {/* ── HERO ORGAN per room ── */}
            {room.hero === "tape" && (
              <>
                <section aria-label="Rooms of the building">
                  <div className={`${styles.engraved} mb-2`}>The building — live doors</div>
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {ROOMS.filter((r) => r.slug !== room.slug).map((r) => (
                      <li key={r.slug}>
                        <Link href={`/gxl/${r.slug}`} className={`${styles.vitrine} ${styles.door} block`}>
                          <span className={`${styles.record} block text-[14px] text-slate-100`}>{r.name}</span>
                          <span className="tnum mt-1 block font-mono text-[10px] text-slate-600">
                            {r.field.awaiting > 0 && <span className="text-gold-400">{r.field.awaiting} awaiting · </span>}
                            {r.field.active} active
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
                <section aria-label="The tape">
                  <div className={`${styles.engraved} mb-2`}>The tape — the institution's memory (specimen)</div>
                  <ol className={`${styles.tape} space-y-3 py-1 pl-0`}>
                    {["Jul 18 — Entry № 041 appended: bureau response received", "Jul 16 — Custody check completed (verified)", "Jul 15 — Exhibit B entered into the record", "Jul 12 — Statutory window entered from delivery receipt", "Jun 28 — Exhibit D entered; contradiction with Exhibit C preserved", "Mar 22 — Exhibit E entered (now aged; refresh due)"].map((t, i) => (
                      <li key={i} className={`${styles.tick} tnum font-mono text-[11px] text-slate-400`}>{t}</li>
                    ))}
                  </ol>
                </section>
              </>
            )}

            {room.hero === "briefing" && (
              <GxlBench
                styles={styles}
                title="The morning brief — prepared in your presence"
                buttonLabel="Prepare the brief"
                steps={[
                  { text: "Overnight: one bureau response entered the record; no method of verification disclosed.", cite: "Exhibit B" },
                  { text: "One entry awaits its first response — flagged gold in the folio below." },
                  { text: "Nothing else requires you. Watch was kept.", cite: "the record" },
                ]}
              />
            )}

            {room.hero === "exhibits" && (
              <section aria-label="Exhibits">
                <div className={`${styles.engraved} mb-2`}>The vitrines — press and hold any exhibit to pull its thread</div>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {EXHIBITS.map((e) => (
                    <li key={e.id}>
                      <div className={[styles.vitrine, e.state === "contested" ? styles.vitrineContested : "", e.state === "aged" ? styles.vitrineAged : ""].join(" ")}>
                        <p
                          data-gxl-claim
                          data-gxl-title={e.label}
                          data-gxl-room="Evidence Center"
                          data-gxl-filed={e.dated}
                          data-gxl-author={e.kind}
                          data-gxl-responses={e.pairsWith ? "paired" : "—"}
                          data-gxl-state={e.state}
                          tabIndex={0}
                          className={`${styles.record} cursor-pointer text-[13.5px] leading-snug text-slate-100`}
                        >
                          {e.label}
                        </p>
                        <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-500">{e.note}</p>
                        <div className="mt-2 flex items-center gap-2 text-[10px]">
                          <span className={styles.engraved}>{e.kind}</span>
                          <span className="tnum ml-auto font-mono text-slate-600">{e.dated}</span>
                          {e.state === "verified" && <span className={styles.verifiedLamp} title="Verified" />}
                          {e.state === "contested" && <span className="font-semibold uppercase tracking-wide text-rose-400">contested</span>}
                          {e.state === "aged" && <span className="italic text-slate-500">aged</span>}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className={`${styles.record} mt-3 text-[12px] italic leading-relaxed text-slate-500`}>
                  Exhibits C and D disagree by fifteen months. The room preserves the contradiction with both
                  threads intact — the interface never launders conflict into false confidence.
                </p>
              </section>
            )}

            {room.hero === "kai" && (
              <GxlBench
                styles={styles}
                title="Request the analysis — Kai works only while the hand moves"
                buttonLabel="Request analysis"
                steps={KAI_ANALYSIS.lines.map((text, i) => ({ text, cite: KAI_ANALYSIS.citations[i] }))}
                disclosures={{ read: KAI_ANALYSIS.read, lacked: KAI_ANALYSIS.lacked, confidence: KAI_ANALYSIS.confidence }}
              />
            )}

            {room.hero === "council" && <GxlCouncil styles={styles} options={COUNCIL} />}

            {room.hero === "lab" && (
              <section aria-label="The benches" className="space-y-4">
                <div className={`${styles.engraved}`}>Three benches — each hand runs only while its own work runs</div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <GxlBench styles={styles} title="Custody check — certified-mail receipt" buttonLabel="Run the check"
                    steps={[{ text: "Receipt imaged and compared against the mailing log." }, { text: "Chain of custody confirmed; entered into the record.", verify: true }]} />
                  <GxlBench styles={styles} title="Window calculation — reinvestigation clock" buttonLabel="Compute the window"
                    steps={[{ text: "Delivery receipt dated Jul 10; the 30-day window is entered from delivery, not mailing." }, { text: "Window closes Aug 09 — the clock is real, so it is shown.", cite: "§611(a)(1)" }]} />
                </div>
              </section>
            )}

            {/* ── The folio — every room keeps the record ── */}
            <section aria-label="The folio">
              <div className={`${styles.engraved} mb-1`}>The folio — specimen record</div>
              <ol className={styles.folio}>
                {ENTRIES.map((t) => (
                  <Entry key={t.id} t={t} lamp={t.id === lampId} />
                ))}
              </ol>
              <p className={`${styles.engraved} mt-6 text-center`}>End of the record — 6 specimen entries</p>
            </section>
          </main>

          {/* Marginalia + exhibit anchor */}
          <aside id="gxl-exhibit-anchor" aria-label="Marginalia" className="hidden self-start xl:sticky xl:top-20 xl:block">
            <div className={`${styles.engraved} mb-3`}>This room</div>
            <dl className="space-y-4 border-l border-ink-700/50 pl-4 text-[12px] leading-relaxed text-slate-400">
              <div><dt className={styles.engraved}>Demonstrates</dt><dd className={styles.record}>Lighting · motion · type · field · ledger · lattice · pull · sweep · atmosphere</dd></div>
              <div><dt className={styles.engraved}>Awaiting</dt><dd><span className="tnum font-mono text-lg text-gold-400">{room.field.awaiting}</span></dd></div>
              <div><dt className={styles.engraved}>Active</dt><dd><span className="tnum font-mono text-lg text-slate-300">{room.field.active}</span></dd></div>
              <p className="pt-2 text-[11px] text-slate-600">Press and hold any entry or exhibit title — its thread pulls taut to this margin.</p>
            </dl>
          </aside>
        </div>
      </div>
    </>
  );
}
