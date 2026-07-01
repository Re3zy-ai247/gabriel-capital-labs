import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logAudit } from "@/lib/admin";
import { encryptText, isEncryptedText } from "@/lib/docCrypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// One-time (idempotent) backfill: encrypts any Letter.body / Letter.responseText /
// Letter.responseAnalysis still stored as plaintext at rest. Already-encrypted
// ("cv1:") values and empty ones are skipped, so it is safe to run repeatedly.
// ADMIN-only — it reads every consumer's dispute-letter + bureau-response PII.
// Mirrors /api/admin/encrypt-reports.
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const letters = await prisma.letter.findMany({
    select: { id: true, body: true, responseText: true, responseAnalysis: true },
  });

  let encrypted = 0;
  let skipped = 0;
  for (const letter of letters) {
    const data: { body?: string; responseText?: string; responseAnalysis?: string } = {};
    if (letter.body && !isEncryptedText(letter.body)) {
      data.body = encryptText(letter.body);
    }
    if (letter.responseText && !isEncryptedText(letter.responseText)) {
      data.responseText = encryptText(letter.responseText);
    }
    if (letter.responseAnalysis && !isEncryptedText(letter.responseAnalysis)) {
      data.responseAnalysis = encryptText(letter.responseAnalysis);
    }
    if (Object.keys(data).length === 0) {
      skipped++;
      continue;
    }
    await prisma.letter.update({ where: { id: letter.id }, data });
    encrypted++;
  }

  await logAudit({
    actor: { id: admin.id, email: admin.email },
    action: "letters.encrypt_backfill",
    summary: `Encrypted ${encrypted} letter(s) at rest (${skipped} already encrypted/empty)`,
  });

  return NextResponse.json({ ok: true, encrypted, skipped });
}
