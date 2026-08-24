import { LegalShell } from "@/components/marketing/LegalShell";

export const metadata = {
  title: "Privacy — CreditVector™",
  description: "How CreditVector collects, protects, and uses your information.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy" updated="August 23, 2026">
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
          <li>
            Credit scores you record in the Score Tracker. These are numbers you type in yourself — we do not pull them
            from a bureau and we do not verify them.
          </li>
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
          support. We do not sell your personal information, and we do not use your credit data for advertising.
        </p>
      </section>

      {/* RC1-S8 (E-15/E-16, Founder decision D-9). The old single sentence said
          only that "text is processed by our AI provider". It named no provider,
          disclosed no redaction, and did not mention that government-ID images
          were being transmitted at all. This section states what actually leaves
          the system today — and makes no claim about the provider's own training
          or retention practices, which we cannot verify for you here. */}
      <section>
        <h2>What we send to our AI provider</h2>
        <p>
          Reading a credit report and drafting a letter are done with an AI model run by Anthropic, our AI provider. What
          is sent, and only for that purpose:
        </p>
        <ul>
          <li>The text of the credit report you uploaded or pasted, when it is read and when the identity check runs.</li>
          <li>
            The identity details you typed into Settings — your name and mailing address — when you run the identity
            check, and again if you ask for a personal-information correction letter.
          </li>
          <li>
            The account details from your report — creditor, status, balance and dates — when you ask for an action plan.
          </li>
          <li>
            When you log a bureau&apos;s response: the reply you paste in, <strong>together with the dispute letter it
            replies to</strong>, so the next round can be prepared from what they actually wrote. That letter carries the
            full name and mailing address printed on it, along with the creditor and the masked account number.
          </li>
          <li>The text of a community question you ask Kai, where the community is switched on.</li>
        </ul>
        <p>What is not sent:</p>
        <ul>
          <li>
            Images of a government-issued ID. If you upload a driver&apos;s licence or other ID document it is stored
            encrypted for your own reference and is <strong>not</strong> transmitted to our AI provider, and no date of
            birth is read from it.
          </li>
          <li>Your password, which we never hold in a readable form at all.</li>
          <li>Your card details, which only Stripe ever sees.</li>
        </ul>
        <p>
          Before credit-report text is sent — on every path that sends it — we mask Social Security numbers that we
          can recognize in it. That masking is pattern-based: it reduces what is transmitted, and we cannot promise it
          catches every instance. A credit report can also contain your date of birth, address history and employers,
          and where those appear in the report text they are sent with it. If that matters to you, remove them from what
          you paste before you upload.
        </p>
        <p>
          That masking covers credit-report text and nothing else. A dispute letter and a bureau reply you paste in are
          sent exactly as they stand — we do not strip the sender block from your own letter before it is analyzed — so
          treat anything written in them as something that will be transmitted.
        </p>
      </section>

      {/* RC1-S8 (P1-34 / Founder decision D-11). The previous version of this
          list promised "Request deletion of your account by contacting support."
          No account-deletion path exists, and one is deliberately barred while
          the retention and evidence policy is unwritten
          (scripts/consumer-deletion-containment.test.ts). Promising a right the
          product cannot execute is worse than saying plainly what it can do. */}
      <section>
        <h2>Your choices</h2>
        <p>What you can do yourself today, from inside the product:</p>
        <ul>
          <li>
            Delete an uploaded report at any time — its analyzed accounts are removed with it. Letters you already
            generated are kept, so your dispute history survives; those letters still contain the name, address and
            account details that were on them when you generated them.
          </li>
          <li>Delete a document or attachment you uploaded, including a government-ID image.</li>
          <li>Update your account email and password from Settings.</li>
          {/* RC1-S6b: "Cancel your subscription whenever you like" listed a
              control most readers of this page do not have — the consumer
              product has no subscription. Restated so it is true for both
              readers: nothing to cancel if you never paid, and the full portal
              if you did. Only this line changed; the rest is S8's text. */}
          <li>
            If you have a subscription from before — the consumer product does not have one — view receipts, update
            your payment method, or cancel it from the Stripe billing portal on your billing page; access continues to
            the end of the billing period.
          </li>
        </ul>
        <p>
          What we cannot do yet: there is no self-service way to delete your whole account or to export everything we
          hold, and we are not going to pretend otherwise. Tooling for both is planned and is not built. In the meantime,
          contact support with what you want removed and we will tell you honestly what we can do about it and when.
        </p>
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
