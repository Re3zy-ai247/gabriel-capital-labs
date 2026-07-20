// Platform Event Bus — validation (Sprint 8). FAIL-CLOSED on every uncertain input.
//
// Two layers, both must pass before an event is ever persisted or fanned out:
//   1. Contract: the (type, version) must be a registered contract and the payload
//      must satisfy its strict zod schema. Unknown type, unknown version, extra keys,
//      or a shape mismatch => REJECTED (never coerced, never a partial persist).
//   2. Structural PII guard: no payload key may be a value-bearing / free-text PII
//      carrier. The event log is a refs-only coordination spine; details live in the
//      owning table behind that table's own authorization. This runs on top of the
//      schema so a future contract that adds a PII field is caught here AND by the
//      registry test, not discovered in production.
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

// Recursively assert no PII-named key anywhere in the payload (objects + arrays).
export function assertNoPII(value: unknown, path = ""): { ok: true } | { ok: false; badKey: string } {
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
