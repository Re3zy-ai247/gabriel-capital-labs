// Run: npx --no-install tsx scripts/company-identity.test.ts
// Pins the Founder-approved legal/display split and prevents the legal postal
// identity from drifting into client configuration or duplicate product sources.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { BRAND } from "../lib/brand";
import { renderDigestEmail, sendWeeklyDigest } from "../lib/briefDigest";
import {
  COMPANY_DISPLAY_NAME,
  COMPANY_LEGAL_NAME,
  COMPANY_POSTAL_ADDRESS,
  COMPANY_POSTAL_ADDRESS_INLINE,
  COMPANY_POSTAL_ADDRESS_LINES,
} from "../lib/companyIdentity.server";

const root = resolve(__dirname, "..");
let pass = 0;
let fail = 0;

function check(label: string, condition: boolean) {
  if (condition) pass += 1;
  else {
    fail += 1;
    console.error(`FAIL: ${label}`);
  }
}

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function sourceFiles(path: string): string[] {
  const absolute = join(root, path);
  if (statSync(absolute).isFile()) return [absolute];
  return readdirSync(absolute).flatMap((entry) => {
    const child = join(absolute, entry);
    if (statSync(child).isDirectory()) return sourceFiles(child.slice(root.length + 1));
    return /\.(?:ts|tsx)$/.test(entry) ? [child] : [];
  });
}

const expectedLines = [
  "Gabriel Capital Labs, LLC",
  "30 Montgomery Street",
  "Suite 1200",
  "Jersey City, NJ 07302",
  "United States",
];

check("legal name is exact", COMPANY_LEGAL_NAME === "Gabriel Capital Labs, LLC");
check("display name is exact", COMPANY_DISPLAY_NAME === "Gabriel Capital Labs");
check("display name remains the public BRAND parent", COMPANY_DISPLAY_NAME === BRAND.parent);
check("postal lines are exact and ordered", JSON.stringify(COMPANY_POSTAL_ADDRESS_LINES) === JSON.stringify(expectedLines));
check("postal block is exact", COMPANY_POSTAL_ADDRESS === expectedLines.join("\n"));
check("inline postal identity is exact", COMPANY_POSTAL_ADDRESS_INLINE === expectedLines.join(", "));

const digest = source("lib/briefDigest.ts");
check("digest imports the canonical identity", digest.includes('from "./companyIdentity.server"'));
check("digest renders the legal multiline block", digest.includes("COMPANY_POSTAL_ADDRESS,"));
check("digest renders the legal inline block", digest.includes("escapeHtml(COMPANY_POSTAL_ADDRESS_INLINE)"));
check("digest no longer reads a competing postal env value", !digest.includes("process.env.COMPANY_POSTAL_ADDRESS"));
check("digest still fails closed if canonical postal identity is unavailable", digest.includes("!COMPANY_POSTAL_ADDRESS.trim() || !COMPANY_POSTAL_ADDRESS_INLINE.trim()"));
check("digest send stays Founder-gated behind BRIEF_DIGEST_ENABLED", digest.includes("BRIEF_DIGEST_ENABLED"));
check("digest keeps the public display byline", digest.includes("CreditVector by Gabriel Capital Labs"));

// tsx runs this script under CommonJS output here (no "type": "module" in
// package.json), where top-level await is not supported — wrap in a promise
// chain instead and defer the final tally to its `.then()` so this check's
// pass/fail is counted before the summary line prints.
delete process.env.BRIEF_DIGEST_ENABLED;
const digestGate = sendWeeklyDigest().then((gateResult) => {
  check(
    "digest send refuses with BRIEF_DIGEST_ENABLED unset (behavioral)",
    gateResult.ok === false && gateResult.sent === 0,
  );
});

const renderedDigest = renderDigestEmail(
  [{ slug: "identity-check", title: "Identity check", socialCaption: null, summary: "Static test." }],
  "https://www.creditvector.app/unsubscribe",
  "https://www.creditvector.app",
);
check("rendered digest text contains the exact legal block", renderedDigest.text.includes(COMPANY_POSTAL_ADDRESS));
check("rendered digest HTML contains the exact inline legal identity", renderedDigest.html.includes(COMPANY_POSTAL_ADDRESS_INLINE));
check("rendered digest preserves CreditVector/display-name branding", renderedDigest.text.includes("CreditVector by Gabriel Capital Labs"));

const terms = source("app/legal/terms/page.tsx");
const privacy = source("app/legal/privacy/page.tsx");
const footer = source("components/marketing/SiteFooter.tsx");
const compliance = source("lib/compliance.ts");
check("Terms consumes the canonical legal identity", terms.includes("COMPANY_LEGAL_NAME") && terms.includes("COMPANY_POSTAL_ADDRESS_LINES"));
check("Privacy consumes the canonical legal identity", privacy.includes("COMPANY_LEGAL_NAME") && privacy.includes("COMPANY_POSTAL_ADDRESS_LINES"));
check("legal copyright consumes the canonical legal name", footer.includes("© {new Date().getFullYear()} {COMPANY_LEGAL_NAME}"));
check("marketing byline still consumes BRAND", footer.includes("{BRAND.byline}"));
check("site legal disclaimer consumes the canonical legal name", compliance.includes("${COMPANY_LEGAL_NAME} platform"));

const envExample = source(".env.example");
check("postal identity is not duplicated into the environment template", !/^COMPANY_POSTAL_ADDRESS=/m.test(envExample));
check("no public company identity or address env is documented", !/NEXT_PUBLIC_COMPANY_(?:LEGAL_NAME|DISPLAY_NAME|POSTAL_ADDRESS)/.test(envExample));

const productSources = ["app", "components", "lib"].flatMap(sourceFiles);
const clientImports = productSources.filter((path) => {
  const body = readFileSync(path, "utf8");
  const isClient = /^\s*["']use client["'];/m.test(body);
  return isClient && body.includes("companyIdentity.server");
});
check("no client component imports the server identity", clientImports.length === 0);

const streetSources = productSources.filter((path) => readFileSync(path, "utf8").includes("30 Montgomery Street"));
check(
  "street address has one product-code source",
  streetSources.length === 1 && streetSources[0].endsWith("/lib/companyIdentity.server.ts"),
);

digestGate.then(() => {
  console.log(`\ncompany-identity.test.ts: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
});
