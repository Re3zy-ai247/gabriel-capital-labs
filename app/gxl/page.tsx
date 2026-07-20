import Link from "next/link";
import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { GxlField } from "@/components/gxl/GxlField";
import { ROOMS } from "@/components/gxl/specimen";
import { gxlGalleryAllowed } from "./allowed";
import styles from "./gallery.module.css";

// ─────────────────────────────────────────────────────────────────────────────
// GXL EXPERIENCE GALLERY — the validation playground for the GIOS Experience
// Language. SPECIMEN DATA ONLY: no production data, no prisma reads for
// content, no user records. Charter: every future product's experience is
// proven inside this gallery before entering production.
// Access: open in dev + previews (deployment SSO protects previews); ADMIN-only
// in production (the language is unratified). Unlinked + noindex.
// ─────────────────────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata: Metadata = { robots: { index: false, follow: false }, title: "GXL Gallery" };

export default async function GxlGalleryLobby() {
  if (!(await gxlGalleryAllowed())) {
    return (
      <AppShell title="/ GXL Gallery">
        <div className="card mx-auto mt-6 max-w-md p-8 text-center text-sm text-slate-400">
          This is a founder-only validation gallery for an unratified design language.
          <div className="mt-4"><Link href="/community" className="btn-ghost text-sm">Operator Network</Link></div>
        </div>
      </AppShell>
    );
  }

  const totals = ROOMS.reduce((a, r) => ({ total: a.total + r.field.total, awaiting: a.awaiting + r.field.awaiting, active: a.active + r.field.active }), { total: 0, awaiting: 0, active: 0 });

  return (
    <AppShell title="/ GXL Gallery">
      <div className={`${styles.room} relative isolate -mx-5 -my-6 min-h-[calc(100vh-3.5rem)] px-6 py-8 md:px-10`}>
        <GxlField state={totals} tint="from-ocean-500/[0.05]" />

        <header className="mb-8 max-w-2xl">
          <p className={styles.engraved}>GIOS Experience Language · Validation Gallery</p>
          <h2 className={`${styles.record} mt-2 text-2xl text-slate-100`}>The building, room by room</h2>
          <p className={`${styles.record} mt-3 text-[14px] leading-relaxed text-slate-400`}>
            Six rooms, each demonstrating the language in full — lighting, motion, typography, ambient
            intelligence, the Living Ledger, the Quiet Lattice, the Provenance Pull, and the Sweep — on
            clearly-labeled specimen data. Nothing here is real; everything here is the law.
          </p>
          <p className={`${styles.engraved} mt-4 text-gold-400`}>
            Charter: every future product is proven in this gallery before entering production.
          </p>
        </header>

        <nav aria-label="Rooms">
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ROOMS.map((r) => (
              <li key={r.slug}>
                <Link href={`/gxl/${r.slug}`} className={`${styles.vitrine} ${styles.door} block h-full`}>
                  <span className={`${styles.record} block text-[16px] text-slate-100`}>{r.name}</span>
                  <span className={`${styles.record} mt-1 block text-[12.5px] italic leading-relaxed text-slate-500`}>{r.question}</span>
                  <span className={`${styles.engraved} mt-3 block`}>{r.rhythm}</span>
                  <span className="tnum mt-3 block font-mono text-[10px] text-slate-600">
                    {r.field.awaiting > 0 && <span className="text-gold-400">{r.field.awaiting} awaiting · </span>}
                    {r.field.total} entries · specimen
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p className={`${styles.engraved} mt-10`}>
          Specimen record — for language validation. Not real data. Process language only; no outcomes implied.
        </p>
      </div>
    </AppShell>
  );
}
