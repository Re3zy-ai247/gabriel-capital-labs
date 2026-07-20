// Run: npx tsx scripts/eventbus-notification-nodup.test.ts
//
// Proves the NOTIFICATION_CREATED reference subscriber does NOT duplicate the
// notification system and does NOT double-send: it reuses buildNotificationPlan +
// claims the plan.idempotencyKey via the shared durable ledger, so a redelivery/replay
// is a no-op. Also proves it sends only to the tenant (never sendPushToAdmins) and
// honors the CAN-SPAM compliance decision. Sender + claim are injected, so no real
// device is ever touched.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { makeNotificationCreatedHandler, type NotifyDeps } from "../lib/eventBus/subscribers/notificationCreated";
import type { PlatformEvent } from "../lib/eventBus/envelope";

let pass = 0, fail = 0;
const check = (label: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error(`FAIL: ${label}`); } };

const event = (payload: Record<string, unknown>): PlatformEvent => ({
  id: "evt_n", type: "NOTIFICATION_CREATED", version: 1, tenantId: "u1", agencyId: null, actorId: "system",
  source: "notify", correlationId: "evt_n", payload, createdAt: new Date(0).toISOString(), redactedAt: null,
});

// A fake 3-state ledger: first claim of a key => "won"; after commit => "committed".
function fakeLedger() {
  const state = new Map<string, "won" | "committed" | "failed">();
  const deps = {
    claims: [] as string[], sends: [] as string[],
    claim: async (key: string) => {
      const cur = state.get(key);
      deps.claims.push(key);
      if (!cur || cur === "failed") { state.set(key, "won"); return "won" as const; }
      return cur;
    },
    settle: async (key: string, s: "committed" | "failed") => { state.set(key, s); },
    sendPush: async (userId: string) => { deps.sends.push(userId); },
  };
  return deps;
}

async function run() {
  // ── No double send across a redelivery ──────────────────────────────────────
  {
    const led = fakeLedger();
    const handler = makeNotificationCreatedHandler(led as unknown as NotifyDeps);
    const ev = event({ channel: "push", purpose: "moderation_alert", recipientUserId: "u1", commercial: false, dedupeEvent: "modalert:1" });
    await handler(ev);
    await handler(ev); // redelivery — same plan.idempotencyKey
    check("push sent exactly ONCE across a redelivery (idempotency claim)", led.sends.length === 1);
    check("send went to the tenant recipient", led.sends[0] === "u1");
    check("claim was attempted on both deliveries (second observed committed)", led.claims.length === 2);
  }

  // ── Non-compliant commercial email is NOT sent ──────────────────────────────
  {
    const led = fakeLedger();
    const handler = makeNotificationCreatedHandler(led as unknown as NotifyDeps);
    // commercial email with no List-Unsubscribe headers → plan.compliant === false
    await handler(event({ channel: "email", purpose: "promo", recipientUserId: "u1", commercial: true, dedupeEvent: "promo:1" }));
    check("non-compliant commercial email is NOT sent (CAN-SPAM gate reused)", led.sends.length === 0);
  }

  // ── A failed send is reclaimable (settled failed, not committed) ────────────
  {
    const led = fakeLedger();
    const handler = makeNotificationCreatedHandler({
      claim: led.claim, settle: led.settle,
      sendPush: async () => { throw new Error("push infra down"); },
    } as unknown as NotifyDeps);
    let threw = false;
    try { await handler(event({ channel: "push", purpose: "x", recipientUserId: "u1", commercial: false, dedupeEvent: "x:1" })); }
    catch { threw = true; }
    check("a failing send propagates (so the bus logs it) ", threw);
    // A subsequent delivery can retry because the key was settled 'failed' → 'won' again
    const led2sends: string[] = [];
    const retryHandler = makeNotificationCreatedHandler({
      claim: led.claim, settle: led.settle, sendPush: async (u: string) => { led2sends.push(u); },
    } as unknown as NotifyDeps);
    await retryHandler(event({ channel: "push", purpose: "x", recipientUserId: "u1", commercial: false, dedupeEvent: "x:1" }));
    check("after a failed send, a redelivery re-sends (reclaimable, not stuck)", led2sends.length === 1);
  }

  // ── Code-scan: the handler NEVER calls sendPushToAdmins ──────────────────────
  {
    // Strip comments so the scan judges CODE, not the prose that names the forbidden call.
    const src = readFileSync(join(__dirname, "..", "lib/eventBus/subscribers/notificationCreated.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    check("notificationCreated never references sendPushToAdmins (no admin broadcast)", !/sendPushToAdmins/.test(src));
    check("notificationCreated reuses buildNotificationPlan (no parallel notify system)", /buildNotificationPlan/.test(src));
    check("notificationCreated reuses the shared effect claim (no second idempotency store)", /claimEffect|deps\.claim/.test(src));
  }

  console.log(`\neventbus-notification-nodup.test.ts: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
run();
