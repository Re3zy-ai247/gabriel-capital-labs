import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { decryptDocument, decryptText, docCryptoReady } from "@/lib/docCrypto";
import { MAIL_TRANSIT_DAYS } from "@/lib/forecast";
import { resolveSenderPlaceholders, detectPlaceholders } from "@/lib/letter";
import { PrintActions } from "./PrintActions";

export const dynamic = "force-dynamic";

const DOC_LABEL: Record<string, string> = {
  GOV_ID_FRONT: "Government ID (front)",
  GOV_ID_BACK: "Government ID (back)",
  SSN_CARD: "Social Security card",
  PROOF_OF_ADDRESS: "Proof of address",
  UTILITY_BILL: "Utility bill",
};

// True page geometry lives here, not in utility classes: US Letter with 1in
// margins on every sheet (letter + enclosure pages), images never split across
// a page break, and nothing but the document itself reaches the paper.
const PRINT_CSS = `
@page { size: letter; margin: 1in; }
@media print {
  html, body { background: white; }
  .skip-link { display: none !important; }
}
`;

// A clean, print-optimized rendering of a single letter, followed by any
// identity documents the consumer has marked for inclusion. "Save as PDF" from
// the browser print menu produces a mailable packet (letter + enclosures).
// The letter must read like it came from a careful professional — on screen it
// previews as a sheet of paper; in print the browser page IS the paper.
export default async function LetterPrintPage({ params }: { params: { id: string } }) {
  const user = await currentUserOrDemo();
  if (!user) return notFound();
  const letter = await prisma.letter.findFirst({ where: { id: params.id, userId: user.id } });
  if (!letter) return notFound();
  // body is encrypted at rest — decrypt for the printable packet.
  letter.body = decryptText(letter.body);

  // Phase 1A-R RB-4 — RENDER-TIME SENDER RESOLUTION. The stored body above is
  // frozen at generation time and stays that way (the dispute CONTENT must
  // never silently change after the fact). But the sender block is not
  // dispute content — it's the consumer's own CURRENT legal name/address, the
  // same fields Settings already treats as live. This substitutes the
  // signed-in user's CURRENT profile into the RENDERED copy only: plain
  // string replacement, no AI, no regeneration, no letter credit, no DB
  // write. `letter.body` (and therefore GET /api/letters' preview) is
  // untouched — only `renderedBody`, used below, reflects it.
  //
  // Opus follow-up — RECORDS INTEGRITY: this applies ONLY to a NOT-YET-MAILED
  // letter, where the print view is still a draft the operator is about to
  // act on. A MAILED letter's print view is the RECORD of what was actually
  // sent — it renders VERBATIM (never rewritten with today's profile, which
  // would show text that was never mailed) and never carries the "before you
  // mail this" warning below (nothing about an already-mailed letter is
  // still pending mailing).
  const consumerNow = {
    fullName: user.fullName,
    addressLine1: user.addressLine1,
    city: user.city,
    state: user.state,
    zip: user.zip,
  };
  const renderedBody = letter.mailedAt ? letter.body : resolveSenderPlaceholders(letter.body, consumerNow);
  const placeholders = detectPlaceholders(renderedBody);

  // Presentation-only line pass over the verbatim body: the first line of a
  // letter is the sender's name (letterhead) and the "RE:" line is its subject.
  // Weighting those two lines — text untouched — gives the page its hierarchy.
  const bodyLines = renderedBody.replace(/\r\n/g, "\n").split("\n");
  const letterheadIdx = bodyLines.findIndex((l) => l.trim().length > 0);
  const reIdx = bodyLines.findIndex((l) => l.trimStart().startsWith("RE:"));

  const preparedOn = letter.createdAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Documents the user toggled "include in letters". Images are decrypted
  // server-side and embedded as data URIs so they print without a public URL.
  const cryptoReady = docCryptoReady();
  const includedDocs = cryptoReady
    ? await prisma.document.findMany({
        where: { userId: user.id, includeInLetters: true },
        orderBy: { type: "asc" },
      })
    : [];

  const enclosures = includedDocs.map((d) => {
    let dataUri: string | null = null;
    if (["image/jpeg", "image/png", "image/webp"].includes(d.mimeType)) {
      try {
        const buf = decryptDocument({
          ciphertext: Buffer.from(d.ciphertext),
          iv: Buffer.from(d.iv),
          authTag: Buffer.from(d.authTag),
        });
        dataUri = `data:${d.mimeType};base64,${buf.toString("base64")}`;
      } catch {
        dataUri = null;
      }
    }
    return { type: d.type, label: DOC_LABEL[d.type] || d.type, dataUri, mimeType: d.mimeType };
  });

  // RC1-S5 (A3 L-06 / P1-07) — THE ENCLOSURE LIST IS A STATEMENT ON A SIGNED
  // LETTER, SO IT HAS TO BE TRUE.
  //
  // The letter used to list EVERY document marked "include in letters" under
  // "Enclosures", while only images were ever rendered onto paper (:96). Uploads
  // accept application/pdf, so a PDF government ID was named as enclosed on a
  // letter the consumer signed — and was not in the envelope. Separately, when
  // document encryption is not configured the query is skipped entirely and the
  // packet shipped with no enclosures and no warning at all.
  //
  // Now: the printed list contains exactly the pages this packet prints, and
  // everything else is called out on screen — to the consumer, who is the only
  // person who can put it in the envelope — never printed as though it were
  // enclosed.
  const printedEnclosures = enclosures.filter((e) => e.dataUri);
  const unprintableEnclosures = enclosures.filter((e) => !e.dataUri);

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-black print:bg-white">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <PrintActions />

      {/* Phase 1A-R RB-4 — PLACEHOLDER GATE. Explicit, unmissable, screen-only
          (never printed: if a token is still unresolved it's already visible,
          honestly, on the printed page itself — this is the heads-up BEFORE
          committing to mail it). Not a hard block — the founder ruled out a
          flow redesign — but it names exactly what's missing and links to fix
          it, matching the existing /letters builder-page warning idiom. */}
      {!letter.mailedAt && placeholders.hasPlaceholder && (
        <div className="mx-auto max-w-[8.5in] px-6 pt-4 print:hidden">
          <div className="flex gap-2 rounded-lg border border-gold-500/30 bg-gold-500/10 p-3 text-xs text-gold-400">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">Before you mail this</p>
              {placeholders.senderIncomplete && (
                <p className="mt-1">
                  Your sender details are incomplete — this letter still reads [YOUR FULL NAME] / [YOUR ADDRESS] /
                  [CITY, STATE ZIP] instead of your real name and mailing address.{" "}
                  <Link href="/settings" className="font-semibold underline">Complete your profile in Settings →</Link>
                </p>
              )}
              {placeholders.recipientIncomplete && (
                <p className="mt-1">
                  The recipient&apos;s mailing address is missing — this letter still reads [Furnisher mailing
                  address] and can&apos;t be mailed as printed.{" "}
                  <Link
                    href={`/letters?tradeline=${encodeURIComponent(letter.tradelineId ?? "")}&strategy=${encodeURIComponent(letter.strategy)}`}
                    className="font-semibold underline"
                  >
                    Add it →
                  </Link>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RC1-S5 (A3 L-06) — WHAT IS NOT IN THIS PACKET. Screen-only: it is an
          instruction to the consumer, not a statement to the bureau, and the
          letter itself must never claim an enclosure the packet does not carry. */}
      {(unprintableEnclosures.length > 0 || !cryptoReady) && (
        <div className="mx-auto max-w-[8.5in] px-6 pt-4 print:hidden">
          <div className="flex gap-2 rounded-lg border border-gold-500/30 bg-gold-500/10 p-3 text-xs text-gold-400">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">Bring these documents yourself</p>
              {unprintableEnclosures.length > 0 && (
                <p className="mt-1">
                  You marked {unprintableEnclosures.length === 1 ? "this document" : "these documents"} to include with
                  your letters, but {unprintableEnclosures.length === 1 ? "it can" : "they can"}&apos;t be printed into
                  this packet: {unprintableEnclosures.map((e) => `${e.label} (${e.mimeType})`).join(", ")}. Print{" "}
                  {unprintableEnclosures.length === 1 ? "it" : "them"} separately and add{" "}
                  {unprintableEnclosures.length === 1 ? "it" : "them"} to the envelope yourself. The letter does not
                  name {unprintableEnclosures.length === 1 ? "it" : "them"} as enclosed — this packet doesn&apos;t
                  contain {unprintableEnclosures.length === 1 ? "it" : "them"}, so the letter can&apos;t say it does.
                </p>
              )}
              {!cryptoReady && (
                <p className="mt-1">
                  Uploaded documents can&apos;t be attached to a printed packet right now, so nothing you marked
                  &ldquo;include with my letters&rdquo; is in this one. Add copies to the envelope yourself if your
                  dispute needs them.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Screen-only context strip — what this document is, before it prints. */}
      <div className="mx-auto flex max-w-[8.5in] flex-wrap items-baseline gap-x-5 gap-y-1 px-6 pt-6 text-[11px] uppercase tracking-widest text-slate-500 print:hidden">
        <span className="font-bold text-slate-700">Dispute letter</span>
        <span>To&thinsp;·&thinsp;{letter.recipientName}</span>
        <span>Round {letter.round}</span>
        <span>Prepared {preparedOn}</span>
      </div>

      {/* The sheet. */}
      <main className="mx-auto mb-12 mt-4 max-w-[8.5in] bg-white shadow-sm ring-1 ring-slate-200 print:my-0 print:max-w-none print:shadow-none print:ring-0">
        <div className="px-[1in] py-[1in] print:p-0">
          <div className="whitespace-pre-wrap text-[11.5pt] leading-[1.75] text-black">
            {bodyLines.map((line, i) => (
              <span key={i} className={i === letterheadIdx || i === reIdx ? "font-semibold" : undefined}>
                {line}
                {"\n"}
              </span>
            ))}
          </div>

          {/* Exactly the pages printed below — nothing the packet does not contain. */}
          {printedEnclosures.length > 0 && (
            <section className="mt-10 border-t border-black/20 pt-4">
              <div className="text-[9pt] font-bold uppercase tracking-[0.18em] text-black/60">Enclosures</div>
              <ul className="mt-2 space-y-1 text-[10.5pt] leading-relaxed">
                {printedEnclosures.map((e) => (
                  <li key={e.type} className="flex gap-2">
                    <span aria-hidden="true">—</span>
                    {e.label}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Screen-only: the MAILED artifact stays unbranded — a third-party-
              prepared footer on the paper letter could deprioritize the dispute
              and is a compliance-gated change we have not made. */}
          <footer className="mt-12 border-t border-black/15 pt-3 text-center text-[8pt] tracking-[0.08em] text-black/50 print:hidden">
            Prepared with CreditVector — educational tool; statutes cited within.
          </footer>

          {printedEnclosures
            .map((e) => (
              <figure key={e.type} className="break-before-page pt-2">
                <figcaption className="mb-3 text-[9pt] font-bold uppercase tracking-[0.18em] text-black/60">
                  Enclosure — {e.label}
                </figcaption>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={e.dataUri!}
                  alt={e.label}
                  className="max-h-[8in] max-w-full break-inside-avoid border border-black/20"
                />
              </figure>
            ))}
        </div>
      </main>

      {/* Screen-only mailing guide — closes the print→mail handoff for first-time
          self-mailers. Never printed (print:hidden); process-only, no outcome claims. */}
      <aside className="mx-auto mb-16 max-w-[8.5in] rounded-xl border border-slate-300 bg-white px-6 py-5 text-sm text-slate-700 shadow-sm print:hidden">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
          <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-slate-700">KAI</span> How to mail this
        </div>
        <ol className="list-decimal space-y-1.5 pl-5 leading-relaxed">
          <li>
            Print every page — the letter and any enclosures — then sign and date it on the signature line at the end
            of the letter.
          </li>
          <li>Mail it to the address shown at the top of the letter.</li>
          <li>First-class mail works. Certified mail with return receipt costs a little more but gives you proof of delivery and the date the response window starts — worth it for a dispute.</li>
          <li>
            Keep a copy of everything you send, then mark the letter mailed in CreditVector. I&apos;ll estimate your
            response window from that date plus about {MAIL_TRANSIT_DAYS} days&apos; mailing time — the clock actually
            starts once the bureau receives it, which only certified mail&apos;s return receipt (above) can confirm exactly.
          </li>
        </ol>
        <p className="mt-3 text-xs text-slate-500">Educational guidance on exercising your own rights — not legal advice, and no outcome is guaranteed.</p>
      </aside>
    </div>
  );
}
