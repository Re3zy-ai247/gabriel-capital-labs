import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { PrintActions } from "./PrintActions";

export const dynamic = "force-dynamic";

// A clean, print-optimized rendering of a single letter. Auto-opens the print
// dialog; "Save as PDF" from the browser print menu produces a mailable PDF.
export default async function LetterPrintPage({ params }: { params: { id: string } }) {
  const user = await currentUserOrDemo();
  if (!user) return notFound();
  const letter = await prisma.letter.findFirst({ where: { id: params.id, userId: user.id } });
  if (!letter) return notFound();

  return (
    <div className="min-h-screen bg-white text-black">
      <PrintActions />
      <div className="mx-auto max-w-[8.5in] px-[1in] py-[0.9in] print:px-[1in] print:py-[0.9in]">
        <pre className="whitespace-pre-wrap font-serif text-[12pt] leading-relaxed text-black">{letter.body}</pre>
      </div>
    </div>
  );
}
