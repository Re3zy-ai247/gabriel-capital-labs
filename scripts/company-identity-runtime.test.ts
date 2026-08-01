// Run: npx --no-install tsx scripts/company-identity-runtime.test.ts
// Executes the public legal page components and email renderer so source-level
// assertions cannot mask a missing legal identity in the rendered output.
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PrivacyPage from "../app/legal/privacy/page";
import TermsPage from "../app/legal/terms/page";
import { SiteFooter } from "../components/marketing/SiteFooter";
import { renderDigestEmail } from "../lib/briefDigest";
import {
  COMPANY_LEGAL_NAME,
  COMPANY_POSTAL_ADDRESS,
  COMPANY_POSTAL_ADDRESS_INLINE,
  COMPANY_POSTAL_ADDRESS_LINES,
} from "../lib/companyIdentity.server";

let pass = 0;
let fail = 0;

// Next's build uses the automatic JSX runtime. The standalone tsx guard uses the
// repository's preserved JSX setting, so provide React exactly for this renderer.
(globalThis as typeof globalThis & { React: typeof React }).React = React;

function check(label: string, condition: boolean) {
  if (condition) pass += 1;
  else {
    fail += 1;
    console.error(`FAIL: ${label}`);
  }
}

const termsHtml = renderToStaticMarkup(TermsPage());
const privacyHtml = renderToStaticMarkup(PrivacyPage());
const footerHtml = renderToStaticMarkup(SiteFooter());

for (const line of COMPANY_POSTAL_ADDRESS_LINES) {
  check(`Terms renders postal line: ${line}`, termsHtml.includes(line));
  check(`Privacy renders postal line: ${line}`, privacyHtml.includes(line));
}

check("Terms renders current revision date", termsHtml.includes("Last updated August 1, 2026"));
check("Privacy renders current revision date", privacyHtml.includes("Last updated August 1, 2026"));
check("Terms renders semantic company-identity heading", termsHtml.includes("Company identity"));
check("Terms renders an address element", termsHtml.includes("<address"));
check("Privacy renders an address element", privacyHtml.includes("<address"));
check("legal footer renders the LLC name", footerHtml.includes(COMPANY_LEGAL_NAME));
check("ordinary footer does not expose the street address", !footerHtml.includes("30 Montgomery St."));
check("ordinary footer preserves display branding", footerHtml.includes("by Gabriel Capital Labs"));

const digest = renderDigestEmail(
  [{ slug: "identity-check", title: "Identity check", socialCaption: null, summary: "Static test." }],
  "https://www.creditvector.app/unsubscribe",
  "https://www.creditvector.app",
);
check("digest text renders multiline legal identity", digest.text.includes(COMPANY_POSTAL_ADDRESS));
check("digest HTML renders inline legal identity", digest.html.includes(COMPANY_POSTAL_ADDRESS_INLINE));
check("digest retains unsubscribe copy", digest.text.includes("Unsubscribe:"));
check("digest retains educational disclaimer", digest.text.includes("does not constitute legal advice"));

console.log(`\ncompany-identity-runtime.test.ts: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
