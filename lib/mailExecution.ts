// Mail execution helpers (Sprint XI). Deterministic glue between a generated
// Letter and the Sprint VIII mail architecture — computes the print spec, a
// content hash (proof of intent), and the structured recipient/sender addresses
// the manifest needs. No AI, no network, no regeneration of the letter.
import { createHash } from "crypto";
import type { Bureau } from "@prisma/client";
import { BUREAU_ADDRESS } from "./bureaus";
import type { FurnisherContact } from "./furnisher";
import type { MailAddress } from "./mail";

// Deterministic page estimate from the letter body. Letters render on US Letter
// with 1in margins (~46 text lines/page); the recipient block is part of the body.
export function estimatePages(body: string): number {
  const text = body.replace(/\r\n/g, "\n");
  const lines = text.split("\n").length;
  // Guard against a few very long lines wrapping across pages: take the larger of
  // the line-based and character-based estimates (~46 lines or ~2900 chars/page).
  return Math.max(1, Math.ceil(lines / 46), Math.ceil(text.length / 2900));
}

// A stable SHA-256 of the exact letter text that was approved — the manifest's
// "proof of intent" so the receipt reflects precisely what the user signed off on.
export function letterContentHash(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

// Parse a "City, ST ZIP" line into parts (handles ZIP+4).
function parseCityStateZip(line: string): { city: string; state: string; zip: string } | null {
  const m = /^(.+?),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/.exec(line.trim());
  return m ? { city: m[1].trim(), state: m[2].toUpperCase(), zip: m[3] } : null;
}

// The bureau's public dispute address as a structured MailAddress.
export function bureauMailAddress(bureau: Bureau): MailAddress | null {
  const a = BUREAU_ADDRESS[bureau];
  if (!a) return null;
  const last = a.lines[a.lines.length - 1];
  const csz = parseCityStateZip(last);
  if (!csz) return null;
  const line1 = a.lines[0];
  const line2 = a.lines.length > 2 ? a.lines[1] : undefined;
  return { name: a.name, line1, line2, city: csz.city, state: csz.state, zip: csz.zip, country: "US" };
}

// A furnisher/collector contact → structured MailAddress, or null when the stored
// contact lacks enough of an address to mail (we never invent one).
export function furnisherMailAddress(name: string, c: FurnisherContact | null): MailAddress | null {
  if (!c || !c.line1 || !c.city || !c.state || !c.zip) return null;
  return { name: c.name?.trim() || name, line1: c.line1, line2: c.line2 || undefined, city: c.city, state: c.state, zip: c.zip, country: "US" };
}

// The customer's own return address, from their profile. Null when incomplete —
// a mailable piece needs a real return address.
export function senderMailAddress(u: {
  fullName?: string | null; addressLine1?: string | null; addressLine2?: string | null;
  city?: string | null; state?: string | null; zip?: string | null;
}): MailAddress | null {
  if (!u.addressLine1 || !u.city || !u.state || !u.zip) return null;
  return {
    name: u.fullName?.trim() || "",
    line1: u.addressLine1, line2: u.addressLine2 || undefined,
    city: u.city, state: u.state, zip: u.zip, country: "US",
  };
}

export function oneLine(a: MailAddress): string {
  return [a.name, a.line1, a.line2, `${a.city}, ${a.state} ${a.zip}`].filter(Boolean).join(", ");
}
