import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { decryptDocument, docCryptoReady } from "@/lib/docCrypto";
import { PrintActions } from "./PrintActions";

export const dynamic = "force-dynamic";

const DOC_LABEL: Record<string, string> = {
  GOV_ID_FRONT: "Government ID (front)",
  GOV_ID_BACK: "Government ID (back)",
  SSN_CARD: "Social Security card",
  PROOF_OF_ADDRESS: "Proof of address",
  UTILITY_BILL: "Utility bill",
};

// A clean, print-optimized rendering of a single letter, followed by any
// identity documents the consumer has marked for inclusion. "Save as PDF" from
// the browser print menu produces a mailable packet (letter + enclosures).
export default async function LetterPrintPage({ params }: { params: { id: string } }) {
  const user = await currentUserOrDemo();
  if (!user) return notFound();
  const letter = await prisma.letter.findFirst({ where: { id: params.id, userId: user.id } });
  if (!letter) return notFound();

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
    <div className="min-h-screen bg-white text-black">
      <PrintActions />
      <div className="mx-auto max-w-[8.5in] px-[1in] py-[0.9in] print:px-[1in] print:py-[0.9in]">
        <pre className="whitespace-pre-wrap font-serif text-[12pt] leading-relaxed text-black">{letter.body}</pre>

        {enclosures.length > 0 && (
          <div className="mt-8 border-t border-black/30 pt-4 text-[11pt]">
            <div className="font-semibold">Enclosures:</div>
            <ul className="ml-5 list-disc">
              {enclosures.map((e) => (
                <li key={e.type}>{e.label}</li>
              ))}
            </ul>
          </div>
        )}

        {enclosures
          .filter((e) => e.dataUri)
          .map((e) => (
            <div key={e.type} className="mt-6 break-before-page">
              <div className="mb-2 text-[10pt] uppercase tracking-wide text-black/60">{e.label}</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={e.dataUri!} alt={e.label} className="max-h-[9in] max-w-full border border-black/20" />
            </div>
          ))}
      </div>
    </div>
  );
}
