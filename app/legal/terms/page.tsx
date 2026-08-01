import { LegalShell } from "@/components/marketing/LegalShell";
import {
  COMPANY_LEGAL_NAME,
  COMPANY_POSTAL_ADDRESS_LINES,
} from "@/lib/companyIdentity.server";

export const metadata = {
  title: "Terms — CreditVector™",
  description: "The terms that govern your use of CreditVector.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="August 1, 2026">
      <section>
        <h2>What CreditVector is</h2>
        <p>
          CreditVector is software and educational tooling that helps you understand your credit reports and prepare
          your own disputes. It is not a credit-repair organization, a law firm, or a substitute for legal or financial
          advice. You review, sign, and mail your own letters and stay in control throughout.
        </p>
      </section>

      <section>
        <h2>No guaranteed outcomes</h2>
        <p>
          You have the right under the Fair Credit Reporting Act to dispute information you believe is inaccurate.
          CreditVector helps you exercise that right — it cannot and does not promise that any item will be removed or
          changed, or that any credit score will improve. Accurate information cannot be removed by disputing it. Every
          outcome is decided by the credit bureaus and furnishers, not by us.
        </p>
      </section>

      <section>
        <h2>Your responsibilities</h2>
        <ul>
          <li>Provide accurate information and use the service only for your own credit (or, for agencies, clients you are authorized to represent).</li>
          <li>Review every letter before sending it, and only dispute information you have a good-faith basis to believe is inaccurate.</li>
          <li>Keep your login credentials secure.</li>
        </ul>
      </section>

      <section>
        <h2>Billing and cancellation</h2>
        <p>
          Paid plans are billed through Stripe on the interval you select. You can cancel anytime from your billing
          settings; access continues until the end of the current billing period. One-time letter-pack credits do not
          expire and carry over month to month.
        </p>
      </section>

      <section>
        <h2>Service availability</h2>
        <p>
          The service is provided on an &ldquo;as is&rdquo; basis. We work to keep it reliable and accurate, but we do not
          warrant uninterrupted availability or that every analysis will be error-free. Please verify important details
          against your official credit reports.
        </p>
      </section>

      <section>
        <h2>Company identity</h2>
        <p>CreditVector is operated by {COMPANY_LEGAL_NAME}.</p>
        <address className="mt-3 text-sm not-italic leading-relaxed text-slate-400">
          {COMPANY_POSTAL_ADDRESS_LINES.map((line) => (
            <span key={line} className="block">{line}</span>
          ))}
        </address>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          We may update these terms as the product evolves and will revise the date above when we do. Questions? Reach us
          through <a href="/support">in-app support</a>.
        </p>
      </section>
    </LegalShell>
  );
}
