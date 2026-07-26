// Operator Identity — canonical serialization + decision digest.
//
// Extracted in Slice 3 so Identity, Enrollment and Organizations share ONE implementation
// (§17: one owner per capability — a second copy would be a parallel implementation) and
// so `lib/identity/organizations.ts` can supply the owner-control resolver back to
// `lifecycle.ts` without an import cycle. lifecycle.ts re-exports both symbols, so every
// pre-existing importer is unchanged.
//
// §10.4 requires byte-identical canonical evidence on replay. `canonicalJson` fixes key
// order and rejects anything non-deterministic, so a digest is a stable function of the
// sealed inputs alone.
import { createHash } from "node:crypto";

export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "string") return JSON.stringify(value);
  if (t === "boolean") return String(value);
  if (t === "number") {
    if (!Number.isFinite(value as number)) throw new Error("non-finite number is not canonical");
    if (!Number.isInteger(value as number)) throw new Error("non-integer number is not canonical");
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (t === "object") {
    const rec = value as Record<string, unknown>;
    const keys = Object.keys(rec).filter((k) => rec[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(rec[k])}`).join(",")}}`;
  }
  throw new Error(`value of type ${t} is not canonical`);
}

// `sha256:` prefixed so the digest can never begin with a digit run. The Event Fabric PII
// value scan rejects a bare 13-19 digit run; the prefix makes a false positive impossible
// rather than merely improbable, keeping this path deterministic.
export function decisionDigest(sealed: Record<string, unknown>): string {
  return `sha256:${createHash("sha256").update(canonicalJson(sealed)).digest("hex")}`;
}
