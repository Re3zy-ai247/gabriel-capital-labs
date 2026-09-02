import { SiteNav } from "@/components/marketing/SiteNav";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { TrustBar } from "@/components/marketing/Showcase";
import { PricingTiers } from "./PricingTiers";

// RC1-S6b. The old metadata sold plans ("upgrade for more intelligence.
// Explorer, Professional, and Agency are live today") and the old H1 framed the
// product as a hire whose capability was bought ("Your plan decides how capable
// Kai becomes"). Both described a consumer product that no longer exists. The
// route keeps its /pricing path — it is linked from the nav, the sitemap, and a
// walkthrough guard, and "what does this cost me" is still the question people
// arrive with. Only the answer changed.
export const metadata = {
  title: "What CreditVector costs — free for consumers",
  description:
    "CreditVector's consumer product is free to use today. No plan to choose, no card required, and nothing held back behind a paid tier.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-ink-950 text-white">
      <SiteNav />
      <main id="main">
        <section className="container-x pb-10 pt-16 text-center">
          <span className="eyebrow">What it costs</span>
          <h1 className="h-display mx-auto mt-5 max-w-3xl text-4xl text-white md:text-5xl text-balance">
            CreditVector is
            <br />
            <span className="text-gradient">free to use today.</span>
          </h1>
          <p className="lede mx-auto mt-5 max-w-2xl">
            The consumer product reads your reports, explains what is on them, and drafts the dispute letters you
            review and mail yourself. All of it, to every account, at no cost — and no card is required to start.
          </p>
        </section>

        <section className="container-x pb-24">
          <PricingTiers />
          {/* Trust band — same honest signals as the landing page; no fabricated traction */}
          <div className="mx-auto mt-16 max-w-6xl">
            <TrustBar />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
