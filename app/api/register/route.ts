import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { validatePassword } from "@/lib/password";
import { clientIp, enforceRateLimit } from "@/lib/rateLimit";
import { CURRENT_TERMS_VERSION, PRIVACY_URL, TERMS_URL, recordTermsAcceptance } from "@/lib/terms";

// RC1-S8 (D-02 / P1-10): acceptance is REQUIRED and EXPLICIT. `z.literal(true)`
// rather than a boolean, so an absent, false, "true", 1 or null value is all the
// same thing — not an acceptance — and none of them can be coerced into one.
const schema = z.object({
  email: z.string().email(),
  password: z.string(),
  name: z.string().optional(),
  acceptTerms: z.literal(true),
});

// ⚠️ RELEASE ORDER (review L-3). This route writes TermsAcceptance, and
// prisma/migrations/20260728000000_terms_acceptance is AUTHORED, NOT APPLIED.
// Apply it at the owner-gated release step BEFORE this code deploys, or every
// signup 500s on a missing table — and this is the front door.
export async function POST(req: Request) {
  // Per-IP cap on account creation to blunt automated signup abuse.
  const limited = await enforceRateLimit(`register:${clientIp(req)}`, 5, 600);
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // Separated from the generic input error so the refusal is truthful about
    // WHICH requirement was not met — and so a direct POST that skips the UI
    // gets the same refusal the form would have given, not a silent success.
    if (!schema.pick({ acceptTerms: true }).safeParse(body).success) {
      return NextResponse.json(
        {
          error: "Please accept the Terms of Service and Privacy Policy to create your account.",
          termsRequired: true,
          termsUrl: TERMS_URL,
          privacyUrl: PRIVACY_URL,
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { email, password, name } = parsed.data;
  const passwordError = validatePassword(password);
  if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return NextResponse.json({ error: "Account already exists" }, { status: 409 });
  // ONE transaction. An account that exists with no recorded acceptance is
  // exactly the state D-02 found in production; a signup that half-applies must
  // not be able to recreate it. The version written is the SERVER's published
  // constant — the request body carries no version and cannot choose one.
  // Hashed OUTSIDE the transaction: bcrypt is deliberately slow, and holding a
  // database transaction open across it would be a self-inflicted lock.
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { email: email.toLowerCase(), name, passwordHash },
    });
    await recordTermsAcceptance(created.id, CURRENT_TERMS_VERSION, "registration", tx);
    return created;
  });
  return NextResponse.json({ ok: true, id: user.id });
}
