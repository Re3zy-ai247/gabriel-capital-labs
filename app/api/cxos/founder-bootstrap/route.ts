import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, clientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// CXOS Phase 4 — the Preview-only Founder review bootstrap.
//
// Creates (idempotently) two clearly-synthetic review accounts so the Founder
// can review the authenticated experience on a protected Preview WITHOUT using
// any production credential:
//
//   cxos.review.consumer@preview.creditvector.app   (consumer projection)
//   cxos.review.agency@preview.creditvector.app     (agency projection)
//
// THE GATE ORDER IS A SAFETY ORDER — each line is individually load-bearing:
//
//   1. Production is HARD OFF. VERCEL_ENV === "production" → 404 before
//      anything else executes. Same shape as /api/demo/seed's guard; pinned
//      first so no later condition can precede it.
//   2. Only a Vercel PREVIEW (or local development) may proceed. A production
//      build running anywhere else (self-hosted, misconfigured) is refused.
//   3. THE SHARED-DATABASE STOP. Repository truth (CLAUDE.md, owner-corrected
//      2026-07-20) records that DATABASE_URL has been ONE value across
//      Production and Preview. Until the owner provisions a SEPARATE preview
//      database and attests it by setting CXOS_PREVIEW_DB_ISOLATED=1 in the
//      Preview environment scope ONLY, this route refuses with 409 — a
//      synthetic account must never be written into the production dataset.
//   4. A per-deployment secret (CXOS_FOUNDER_BOOTSTRAP_SECRET, Preview scope
//      only) must be presented in the x-cxos-bootstrap header. Unset → 404
//      (the route does not exist without it). Compared timing-safe. The
//      review accounts' PASSWORD likewise arrives only from
//      CXOS_FOUNDER_REVIEW_PASSWORD — no static credential exists in the
//      repository, and no credential is ever echoed back.
//
// Idempotent: upserts by unique email; re-running refreshes nothing
// destructive. Revocation: POST ?revoke=1 sets disabled=true on both rows —
// lib/auth.ts refuses disabled sign-ins and lib/session.ts evicts live
// sessions, both already proven. Deletion is deliberately NOT offered: user
// hard-deletes are constitutionally contained (Implementation Slice 0).
const REVIEW_ACCOUNTS = [
  {
    email: "cxos.review.consumer@preview.creditvector.app",
    username: "cxreview-consumer",
    name: "CXOS Review — Synthetic Consumer",
    isAgency: false,
  },
  {
    email: "cxos.review.agency@preview.creditvector.app",
    username: "cxreview-agency",
    name: "CXOS Review — Synthetic Agency",
    isAgency: true,
  },
] as const;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(req: Request) {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const isPreview = process.env.VERCEL_ENV === "preview";
  const isLocalDev = process.env.NODE_ENV === "development";
  if (!isPreview && !isLocalDev) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (process.env.CXOS_PREVIEW_DB_ISOLATED !== "1") {
    return NextResponse.json(
      {
        error:
          "Refused: preview database isolation is not attested. Repository truth records DATABASE_URL as shared with Production; provision a separate Preview database, scope DATABASE_URL for Preview, then set CXOS_PREVIEW_DB_ISOLATED=1 (Preview scope only).",
      },
      { status: 409 }
    );
  }
  const secret = process.env.CXOS_FOUNDER_BOOTSTRAP_SECRET;
  const password = process.env.CXOS_FOUNDER_REVIEW_PASSWORD;
  if (!secret || !password) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const presented = req.headers.get("x-cxos-bootstrap") ?? "";
  if (!safeEqual(presented, secret)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const limited = await enforceRateLimit(`cxos-bootstrap:${clientIp(req)}`, 5, 3600);
  if (limited) return limited;

  const revoke = new URL(req.url).searchParams.get("revoke") === "1";
  if (revoke) {
    const r = await prisma.user.updateMany({
      where: { email: { in: REVIEW_ACCOUNTS.map((a) => a.email) } },
      data: { disabled: true },
    });
    return NextResponse.json({ ok: true, revoked: r.count });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const results: { email: string; created: boolean }[] = [];
  for (const acct of REVIEW_ACCOUNTS) {
    const existing = await prisma.user.findUnique({ where: { email: acct.email } });
    if (existing) {
      // Idempotent refresh: re-enable and roll the hash to the CURRENT env
      // password. Role stays USER; plan stays whatever review needs it to be
      // (default free) — minimum clearance for founder review.
      await prisma.user.update({
        where: { email: acct.email },
        data: { passwordHash, disabled: false, name: acct.name, isAgency: acct.isAgency },
      });
      results.push({ email: acct.email, created: false });
    } else {
      await prisma.user.create({
        data: {
          email: acct.email,
          username: acct.username,
          name: acct.name,
          passwordHash,
          isAgency: acct.isAgency,
        },
      });
      results.push({ email: acct.email, created: true });
    }
  }
  // Never echo any credential material — account identifiers only.
  return NextResponse.json({ ok: true, accounts: results });
}
