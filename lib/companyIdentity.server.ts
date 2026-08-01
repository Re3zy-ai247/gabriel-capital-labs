import { BRAND } from "./brand";

// Canonical legal identity for server-rendered legal, compliance, and
// transactional surfaces. Keep public product/company branding in lib/brand.ts;
// never import this module from a client component or expose it through NEXT_PUBLIC_*.
export const COMPANY_LEGAL_NAME = "Gabriel Capital Labs, LLC";
export const COMPANY_DISPLAY_NAME = BRAND.parent;

const COMPANY_POSTAL_DELIVERY_LINES = [
  "30 Montgomery St.",
  "Suite 1200",
  "Jersey City, NJ 07302",
] as const;

export const COMPANY_POSTAL_ADDRESS_LINES = [
  COMPANY_LEGAL_NAME,
  ...COMPANY_POSTAL_DELIVERY_LINES,
] as const;

export const COMPANY_POSTAL_ADDRESS = COMPANY_POSTAL_ADDRESS_LINES.join("\n");
export const COMPANY_POSTAL_ADDRESS_INLINE = COMPANY_POSTAL_ADDRESS_LINES.join(", ");
