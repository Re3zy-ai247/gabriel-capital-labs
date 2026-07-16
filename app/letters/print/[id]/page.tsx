import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { decryptDocument, decryptText, docCryptoReady } from "@/lib/docCrypto";
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

  // Presentation-only line pass over the verbatim body: the first line of a
  // letter is the sender's name (letterhead) and the "RE:" line is its subject.
  // Weighting those two lines — text untouched — gives the page its hierarchy.
  const bodyLines = letter.body.replace(/\r\n/g, "\n").split("\n");
  const letterheadIdx = bodyLines.findIndex((l) => l.trim().length > 0);
  const reIdx = bodyLines.findIndex((l) => l.trimStart().startsWith("RE:"));

  const preparedOn = letter.createdAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Documents the user toggled "include in letters". Images are decrypted
  // server-side and embedded as data URIs so they print without a public URL.
  const includedDocs = docCryptoReady()
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
    return { type: d.type, label: DOC_LABEL[d.type] || d.type, dataUri };
  });

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-black print:bg-white">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <PrintActions />

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

          {enclosures.length > 0 && (
            <section className="mt-10 border-t border-black/20 pt-4">
              <div className="text-[9pt] font-bold uppercase tracking-[0.18em] text-black/60">Enclosures</div>
              <ul className="mt-2 space-y-1 text-[10.5pt] leading-relaxed">
                {enclosures.map((e) => (
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

          {enclosures
            .filter((e) => e.dataUri)
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
          <li>Print every page — the letter and any enclosures — then sign and date it.</li>
          <li>Mail it to the address shown at the top of the letter.</li>
          <li>First-class mail works. Certified mail with return receipt costs a little more but gives you proof of delivery and the date the response window starts — worth it for a dispute.</li>
          <li>Keep a copy of everything you send, then mark the letter mailed in CreditVector so I can track the response window with you.</li>
        </ol>
        <p className="mt-3 text-xs text-slate-500">Educational guidance on exercising your own rights — not legal advice, and no outcome is guaranteed.</p>
      </aside>
    </div>
  );
}
