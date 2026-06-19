import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logAudit } from "@/lib/admin";
import { encryptText, isEncryptedText } from "@/lib/docCrypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// One-time (idempotent) backfill: encrypts any Report.rawText still stored as
// plaintext at rest. Already-encrypted ("cv1:") rows and empty rows are skipped,
// so it is safe to run repeatedly. ADMIN-only — it reads every consumer's raw
// credit-report PII.
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const reports = await prisma.report.findMany({ select: { id: true, rawText: true } });

  let encrypted = 0;
  let skipped = 0;
  for (const report of reports) {
    if (!report.rawText || isEncryptedText(report.rawText)) {
      skipped++;
      continue;
    }
    await prisma.report.update({
      where: { id: report.id },
      data: { rawText: encryptText(report.rawText) },
    });
    encrypted++;
  }

  await logAudit({
    actor: { id: admin.id, email: admin.email },
    action: "reports.encrypt_backfill",
    summary: `Encrypted ${encrypted} report(s) at rest (${skipped} already encrypted/empty)`,
  });

  return NextResponse.json({ ok: true, encrypted, skipped });
}
