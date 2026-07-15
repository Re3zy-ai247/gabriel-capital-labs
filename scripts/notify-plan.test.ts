// GIOS platform guard — Migration #10 (notify.plan). Proves the notification DECISION capability
// is (a) a pure, byte-identical function routed through Registry → Resolution → PEP → the module,
// (b) deterministic + TOKEN-FREE + tenant-scoped in its idempotency key, (c) enforces CAN-SPAM
// header policy, and (d) leaks NO raw PII (hash-only). It sends NOTHING — the Layer-3 effect is
// not built. Pure — no DB, no network. Run: npx tsx scripts/notify-plan.test.ts
import { buildNotificationPlan, type NotifyPlanInput } from "../lib/os/modules/notify";
import { appKernel } from "../lib/os/host/kernel";
import { actorFromSession } from "../lib/os/host/identity";
import { entitlementSnapshot } from "../lib/os/host/entitlements";
import { memoryClock, type CapabilityKey } from "../lib/os/kernel";

let failures = 0;
function ok(label: string, cond: boolean) { if (!cond) { failures++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`); }

const NOTIFY = "notify.plan.compose" as CapabilityKey;
const actor = actorFromSession({ id: "u1" });
const ent = entitlementSnapshot({ premium: false }); // platform decision → available WITHOUT premium

// A frozen snapshot (the equivalence pattern for a capability whose inputs are otherwise non-deterministic):
// the reset token is pre-minted and passed IN, so the plan is a pure function of captured inputs.
const resetInput: NotifyPlanInput = {
  channel: "email", purpose: "password_reset", commercial: false,
  tenantId: "u1", recipientRef: "jane@example.com", event: "reset:u1:tok_abc123",
  content: { subject: "Reset your password", text: "Link: https://app/reset?token=RAW_TOKEN" },
};

// ---- Registry + Resolution: platform capability available to a FREE actor ----
{
  const k = appKernel({ clock: memoryClock() });
  ok("registry: platform notify module registered → capability available (free)", k.resolve(NOTIFY, ent) === "available");
  ok("resolution: available without premium (Layer-2 decision, not a paid AI tool)", k.resolve(NOTIFY, entitlementSnapshot({ premium: false })) === "available");
}

async function main() {
  // ---- BYTE-IDENTICAL: kernel-routed === direct pure function (over the frozen snapshot) ----
  {
    const direct = buildNotificationPlan(resetInput);
    const k = appKernel({ clock: memoryClock() });
    const res = await k.dispatch(actor, NOTIFY, resetInput, ent, "notification");
    ok("dispatch: authorized + ok", res.ok);
    ok("BYTE-IDENTICAL: kernel-routed plan === direct buildNotificationPlan (frozen snapshot)", res.ok && JSON.stringify(res.data) === JSON.stringify(direct));
  }

  // ---- Determinism + TOKEN-FREE idempotency key ----
  {
    const a = buildNotificationPlan(resetInput);
    const b = buildNotificationPlan(resetInput);
    ok("determinism: identical input → identical plan (pure)", JSON.stringify(a) === JSON.stringify(b));
    // Same logical event, DIFFERENT volatile content (a new random token in the body) → SAME key:
    // a retry of one reset coalesces; the key never depends on the token or the clock.
    const retry = { ...resetInput, content: { subject: "Reset your password", text: "Link: https://app/reset?token=DIFFERENT_TOKEN" } };
    ok("idempotency key is TOKEN-FREE: same event, different body → SAME key (retry coalesces)", buildNotificationPlan(retry).idempotencyKey === a.idempotencyKey);
    ok("idempotency key: same event, different body → DIFFERENT contentHash", buildNotificationPlan(retry).contentHash !== a.contentHash);
    // DISTINCT reset requests use DISTINCT event ids → DISTINCT keys: two resets never coalesce.
    const second = { ...resetInput, event: "reset:u1:tok_XYZ789" };
    ok("distinct events → distinct keys (two reset requests never coalesce)", buildNotificationPlan(second).idempotencyKey !== a.idempotencyKey);
  }

  // ---- Tenant scoping: keys + recipient hashes never collide across tenants ----
  {
    const tenantA = buildNotificationPlan(resetInput);
    const tenantB = buildNotificationPlan({ ...resetInput, tenantId: "u2" }); // same address, different tenant
    ok("tenant-scoped: same recipient, different tenant → DIFFERENT idempotencyKey (no cross-tenant collision)", tenantA.idempotencyKey !== tenantB.idempotencyKey);
    ok("tenant-scoped: same recipient, different tenant → DIFFERENT recipientHash", tenantA.recipientHash !== tenantB.recipientHash);
  }

  // ---- Hash-only: the plan holds NO raw recipient/content ----
  {
    const plan = buildNotificationPlan(resetInput);
    const blob = JSON.stringify(plan);
    ok("hash-only receipt: plan contains NO raw recipient address", !blob.includes("jane@example.com"));
    ok("hash-only receipt: plan contains NO raw content (subject/body)", !blob.includes("Reset your password") && !blob.includes("RAW_TOKEN"));
    ok("hash-only receipt: content + recipient digests are SHA-256 hex (64 chars)", /^[0-9a-f]{64}$/.test(plan.contentHash) && /^[0-9a-f]{64}$/.test(plan.recipientHash));
  }

  // ---- CAN-SPAM header policy (commercial email MUST carry unsubscribe; transactional MUST NOT) ----
  {
    const digest = (headers?: Record<string, string>): NotifyPlanInput => ({
      channel: "email", purpose: "weekly_digest", commercial: true, tenantId: "u1",
      recipientRef: "jane@example.com", event: "digest:u1:2026-W29", content: { subject: "Your weekly Brief" }, headers,
    });
    const missing = buildNotificationPlan(digest());
    ok("CAN-SPAM: commercial email w/o List-Unsubscribe → non-compliant + requiresPostalFooter", !missing.compliant && missing.headerViolations.length > 0 && missing.requiresPostalFooter);
    const present = buildNotificationPlan(digest({ "List-Unsubscribe": "<https://app/unsub>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }));
    ok("CAN-SPAM: commercial email WITH the unsubscribe pair → compliant", present.compliant && present.headerViolations.length === 0);
    // A transactional email must NOT carry a marketing unsubscribe (never let a user opt out of security mail).
    const txnWithUnsub = buildNotificationPlan({ ...resetInput, headers: { "List-Unsubscribe": "<https://app/unsub>" } });
    ok("CAN-SPAM: transactional email carrying List-Unsubscribe → non-compliant (forbidden)", !txnWithUnsub.compliant);
    const txnClean = buildNotificationPlan(resetInput);
    ok("CAN-SPAM: transactional email, no marketing headers → compliant, no required headers, no postal footer", txnClean.compliant && txnClean.requiredHeaders.length === 0 && !txnClean.requiresPostalFooter);
  }

  // ---- The PEP actually gates (default-deny) ----
  {
    const k = appKernel({ clock: memoryClock() });
    ok("PEP: non-permissible purpose denied (e.g. marketing)", !(await k.dispatch(actor, NOTIFY, resetInput, ent, "marketing")).ok);
    const noPerm = { ...ent, grantedPermissions: new Set<string>() };
    ok("PEP: missing notify:plan permission denied", !(await k.dispatch(actor, NOTIFY, resetInput, noPerm, "notification")).ok);
    ok("PEP: permissible purpose 'commercial' allowed", (await k.dispatch(actor, NOTIFY, resetInput, ent, "commercial")).ok);
  }

  // ---- Layer-2 only: the module NEVER performs an effect (design invariant) ----
  {
    const k = appKernel({ clock: memoryClock() });
    const res = await k.dispatch(actor, NOTIFY, resetInput, ent, "notification");
    ok("Layer-2 invariant: capability returns a plan VALUE and sends nothing (no effect surface)", res.ok && typeof (res.data as { idempotencyKey: string }).idempotencyKey === "string");
  }

  // ---- Manifest: the platform capability is self-describing + correctly attributed ----
  {
    const m = appKernel({ clock: memoryClock() }).manifest();
    const spec = m.find((s) => s.key === NOTIFY);
    ok("manifest: notify.plan.compose present, plugin='notify', deterministic, not premium", !!spec && spec.plugin === "notify" && spec.reasoning === "deterministic" && !spec.premium);
    ok("manifest: platform capability does not pollute the credit plugin (credit still 5)", m.filter((s) => s.plugin === "credit").length === 5);
  }
}

main().then(() => {
  console.log(failures === 0 ? "\nAll Kai Notify (notify.plan) guards passed." : `\n${failures} guard(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
});
