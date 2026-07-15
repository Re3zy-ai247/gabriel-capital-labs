// Capability namespace grammar (Sprint 1). `domain.entity.action[@major]`.
// The kernel owns the grammar + routing-by-domain; the catalog is registered by plugins.
import type { CapabilityKey } from "./types";

export interface ParsedKey { domain: string; entity: string; action: string; major: number }

const SEGMENT = /^[a-z][a-z0-9_]*$/; // lowercase, starts with a letter

// Parse & validate. Returns null on any malformed key (fail-closed — no guessing).
export function parseKey(raw: string): ParsedKey | null {
  const [path, ver] = raw.split("@");
  const major = ver === undefined ? 1 : Number(ver);
  if (!Number.isInteger(major) || major < 1) return null;
  const parts = path.split(".");
  if (parts.length !== 3) return null;
  if (!parts.every((p) => SEGMENT.test(p))) return null;
  return { domain: parts[0], entity: parts[1], action: parts[2], major };
}

export function formatKey(p: ParsedKey): CapabilityKey {
  return `${p.domain}.${p.entity}.${p.action}${p.major === 1 ? "" : `@${p.major}`}` as CapabilityKey;
}

export function isValidKey(raw: string): raw is CapabilityKey {
  return parseKey(raw) !== null;
}

// The domain a key belongs to — how the registry routes resolution/dispatch to a module.
export function domainOf(raw: string): string | null {
  return parseKey(raw)?.domain ?? null;
}
