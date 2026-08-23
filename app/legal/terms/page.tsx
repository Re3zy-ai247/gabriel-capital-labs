import { LegalShell } from "@/components/marketing/LegalShell";

export const metadata = {
  title: "Terms — CreditVector™",
  description: "The terms that govern your use of CreditVector.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="August 23, 2026">
      <section>
        <h2>What CreditVector is</h2>
        <p>
          CreditVector is software and educational tooling that helps you understand your credit reports and prepare
          your own disputes. It is not a credit-repair organization, a law firm, or a substitute for legal or financial
          advice. You review, sign, and mail your own letters and stay in control throughout.
        </p>
      </section>

      {/* RC1-S8 (D-02/D-03, interim factual text — Founder decision D-9). These
          two sections state capabilities the product actually has today. They
          make no legal characterization and carry no counsel sign-off: counsel
          replaces this wording later, not the behaviour it describes. */}
      <section>
        <h2>How your letters are written</h2>
        <p>
          Your dispute letters are drafted by software, including an AI model, from a template and from the facts you
          confirm about your own accounts. CreditVector does not know what is true about your credit — you do. Nothing is
          asserted on your behalf that you have not confirmed, every letter is yours to read before it goes anywhere, and
          you are the one who signs and mails it. Check every letter against your own copy of your report before you send
          it, and only dispute information you have a good-faith basis to believe is inaccurate.
        </p>
      </section>

      <section>
        <h2>What the product cannot verify</h2>
        <ul>
          <li>
            Report reading is automated and imperfect. It can miss an account, misread a value, or misclassify one, and
            it only ever sees the report you gave it. Treat what you see here as a starting point, not a complete or
            authoritative copy of your file.
          </li>
          <li>
            Scores in the Score Tracker are the ones you type in yourself. CreditVector does not pull, verify, or
            bureau-confirm any score, and a change between two entries you recorded is not evidence that CreditVector or
            a dispute caused it.
          </li>
        </ul>
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
        <h2>Third-party services we use</h2>
        <p>
          To read your report and draft your letters, CreditVector sends report text and the identity details you type to
          Anthropic, our AI provider. Payments are handled by Stripe. Our <a href="/legal/privacy">Privacy Policy</a> sets
          out exactly what is sent, what is not, and what we do to reduce it.
        </p>
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
        <h2>Changes and contact</h2>
        <p>
          We may update these terms as the product evolves and will revise the date above when we do. Questions? Reach us
          through <a href="/support">in-app support</a>.
        </p>
      </section>
    </LegalShell>
  );
}
