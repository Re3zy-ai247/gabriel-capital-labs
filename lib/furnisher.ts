import { prisma } from "./prisma";

// Furnisher / collector mailing contact parsed from a credit report's account
// "Contact" block (e.g. "LVNV FUNDING LLC, PO BOX 1269, GREENVILLE, SC 29602").
// Stored per-tradeline so the Dispute Letter Builder can pre-fill the recipient
// address instead of making the consumer copy it by hand.
//
// Kept in its own self-healing raw-SQL table (mirrors the StripeWebhookEvent
// dedup ledger) rather than as a Tradeline column: adding a column to the
// existing Tradeline table would make the generated Prisma client SELECT a column
// that build-time `prisma db push` can't add through Accelerate, breaking every
// tradeline read. A standalone table touched only by this module avoids that.

export interface FurnisherContact {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
}

// True when there's enough of a mailing address to be worth storing/using.
export function hasMailingAddress(c: FurnisherContact | null | undefined): boolean {
  return !!c && Boolean(c.line1 || c.city || c.zip);
}

let tableReady = false;
async function ensureTable(): Promise<void> {
  if (tableReady) return;
  // ON DELETE CASCADE so re-analyzing a report (which deletes + recreates its
  // tradelines) cleans up stale contacts automatically.
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "TradelineContact" (
       "tradelineId" TEXT NOT NULL PRIMARY KEY REFERENCES "Tradeline"("id") ON DELETE CASCADE ON UPDATE CASCADE,
       "data" TEXT NOT NULL,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`
  );
  tableReady = true;
}

// Persist (or replace) the parsed contact for a tradeline. No-op when there's no
// usable address.
export async function saveFurnisherContact(tradelineId: string, contact: FurnisherContact): Promise<void> {
  if (!hasMailingAddress(contact)) return;
  await ensureTable();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "TradelineContact" ("tradelineId", "data") VALUES ($1, $2)
     ON CONFLICT ("tradelineId") DO UPDATE SET "data" = EXCLUDED."data"`,
    tradelineId,
    JSON.stringify(contact)
  );
}

function parseRow(data: string): FurnisherContact | null {
  try {
    const c = JSON.parse(data);
    return c && typeof c === "object" ? (c as FurnisherContact) : null;
  } catch {
    return null;
  }
}

// Fetch contacts for many tradelines at once, keyed by tradelineId.
export async function getFurnisherContacts(tradelineIds: string[]): Promise<Record<string, FurnisherContact>> {
  const out: Record<string, FurnisherContact> = {};
  if (!tradelineIds.length) return out;
  await ensureTable();
  const placeholders = tradelineIds.map((_, i) => `$${i + 1}`).join(",");
  const rows = await prisma.$queryRawUnsafe<{ tradelineId: string; data: string }[]>(
    `SELECT "tradelineId", "data" FROM "TradelineContact" WHERE "tradelineId" IN (${placeholders})`,
    ...tradelineIds
  );
  for (const r of rows) {
    const c = parseRow(r.data);
    if (c) out[r.tradelineId] = c;
  }
  return out;
}

export async function getFurnisherContact(tradelineId: string): Promise<FurnisherContact | null> {
  const map = await getFurnisherContacts([tradelineId]);
  return map[tradelineId] ?? null;
}

// Render a contact into the multi-line mailing block the letter builder expects
// (one address line per newline). Excludes the name (that's the recipient field).
export function formatFurnisherAddress(c: FurnisherContact | null | undefined): string {
  if (!c) return "";
  const lines: string[] = [];
  if (c.line1) lines.push(c.line1);
  if (c.line2) lines.push(c.line2);
  const cityState = [c.city, c.state].filter(Boolean).join(", ");
  const cityLine = [cityState, c.zip].filter(Boolean).join(" ").trim();
  if (cityLine) lines.push(cityLine);
  return lines.join("\n");
}
