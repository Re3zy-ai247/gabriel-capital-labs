import Link from "next/link";
import { Check, Sparkles, ArrowRight } from "lucide-react";
import { FaqList } from "@/components/marketing/Showcase";

// RC1-S6b — THE CONSUMER COST PAGE.
//
// WHAT THIS FILE USED TO BE. Seven priced tier cards ($0 / $99 / $149 / $399 /
// $699 / $1,299 / Custom), a 27-row plan-comparison matrix, an interval toggle,
// a "Buy 5 letters — $19" button, and a live POST to /api/stripe/checkout. It
// was the single largest concentration of paid-consumer copy in the product.
//
// WHAT IT IS NOW. One page that answers one question — what does this cost a
// consumer — with one answer: nothing today. There is no tier to choose, so
// there are no tier cards; there is nothing to buy, so there is no checkout
// call, no price, and no Buy control anywhere in this file.
//
// THREE COPY RULES THIS FILE IS HELD TO (guarded by
// scripts/consumer-copy-sweep.test.ts):
//   1. No price point, tier name, or purchase control on a consumer surface.
//   2. No promise about the FUTURE. "Free to use today" is a statement about
//      today and is true; "free forever" is a commitment nobody authorised and
//      would be the same class of overclaim as a deletion guarantee.
//   3. The agency/business direction is described as a separate product whose
//      new signups are paused — never named as an offering, never priced, and
//      never dressed up as something a consumer could upgrade into.
//
// The file and the exported symbol keep their old names deliberately: three
// guards outside this slice read this path (see the slice report), and moving
// the file would turn a re-pin into a crash.

// Everything the consumer product does, as one flat list. No tier splits the
// list, because no tier exists. Each line describes a capability that is live
// today — nothing here is a roadmap item wearing a checkmark.
const INCLUDED: { group: string; items: string[] }[] = [
  {
    group: "Reading your reports",
    items: [
      "Upload your Equifax, Experian, and TransUnion reports and see them in one place",
      "Uploading a report never triggers a credit pull or a hard inquiry",
      "Every account read, compared across bureaus, and explained in plain English",
      "An identity check against the names, addresses, and employers on your file",
    ],
  },
  {
    group: "Disputing what you believe is inaccurate",
    items: [
      "Dispute letters built from reviewed templates and from the facts you confirm yourself",
      "You read, edit, approve, print, and mail every letter — nothing is sent for you",
      "Each letter cites the rights it relies on, so you can check the citation yourself",
      "Follow-up rounds when a bureau responds, drafted the same way",
    ],
  },
  {
    group: "Keeping track",
    items: [
      "Mission Control — the whole case on one screen",
      "A timeline of what you sent, when you sent it, and what came back",
      "A score tracker for the numbers you record yourself",
      "Academy: what the Fair Credit Reporting Act actually says, in plain English",
    ],
  },
];

const FAQ: [string, string][] = [
  [
    "What does CreditVector cost me?",
    "Nothing. The consumer product is free to use today — there is no plan to pick, no card to enter, and no paid tier held back behind what you can see. If that ever changes, it will be said plainly and in advance, not discovered at a checkout screen.",
  ],
  [
    "Is there a paid version with more features?",
    "Not for consumers. Every consumer account gets the same product; nothing is reserved for a higher tier, because there are no tiers. A separate product for agencies and businesses exists, but it is a different product with different users, and new signups for it are paused.",
  ],
  [
    "I paid for a plan before. What happened to it?",
    "Your record of it is preserved. Your billing history, your past plan, and any letter credits you bought are all still on your account and visible on your billing page, and your payment settings still open in the Stripe portal. Nothing was deleted. What changed is that none of it is needed any more — the product no longer charges consumers, so those credits are held rather than spent.",
  ],
  [
    "Does CreditVector guarantee results?",
    "No, and no one legally can. CreditVector is software and education. It helps you exercise rights you already have under the Fair Credit Reporting Act; the bureaus and furnishers decide every outcome, and information that is accurate cannot be removed by disputing it.",
  ],
  [
    "If it's free, what is the catch?",
    "You do the work. CreditVector reads your reports and drafts letters from what you confirm, but you review every letter, you sign it, and you mail it at your own cost. It does not act on your behalf, it does not contact the bureaus for you, and it is not a credit-repair organization.",
  ],
];

export function PricingTiers() {
  return (
    <>
      {/* The answer, before anything else on the page. */}
      <div className="mx-auto max-w-3xl rounded-2xl border border-brand-500/25 bg-brand-500/[0.06] p-6 text-center">
        <div className="mb-2 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-300">
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> What it costs
        </div>
        <p className="text-lg font-semibold text-white">CreditVector is free to use today.</p>
        <p className="mt-2 text-sm text-slate-300">
          There is no plan to choose and nothing to buy. Every consumer account gets the same product — the whole
          product — and no card is required to open one.
        </p>
      </div>

      {/* What "everything" actually means. */}
      <div className="mx-auto mt-14 max-w-5xl">
        <h2 className="h-display mb-2 text-center text-2xl text-white md:text-3xl">What you get</h2>
        <p className="mx-auto mb-10 max-w-2xl text-center text-sm text-slate-400">
          All of it, to every account. Nothing on this list is held back, metered, or unlocked by anything.
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {INCLUDED.map((section) => (
            <div key={section.group} className="rounded-2xl border border-ink-700/70 bg-ink-800/50 p-7">
              <h3 className="text-sm font-bold uppercase tracking-widest text-brand-300/90">{section.group}</h3>
              <ul className="mt-5 space-y-3 text-sm">
                {section.items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" strokeWidth={2.5} aria-hidden />
                    <span className="text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link href="/register" className="btn-primary btn-lg">
            Create a free account <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <p className="mt-3 text-xs text-slate-500">No card required, because there is nothing to charge it for.</p>
        </div>
      </div>

      {/* Historical payers. Stated here because this is the page they will look
          at first when they wonder what happened to the plan they bought. */}
      <div className="mx-auto mt-16 max-w-3xl rounded-2xl border border-ink-700/70 bg-ink-800/40 p-7">
        <h2 className="text-base font-semibold text-white">If you paid for a consumer plan before</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          Nothing was taken away and nothing was deleted. Your billing history and your past plan are preserved on your
          account, and any letter credits from a past purchase are preserved on your account as well. They are held as a
          record rather than spent, because the letters they used to pay for are no longer charged for. Your payment
          settings, receipts, and cancellation all still open in the Stripe billing portal from your{" "}
          <Link href="/billing" className="font-medium text-brand-300 underline underline-offset-2 hover:text-brand-200">
            billing page
          </Link>
          .
        </p>
      </div>

      {/* The business direction, stated as what it is: a different product, not
          a consumer upgrade path. No name, no price, no waitlist promise. */}
      <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-ink-700/70 bg-ink-800/40 p-7">
        <h2 className="text-base font-semibold text-white">Working with clients rather than your own file?</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          A separate product for agencies and businesses exists and is used by existing operators. It is not a consumer
          plan and it is not something a consumer account upgrades into — different product, different users. New
          signups for it are paused, so there is nothing to sign up for here and no price to quote.
        </p>
      </div>

      {/* Compliance line — unchanged in substance from the previous page. */}
      <p className="mx-auto mt-14 max-w-3xl text-center text-xs leading-relaxed text-slate-500 pretty">
        CreditVector is educational software, not a credit-repair organization, and does not provide legal advice.
        Guidance here is grounded in the Fair Credit Reporting Act; no deletion, correction, or score improvement is
        guaranteed. You review and mail your own letters and stay in control.
      </p>

      <div className="mx-auto mt-16 max-w-4xl">
        <h2 className="h-display mb-10 text-center text-2xl text-white md:text-3xl">Common questions</h2>
        <FaqList items={FAQ} />
      </div>
    </>
  );
}
