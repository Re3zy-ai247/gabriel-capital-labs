// Reference subscriber — NOTIFICATION_CREATED → the EXISTING notify path (Sprint 8).
//
// This does NOT create a parallel notification system. It reuses buildNotificationPlan
// (lib/os/modules/notify) for the deterministic, CAN-SPAM-checked plan (finally making
// plan.idempotencyKey load-bearing) and routes the send through the EXISTING
// sendPushToUser (lib/push.ts). The at-most-once guard reuses the kernel's durable
// idempotency ledger (effect.ts), so a redelivery or replay never double-sends.
//
// It sends ONLY to the event's own tenant (sendPushToUser(recipientUserId)) — NEVER
// sendPushToAdmins (an admin broadcast is a SYSTEM_EVENT concern behind the admin gate).
// The send is injectable so tests never touch a real device, honoring "never send test
// alerts to customer-facing channels".
import { buildNotificationPlan } from "@/lib/os/modules/notify";
import { sendPushToUser, type PushPayload } from "@/lib/push";
import { claimEffect, settleEffect } from "../effect";
import type { EventHandler } from "../registry";
import type { PlatformEvent } from "../envelope";
import type { IdemState } from "@/lib/os/kernel";

interface NotificationPayload {
  channel: "email" | "push";
  purpose: string;
  recipientUserId: string;
  commercial: boolean;
  dedupeEvent: string;
}

export interface NotifyDeps {
  claim: (key: string) => Promise<IdemState>;
  settle: (key: string, state: "committed" | "failed") => Promise<void>;
  sendPush: (userId: string, payload: PushPayload) => Promise<void>;
}

const defaultDeps: NotifyDeps = {
  claim: claimEffect,
  settle: (k, s) => settleEffect(k, s),
  sendPush: sendPushToUser,
};

// Build the handler over injectable deps (default = real notify path). Returns a
// registry EventHandler.
export function makeNotificationCreatedHandler(deps: NotifyDeps = defaultDeps): EventHandler {
  return async (event: PlatformEvent) => {
    if (event.type !== "NOTIFICATION_CREATED") return;
    const p = event.payload as unknown as NotificationPayload;

    // Reuse the deterministic, tenant-scoped plan + its CAN-SPAM compliance decision.
    const plan = buildNotificationPlan({
      channel: p.channel,
      purpose: p.purpose,
      commercial: p.commercial,
      tenantId: event.tenantId,
      recipientRef: p.recipientUserId,
      event: p.dedupeEvent,
      content: { purpose: p.purpose }, // reference: the producing site supplies real content
    });
    if (!plan.compliant) {
      console.warn(`eventBus: NOTIFICATION_CREATED not compliant (${plan.headerViolations.join("; ")}) — not sent`);
      return;
    }

    // Claim BEFORE the effect — at-most-once. A redelivery/replay sees committed/pending → skip.
    const state = await deps.claim(plan.idempotencyKey);
    if (state !== "won") return;

    try {
      if (plan.channel === "push") {
        await deps.sendPush(p.recipientUserId, { title: `CreditVector · ${p.purpose}`, body: "You have a new update." });
      }
      // Email routing is deferred to the producing site (it owns the composed content);
      // the reference handler demonstrates the claim→send→settle pattern on push.
      await deps.settle(plan.idempotencyKey, "committed");
    } catch (e) {
      await deps.settle(plan.idempotencyKey, "failed"); // reclaimable — a retry can re-run
      throw e;
    }
  };
}

export const notificationCreatedHandler = makeNotificationCreatedHandler();
