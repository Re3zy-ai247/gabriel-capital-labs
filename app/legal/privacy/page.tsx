import { LegalShell } from "@/components/marketing/LegalShell";

export const metadata = {
  title: "Privacy — CreditVector™",
  description: "How CreditVector collects, protects, and uses your information.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy" updated="June 18, 2026">
      <section>
        <p>
          CreditVector helps you understand your credit reports and prepare disputes. Because that means handling
          sensitive financial information, we keep what we collect to what the product needs and protect it accordingly.
        </p>
      </section>

      <section>
        <h2>Information we collect</h2>
        <ul>
          <li>Account details you provide — your name, email, and password (stored only as a one-way hash).</li>
          <li>Credit report content you upload or paste, and any documents or attachments you add to disputes and support tickets.</li>
          <li>Support messages you send us.</li>
          <li>Activity on the product — such as articles you save or like, and comments you post in CreditVector Brief (which appear publicly under your username or first name) — so we can show your saved list, your comments, and how many readers found an article useful.</li>
          <li>Billing is handled by Stripe. We never see or store your full card number.</li>
        </ul>
      </section>

      <section>
        <h2>How we protect it</h2>
        <p>
          Uploaded reports, documents, and attachments are encrypted at rest with AES-256 and are only ever served back
          to you over an authenticated, access-checked connection — never from a public link. Access is scoped to your
          account (and, for agency-managed clients, to the agency that manages them).
        </p>
      </section>

      <section>
        <h2>How we use it</h2>
        <p>
          We use your information to analyze your reports, generate dispute letters, operate your account, and provide
          support. To extract and analyze report content, text is processed by our AI provider solely to produce your
          results. We do not sell your personal information, and we do not use your credit data for advertising.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <ul>
          <li>Delete an uploaded report at any time — its analyzed accounts are removed with it.</li>
          <li>Update your account email and password from Settings.</li>
          <li>Cancel your subscription whenever you like; access continues to the end of the billing period.</li>
          <li>Request deletion of your account by contacting support.</li>
        </ul>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          For any privacy question or request, reach us through <a href="/support">in-app support</a> and we&apos;ll respond promptly.
        </p>
      </section>
    </LegalShell>
  );
}
