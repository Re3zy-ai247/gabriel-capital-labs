import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { decryptText } from "@/lib/docCrypto";
import { getFurnisherContact } from "@/lib/furnisher";
import { MailService } from "@/lib/mail";
import type { MailPieceSpec, PlanTier } from "@/lib/mail";
import {
  estimatePages, letterContentHash, bureauMailAddress, furnisherMailAddress, senderMailAddress, oneLine,
} from "@/lib/mailExecution";

export const dynamic = "force-dynamic";

// Prepare a "mail for me" job for a generated letter: resolve the recipient +
// return addresses, compute the real print spec + price (pricing engine), and
// create/return the Mail Manifest at IN_REVIEW. Idempotent per letter (one
// manifest, id = mail_<letterId>) so revisiting the flow resumes it.
export async function POST(req: Request) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { letterId } = await req.json().catch(() => ({}));
  if (!letterId) return NextResponse.json({ error: "Missing letterId." }, { status: 400 });

  const letter = await prisma.letter.findFirst({ where: { id: String(letterId), userId: user.id } });
  if (!letter) return NextResponse.json({ error: "Letter not found." }, { status: 404 });

  const from = senderMailAddress(user);
  if (!from) {
    return NextResponse.json({ error: "Add your mailing address in Settings first — a mailed dispute needs a return address.", needsAddress: "sender" }, { status: 422 });
  }

  // Resolve the recipient's structured address (bureau = known public address;
  // furnisher/collector = the contact parsed from the report). Never invented.
  let to = null;
  if (letter.targetBureau) {
    to = bureauMailAddress(letter.targetBureau);
  } else if (letter.tradelineId) {
    to = furnisherMailAddress(letter.recipientName, await getFurnisherContact(letter.tradelineId));
  }
  if (!to) {
    return NextResponse.json({ error: "I don't have a complete mailing address for this recipient yet, so I can't mail it for you. You can still download and mail it yourself.", needsAddress: "recipient" }, { status: 422 });
  }

  const body = decryptText(letter.body);
  const spec: MailPieceSpec = {
    pages: estimatePages(body), color: false, doubleSided: true, mailClass: "first_class", certified: false,
  };
  // ---- RC1-S11 (C-1): THE QUOTE IS A PROPERTY OF THE PIECE, NOT THE ACCOUNT --
  // This used to read the mailing account's own row —
  //   plan = user.plan; isAgency = user.isAgency || plan === "agency" || "agency_pro"
  // — and hand both to the pricing engine. An Agency owner mailing THEIR OWN
  // letter (no client workspace open, so currentUserOrDemo returns their row)
  // was quoted the 5% reseller markup instead of the consumer's 15%: 1149c
  // against 1249c for an identical piece. That is a payer/relationship changing
  // what a consumer receives, which is exactly the invariant this release is
  // built on.
  //
  // Both inputs are now constants. The quote depends on the SPEC alone — pages,
  // colour, sidedness, mail class, certified — so two people mailing the same
  // piece are quoted the same price, whatever their plan, credits, payer or
  // agency relationship. The engine still accepts both parameters (a future
  // white-label channel supplies its own policy); this consumer surface simply
  // does not feed it an account.
  const plan: PlanTier = "free";
  const isAgency = false;

  const svc = new MailService();
  const mailId = `mail_${letter.id}`;
  const contentHash = letterContentHash(body);
  const creditorName = (await prisma.tradeline.findUnique({ where: { id: letter.tradelineId ?? "" } }).catch(() => null))?.creditorName ?? null;

  const existing = await svc.getManifest(mailId);
  if (existing) {
    // Resume an in-flight job: project the FROZEN manifest (what the user agreed
    // to), never freshly-resolved values that could have drifted since.
    return NextResponse.json({
      mailId, status: existing.status,
      recipient: existing.recipient, recipientOneLine: oneLine(existing.recipient), sender: from,
      pages: existing.pages, mailClass: existing.mailClass, certified: existing.certified,
      price: existing.cost, contentHash, letterId: letter.id, round: letter.round, creditorName,
    });
  }

  const { price } = await svc.estimate({ spec, plan, isAgency });
  const manifest = await svc.initiate({
    mailId, letterId: letter.id, userId: user.id, tradelineId: letter.tradelineId, disputeId: letter.tradelineId,
    recipient: to, spec, cost: price, contentHash,
  });

  return NextResponse.json({
    mailId, status: manifest.status,
    recipient: to, recipientOneLine: oneLine(to), sender: from,
    pages: spec.pages, mailClass: spec.mailClass, certified: spec.certified,
    price, contentHash, letterId: letter.id, round: letter.round, creditorName,
  });
}
