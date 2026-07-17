// GIOS platform — Session & Device MECHANISM (Platform Phase B, Sprint 4).
// ─────────────────────────────────────────────────────────────────────────────
// STATUS: DORMANT behind SESSION_FOUNDATION (default OFF). ARCHITECTURE ONLY —
// NOTHING ENFORCES. Pure mechanism + types + hook interfaces; persistence lives
// product-side in lib/platform/sessionStore.ts (hexagonal ports law — no prisma
// here). NextAuth stays stateless-JWT; no auth callback consults this module
// until the CSAP-1 enforcement package is separately approved.
//
// The admission evaluator is pure and ALWAYS returns enforced:false — it exists
// so enforcement later is a one-line flip at a reviewed call site, and so the
// guard pins the decision table today. Limits come from the capability matrix
// (CONCURRENT_SESSION_LIMIT) through the tier resolver — injected by the caller;
// this file never reads plans or pricing. Enterprise's 10 is a DEFAULT: the
// `overrideLimit` argument is the per-account entitlement override mechanism
// (same mechanism as the grandfather clause), never a hardcode.
export function sessionFoundationEnabled(): boolean {
  return process.env.SESSION_FOUNDATION === "true";
}

export type DevicePlatform = "desktop" | "mobile" | "tablet" | "browser";
export const DEVICE_PLATFORMS: ReadonlySet<string> = new Set(["desktop", "mobile", "tablet", "browser"]);

export interface DeviceRecord {
  id: string;
  userId: string;
  nickname: string; // user-chosen label only — no fingerprints, no IPs, no secrets
  platform: DevicePlatform;
  trusted: boolean;
  createdAt: Date;
  lastSeenAt: Date;
}

export interface SessionRecord {
  id: string;
  userId: string;
  deviceId: string;
  createdAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
}

// ── Risk events + 2FA hook (interfaces now; providers land with CSAP-1) ─────
export type RiskEventKind = "over_limit_attempt" | "new_device" | "remote_logout" | "approval_granted" | "approval_denied";
export interface RiskEvent { kind: RiskEventKind; userId: string; deviceId?: string; at: Date }
export type RiskSink = (e: RiskEvent) => void;

export interface SecondFactorHook {
  required(userId: string, context: "over_limit" | "new_device"): boolean;
  verify(userId: string, token: string): Promise<boolean>;
}

// ── Admission evaluation (PURE — the future enforcement decision table) ──────
export interface AdmissionInput {
  activeSessions: number; // non-revoked, non-expired sessions for the user
  limit: number | null; // CONCURRENT_SESSION_LIMIT via the tier resolver; null = unlimited
  overrideLimit?: number | null; // per-account entitlement override (Enterprise mechanism)
}

export interface AdmissionDecision {
  decision: "allow" | "needs_capacity";
  enforced: false; // ARCHITECTURE ONLY — becomes real in CSAP-1 at a reviewed call site
  effectiveLimit: number | null;
  wouldExceed: boolean;
}

export function evaluateSessionAdmission(input: AdmissionInput): AdmissionDecision {
  const effectiveLimit = input.overrideLimit !== undefined ? input.overrideLimit : input.limit;
  const wouldExceed = effectiveLimit !== null && input.activeSessions >= effectiveLimit;
  return {
    decision: wouldExceed ? "needs_capacity" : "allow",
    enforced: false,
    effectiveLimit,
    wouldExceed,
  };
}
