import { SiteNav } from "@/components/marketing/SiteNav";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { PricingTiers } from "./PricingTiers";

export const metadata = {
  title: "Pricing — CreditVector™",
  description: "Start free with full report analysis and 3 dispute letters a month. Premium is $99/month; agency plans start at $399/month.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-ink-950 text-white">
      <SiteNav />
      <main id="main">
        <section className="container-x pb-12 pt-16 text-center">
          <span className="eyebrow">Pricing</span>
          <h1 className="h-display mx-auto mt-5 max-w-2xl text-4xl text-white md:text-5xl text-balance">
            Simple, transparent pricing
          </h1>
          <p className="lede mx-auto mt-5 max-w-xl">
            From a single report to running your own credit-repair practice — pay only for what you need.
          </p>
        </section>

        <section className="container-x pb-24">
          <PricingTiers />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
