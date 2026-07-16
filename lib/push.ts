import webpush from "web-push";
import { prisma } from "./prisma";

// Web Push (PWA phone notifications). FAILS SAFE: if VAPID keys aren't configured,
// or a send errors, it no-ops / logs and never throws — a push problem must never
// break the action that triggered it. Dead subscriptions (410/404) are pruned.

const PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:no-reply@creditvector.app";

let configured = false;
function configure(): boolean {
  if (configured) return true;
  if (!PUBLIC || !PRIVATE) return false;
  webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
  configured = true;
  return true;
}

// Self-heal: the table creates itself at runtime (mirrors ensureRateLimitTable etc.).
let tableReady = false;
export async function ensurePushTable(): Promise<void> {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "PushSubscription" (
       "id" TEXT NOT NULL PRIMARY KEY,
       "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
       "endpoint" TEXT NOT NULL,
       "p256dh" TEXT NOT NULL,
       "auth" TEXT NOT NULL,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId")`
  );
  tableReady = true;
}

export interface WebPushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

// Validate a user-supplied push endpoint at the write boundary (defensive; the send path is
// admin-only today but goes live with user-facing push). Require https + reject IP-literal /
// loopback / link-local / private / metadata hosts so a stored endpoint can never become an SSRF
// sink when web-push later POSTs to it.
export function isSafePushEndpoint(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local")) return false;
  if (host === "[::1]" || host.startsWith("[fc") || host.startsWith("[fd") || host.startsWith("[fe80")) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const p = host.split(".").map(Number);
    if (p[0] === 0 || p[0] === 10 || p[0] === 127) return false;
    if (p[0] === 169 && p[1] === 254) return false;              // link-local + cloud metadata
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return false;
    if (p[0] === 192 && p[1] === 168) return false;
  }
  return true;
}

export async function savePushSubscription(userId: string, sub: WebPushSub): Promise<void> {
  if (!isSafePushEndpoint(sub.endpoint)) throw new Error("invalid push endpoint");
  await ensurePushTable();
  // Re-subscribing from the same device updates the keys + ownership (upsert on endpoint).
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
}

export async function deletePushSubscription(userId: string, endpoint: string): Promise<void> {
  await ensurePushTable();
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

// Send to every device a user has opted in from. Prunes dead subscriptions.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!configure()) return;
  try {
    await ensurePushTable();
    const subs = await prisma.pushSubscription.findMany({ where: { userId } });
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload)
          );
        } catch (e) {
          const code = (e as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) {
            await prisma.pushSubscription.deleteMany({ where: { endpoint: s.endpoint } }).catch(() => {});
          } else {
            console.error("push send failed", code);
          }
        }
      })
    );
  } catch (e) {
    console.error("sendPushToUser failed (non-fatal)", e);
  }
}

// Send to all ADMIN users (drafts/reports concern admins).
export async function sendPushToAdmins(payload: PushPayload): Promise<void> {
  if (!configure()) return;
  try {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    await Promise.all(admins.map((a) => sendPushToUser(a.id, payload)));
  } catch (e) {
    console.error("sendPushToAdmins failed (non-fatal)", e);
  }
}
