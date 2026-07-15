// Kai Notify — GIOS PLATFORM module (Migration #10, "notify.plan"). Platform-generic, NOT
// CreditVector-specific: any app on GIOS inherits it. This is a LAYER-2 (Governance) decision
// capability in the three-runtime model — it DECIDES how a notification should be governed and
// EXECUTES NOTHING. The Layer-3 effect (the actual email/push send) is deliberately NOT built
// here (ADR-0027): it is designed-not-built until a durable idempotency store + a real second
// in-repo consumer earn it. See ADR-0027.
//
// What it produces (a pure function of its input — deterministic, replayable, no clock, no
// randomness, no I/O): a NotificationPlan carrying
//   • a deterministic, tenant-scoped, TOKEN-FREE idempotencyKey (never Date.now/UUID/reset-token),
//   • the transactional-vs-commercial purpose class (the app declares it; the platform enforces
//     the consequences — mechanism-not-policy),
//   • the CAN-SPAM header policy (commercial email MUST carry List-Unsubscribe; a transactional
//     email MUST NOT — so a user can never opt out of security mail),
//   • HASH-ONLY content + recipient digests (SHA-256) so the future audit receipt holds no PII
//     (founder directive: hash-only receipts by default; mirrors lib/mailExecution letterContentHash).
// The plan holds NO raw recipient/subject/body — the raw payload stays with the caller for the
// (future, app-local, permissioned) effect. The plan is fully auditable without PII.
import { createHash } from "crypto";
import type { CapabilityKey, CapabilitySpec, KaiModule, ModuleResult, OsContext } from "@/lib/os/kernel";

export type NotifyChannel = "email" | "push";

// Content is already composed by the app (e.g. lib/briefDigest.renderDigestEmail stays app-side and
// UNCHANGED). The platform only hashes it; it never renders or stores it.
export interface NotifyPlanInput {
  channel: NotifyChannel;
  purpose: string;      // logical purpose, e.g. "password_reset", "weekly_digest", "moderation_alert"
  commercial: boolean;  // the app's CAN-SPAM classification (policy the app owns; the platform enforces it)
  tenantId: string;     // the recipient-owning tenant scope (keys + hashes are namespaced by it)
  recipientRef: string; // opaque recipient id (email or userId) — hashed, never retained raw
  event: string;        // STABLE logical event id for idempotency — e.g. "reset:<userId>:<tokenId>",
                        // "digest:<userId>:2026-W29". MUST NOT contain a random token or wall-clock.
  content: Record<string, unknown>; // channel-appropriate composed content (hashed, then discarded)
  headers?: Record<string, string>; // transport headers the caller intends (e.g. List-Unsubscribe)
}

export interface NotificationPlan {
  channel: NotifyChannel;
  purpose: string;
  compliancePurposeClass: "transactional" | "commercial";
  idempotencyKey: string;    // sha256(channel|tenantId|purpose|recipientRef|event) — deterministic, token-free
  contentHash: string;       // sha256(canonical content) — for the hash-only receipt
  recipientHash: string;     // sha256(tenantId|recipientRef) — never the raw address
  requiredHeaders: string[]; // CAN-SPAM policy: what commercial email MUST carry
  requiresPostalFooter: boolean; // commercial email must carry a physical postal address (CAN-SPAM)
  headerViolations: string[];// deterministic policy check vs the supplied headers ([] = compliant)
  compliant: boolean;        // requiredHeaders satisfied AND no forbidden marketing header on transactional
}

const NOTIFY_PLAN = "notify.plan.compose" as CapabilityKey;
const UNSUB = ["list-unsubscribe", "list-unsubscribe-post"]; // the CAN-SPAM one-click unsubscribe pair

// Stable, recursive canonicalization → deterministic hashing regardless of key order (undefined dropped).
function canonical(v: unknown): string {
  if (v === undefined) return "null";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
  return `{${keys.map((k) => JSON.stringify(k) + ":" + canonical(o[k])).join(",")}}`;
}
function sha256(s: string): string { return createHash("sha256").update(s).digest("hex"); }

// The PURE decision. Exported so guards can prove kernel-routed === direct, byte for byte.
export function buildNotificationPlan(input: NotifyPlanInput): NotificationPlan {
  const isEmail = input.channel === "email";
  const commercial = input.commercial === true;
  const supplied = new Set(Object.keys(input.headers ?? {}).map((h) => h.toLowerCase()));

  let requiredHeaders: string[] = [];
  const headerViolations: string[] = [];
  if (isEmail && commercial) {
    requiredHeaders = ["List-Unsubscribe", "List-Unsubscribe-Post"];
    for (const h of UNSUB) if (!supplied.has(h)) headerViolations.push(`missing required header for commercial email: ${h}`);
  } else if (isEmail && !commercial) {
    // A transactional email (e.g. password reset) MUST NOT carry marketing unsubscribe headers —
    // a consumer must never be able to opt out of security-critical mail.
    for (const h of UNSUB) if (supplied.has(h)) headerViolations.push(`forbidden marketing header on transactional email: ${h}`);
  }
  // Push (and any non-email channel) is outside the CAN-SPAM email regime — no header policy.

  return {
    channel: input.channel,
    purpose: input.purpose,
    compliancePurposeClass: commercial ? "commercial" : "transactional",
    // Token-free + tenant-scoped: excludes content and any volatile token, so a RETRY of the same
    // logical event coalesces (same key) while two DISTINCT events never collide across tenants.
    idempotencyKey: sha256(canonical(["notify.plan/v1", input.channel, input.tenantId, input.purpose, input.recipientRef, input.event])),
    contentHash: sha256(canonical(input.content)),
    recipientHash: sha256(canonical([input.tenantId, input.recipientRef])),
    requiredHeaders,
    requiresPostalFooter: isEmail && commercial,
    headerViolations,
    compliant: headerViolations.length === 0,
  };
}

function isNotifyPlanInput(x: unknown): x is NotifyPlanInput {
  if (!x || typeof x !== "object") return false;
  const i = x as NotifyPlanInput;
  return (i.channel === "email" || i.channel === "push")
    && typeof i.purpose === "string" && i.purpose.length > 0
    && typeof i.commercial === "boolean"
    && typeof i.tenantId === "string" && i.tenantId.length > 0
    && typeof i.recipientRef === "string" && i.recipientRef.length > 0
    && typeof i.event === "string" && i.event.length > 0
    && !!i.content && typeof i.content === "object";
}

const bad = (summary: string): ModuleResult => ({ ok: false, receipt: { summary, evidence: [] }, confidence: { level: "insufficient", basis: "guard" } });

export function notifyModule(): KaiModule {
  return {
    id: "notify",
    name: "Kai Notify",
    trust: "first_party",
    capabilities: (): CapabilitySpec[] => [
      {
        key: NOTIFY_PLAN,
        description: "Compose a deterministic, permissioned notification PLAN (token-free idempotency key, transactional/commercial purpose class, CAN-SPAM header policy, hash-only content/recipient digests). Decision only — sends nothing.",
        version: 1,
        owner: "platform-team",
        plugin: "notify",
        premium: false,
        experimental: false,
        securityClass: "regulated",
        requiredPermissions: ["notify:plan"],
        inputSchema: "{ channel, purpose, commercial, tenantId, recipientRef, event, content, headers? }",
        outputSchema: "{ channel, purpose, compliancePurposeClass, idempotencyKey, contentHash, recipientHash, requiredHeaders, requiresPostalFooter, headerViolations, compliant }",
        compliance: { regimes: ["GLBA"], permissiblePurposes: ["notification", "transactional", "commercial"] },
        reasoning: "deterministic",
      },
    ],
    // Deterministic → synchronous, pure. Layer-2 decision: it returns a VALUE (the plan) and
    // performs NO side effect. The Layer-3 send is intentionally not reachable from here.
    execute(_ctx: OsContext, key: CapabilityKey, input: unknown): ModuleResult {
      if (key === NOTIFY_PLAN) {
        if (!isNotifyPlanInput(input)) return bad("invalid input for notify.plan.compose");
        const plan = buildNotificationPlan(input);
        return {
          ok: true,
          data: plan,
          receipt: {
            summary: `notification plan (${plan.channel}/${plan.compliancePurposeClass}) idem=${plan.idempotencyKey.slice(0, 12)}…`,
            evidence: [`purpose: ${plan.purpose}`, `compliant: ${plan.compliant}`, `requiredHeaders: ${plan.requiredHeaders.join(", ") || "none"}`],
          },
          confidence: { level: plan.compliant ? "high" : "low", basis: "deterministic notification decision (platform notify)" },
        };
      }
      return bad(`unknown capability ${key}`);
    },
  };
}
