import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { getStripe } from "@/lib/stripe";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Read consumer info for the settings form.
export async function GET() {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { fullName, addressLine1, addressLine2, city, state, zip, email } = user;
  return NextResponse.json({ fullName, addressLine1, addressLine2, city, state, zip, email });
}

// Save consumer info required for mailable letters. Also allows changing the
// account email (login identity) — sessions resolve by user id, so a change does
// not log the user out; they can sign in with the new email or their username.
export async function POST(req: Request) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json();

  // Optional email change. Because this changes the login identity, it requires
  // confirming the current password (same bar as the change-password flow) before
  // we validate, normalize, and ensure the address isn't already taken.
  let nextEmail: string | undefined;
  if (typeof b.email === "string") {
    const candidate = b.email.trim().toLowerCase();
    if (candidate && candidate !== user.email) {
      if (!EMAIL_RE.test(candidate)) {
        return NextResponse.json({ error: "That doesn't look like a valid email address." }, { status: 400 });
      }
      if (!user.passwordHash) {
        return NextResponse.json({ error: "This account has no password set, so its email can't be changed here." }, { status: 400 });
      }
      const confirmed = await bcrypt.compare(String(b.currentPassword || ""), user.passwordHash);
      if (!confirmed) {
        return NextResponse.json({ error: "Enter your current password to change your email." }, { status: 403 });
      }
      const taken = await prisma.user.findUnique({ where: { email: candidate } });
      if (taken && taken.id !== user.id) {
        return NextResponse.json({ error: "That email is already in use by another account." }, { status: 400 });
      }
      nextEmail = candidate;
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      fullName: b.fullName ?? user.fullName,
      addressLine1: b.addressLine1 ?? user.addressLine1,
      addressLine2: b.addressLine2 ?? user.addressLine2,
      city: b.city ?? user.city,
      state: b.state ?? user.state,
      zip: b.zip ?? user.zip,
      ...(nextEmail ? { email: nextEmail } : {}),
    },
  });

  // Keep the Stripe customer's email in sync so receipts/invoices match. Best
  // effort — never block the profile save if Stripe is unreachable.
  if (nextEmail && user.stripeCustomerId) {
    try {
      const stripe = getStripe();
      if (stripe) await stripe.customers.update(user.stripeCustomerId, { email: nextEmail });
    } catch (e) {
      console.error("stripe customer email sync failed", e);
    }
  }

  return NextResponse.json({ ok: true, emailChanged: Boolean(nextEmail), user: { fullName: updated.fullName, email: updated.email } });
}
