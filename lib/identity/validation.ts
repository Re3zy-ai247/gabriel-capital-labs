// Operator Identity — input validation (Sprint 9).
//
// PURE, fail-closed. All operator/org/membership inputs are validated here with zod
// (already a dependency) BEFORE the runtime touches the database. Slugs and handles
// are the only user-chosen public-ish identifiers in the foundation; they are strictly
// bounded (charset, length) and screened against a reserved list so an operator cannot
// claim `admin`, `creditvector`, an org's own reserved words, etc. (an impersonation /
// confusion vector called out in OPERATOR-IDENTITY.md §5b).
import { z } from "zod";
import { ORG_ROLES } from "./rbac";

// Words that cannot be claimed as a slug or handle — platform routes, brand terms,
// and role words. Fail-closed: reserved => rejected.
export const RESERVED_IDENTIFIERS: ReadonlySet<string> = new Set([
  "admin", "administrator", "root", "system", "support", "billing", "help", "api",
  "www", "app", "mail", "login", "logout", "register", "settings", "account",
  "creditvector", "gabriel", "gabrielcapitallabs", "kai", "arena", "network",
  "community", "agency", "operator", "operators", "org", "orgs", "organization",
  "identity", "owner", "member", "moderator", "staff", "official", "verified",
]);

// slug: 3–40 chars, lowercase alphanumeric with single internal hyphens.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// handle: 3–30 chars, lowercase alphanumeric with single internal hyphen/underscore.
const HANDLE_RE = /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/;

export const slugSchema = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(SLUG_RE, "slug must be lowercase alphanumeric with single internal hyphens")
  .refine((s) => !RESERVED_IDENTIFIERS.has(s), "slug is reserved");

export const handleSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(HANDLE_RE, "handle must be lowercase alphanumeric with single internal separators")
  .refine((s) => !RESERVED_IDENTIFIERS.has(s), "handle is reserved");

// Derive a candidate slug from a free-text name. May yield an invalid (too short /
// reserved) result — always re-validate with slugSchema before use.
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export const createOrganizationInput = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: slugSchema.optional(), // derived from name when omitted
    kind: z.literal("AGENCY").optional(),
  })
  .strict();
export type CreateOrganizationInput = z.infer<typeof createOrganizationInput>;

export const addMembershipInput = z
  .object({
    organizationId: z.string().min(1).max(64),
    operatorId: z.string().min(1).max(64),
    role: z.enum(ORG_ROLES).default("MEMBER"),
  })
  .strict();
export type AddMembershipInput = z.infer<typeof addMembershipInput>;

export const changeRoleInput = z
  .object({
    organizationId: z.string().min(1).max(64),
    operatorId: z.string().min(1).max(64),
    role: z.enum(ORG_ROLES),
  })
  .strict();
export type ChangeRoleInput = z.infer<typeof changeRoleInput>;

export const claimHandleInput = z.object({ handle: handleSchema }).strict();

// A short, bounded lifecycle reason code (never free-form PII). Optional.
export const stateReasonSchema = z.string().trim().min(1).max(60).optional();
