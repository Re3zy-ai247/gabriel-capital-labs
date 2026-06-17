import { currentAccount } from "./session";
import { prisma } from "./prisma";
import {
  SUPPORT_CATEGORIES, SUPPORT_CATEGORY_KEYS, supportCategoryLabel,
  normalizeSupportCategory, SUPPORT_LIMITS, cleanSupportText,
} from "./supportShared";

// Support tickets are open to EVERY signed-in user, on any plan (including free).
// A ticket is a thread of messages; staff (ADMIN) replies are flagged isStaff.
// Client-safe constants live in ./supportShared; this module adds the server-only
// data layer (Prisma + session).

export {
  SUPPORT_CATEGORIES, SUPPORT_CATEGORY_KEYS, supportCategoryLabel,
  normalizeSupportCategory, SUPPORT_LIMITS, cleanSupportText,
};

export type SupportAccount = NonNullable<Awaited<ReturnType<typeof currentAccount>>>;

export function supportDisplayName(account: {
  name?: string | null;
  agencyName?: string | null;
  email?: string | null;
}): string {
  return (account.name?.trim() || account.agencyName?.trim() || account.email?.trim() || "User").slice(0, 80);
}

// Self-heal: create the support tables at runtime. CREATE TABLE IF NOT EXISTS via
// raw SQL works through the Accelerate proxy even though build-time
// `prisma db push` does not — so the feature works with no manual migrate step.
const SUPPORT_DDL = [
  `CREATE TABLE IF NOT EXISTS "SupportTicket" (
     "id" TEXT NOT NULL PRIMARY KEY,
     "userId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
     "userEmail" TEXT NOT NULL,
     "userName" TEXT NOT NULL,
     "subject" TEXT NOT NULL,
     "category" TEXT NOT NULL DEFAULT 'general',
     "status" TEXT NOT NULL DEFAULT 'open',
     "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "SupportTicket_status_lastActivityAt_idx" ON "SupportTicket"("status", "lastActivityAt")`,
  `CREATE INDEX IF NOT EXISTS "SupportTicket_userId_idx" ON "SupportTicket"("userId")`,
  `CREATE TABLE IF NOT EXISTS "SupportTicketMessage" (
     "id" TEXT NOT NULL PRIMARY KEY,
     "ticketId" TEXT NOT NULL REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE,
     "authorId" TEXT,
     "authorName" TEXT NOT NULL,
     "isStaff" BOOLEAN NOT NULL DEFAULT false,
     "body" TEXT NOT NULL,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "SupportTicketMessage_ticketId_createdAt_idx" ON "SupportTicketMessage"("ticketId", "createdAt")`,
];

let supportTablesReady = false;
export async function ensureSupportTables(): Promise<void> {
  if (supportTablesReady) return;
  for (const sql of SUPPORT_DDL) await prisma.$executeRawUnsafe(sql);
  supportTablesReady = true;
}

// Any signed-in user may use support; returns the real account or null. Also
// self-heals the schema on first use.
export async function requireSupportUser(): Promise<SupportAccount | null> {
  const account = await currentAccount();
  if (!account) return null;
  await ensureSupportTables();
  return account;
}
