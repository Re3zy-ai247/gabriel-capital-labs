// Platform Event Bus — validation (Sprint 8). FAIL-CLOSED on every uncertain input.
//
// Two layers, both must pass before an event is ever persisted or fanned out:
//   1. Contract: the (type, version) must be a registered contract and the payload
//      must satisfy its strict zod schema. Unknown type, unknown version, extra keys,
//      or a shape mismatch => REJECTED (never coerced, never a partial persist).
//   2. Structural PII guard: no payload KEY may name a value-bearing PII field, AND no
//      free-text VALUE may match a high-confidence PII pattern (email / SSN / card /
//      long digit run). The event log is a refs-only coordination spine; details live in
//      the owning table behind that table's own authorization. Both checks run on top of
//      the schema so a future contract that adds a PII field — or a producer that smuggles
//      an email into SYSTEM_EVENT.detail or a changedFields entry — is caught here (and by
//      the registry test), not discovered in the durable full-payload log. The value scan
//      is high-confidence-only (it cannot catch a bare name/street); the refs-only
//      discipline in contracts.ts remains the primary defense.
import { getContract } from "./contracts";

// Substrings that name a value-bearing PII / free-text field. Matched case-insensitively
// against payload keys. Deliberately broad: the log carries refs, not values. `*Id`,
// `changedFields` (field NAMES), enums, counts, and booleans are fine; anything that
// would carry an email, address, balance, name, or document/body text is not.
export const PII_DENYLIST: readonly string[] = [
  "email", "ssn", "socialsecurity", "phone", "address", "street", "city", "zip", "postal",
  "dob", "birth", "name", "balance", "amount", "account_number", "accountnumber", "card",
  "body", "content", "text", "message", "note", "reason", "summary", "raw", "html",
  "password", "secret", "token", "insighttext", "letterbody", "recipientemail",
];

function keyIsPII(key: string): boolean {
  const k = key.toLowerCase();
  // `detail` (SYSTEM_EVENT, admin-only, bounded) and `*Id`/`ref` keys are allowed; a key
  // is PII only if it CONTAINS a denylisted token. `detail` contains none of them.
  return PII_DENYLIST.some((bad) => k.includes(bad));
}

// High-confidence value-bearing PII patterns. Deliberately conservative (no false
// positives on ids/enums): an email, an SSN (xxx-xx-xxxx or 9 bare digits), a 13-19 digit
// run (card/account), or a formatted phone. It cannot catch a bare name or street — that
// is why contracts.ts keeps payloads refs-only; this is the backstop, not the fence.
const PII_VALUE_PATTERNS: readonly RegExp[] = [
  /[^\s@]+@[^\s@]+\.[^\s@]+/,          // email
  /\b\d{3}-\d{2}-\d{4}\b/,             // SSN formatted
  /\b\d{13,19}\b/,                     // card / long account number
  /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/,   // phone
];
function valueIsPII(s: string): boolean {
  return PII_VALUE_PATTERNS.some((re) => re.test(s));
}

// Recursively assert no PII-named KEY and no PII-valued string anywhere in the payload.
export function assertNoPII(value: unknown, path = ""): { ok: true } | { ok: false; badKey: string } {
  if (typeof value === "string") return valueIsPII(value) ? { ok: false, badKey: `${path || "(root)"} (value)` } : { ok: true };
  if (value === null || typeof value !== "object") return { ok: true };
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const r = assertNoPII(value[i], `${path}[${i}]`);
      if (!r.ok) return r;
    }
    return { ok: true };
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (keyIsPII(k)) return { ok: false, badKey: path ? `${path}.${k}` : k };
    const r = assertNoPII(v, path ? `${path}.${k}` : k);
    if (!r.ok) return r;
  }
  return { ok: true };
}

export type ValidationResult =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; error: string };

// Validate an event's (type, version, payload). Fail-closed.
export function validateEvent(type: string, version: number, payload: unknown): ValidationResult {
  const contract = getContract(type, version);
  if (!contract) return { ok: false, error: `unknown event contract: ${type}@${version}` };

  const parsed = contract.schema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: `payload failed ${type}@${version} schema: ${parsed.error.issues[0]?.message ?? "invalid"}` };

  const pii = assertNoPII(parsed.data);
  if (!pii.ok) return { ok: false, error: `payload carries a PII-named field: ${pii.badKey}` };

  return { ok: true, payload: parsed.data as Record<string, unknown> };
}
