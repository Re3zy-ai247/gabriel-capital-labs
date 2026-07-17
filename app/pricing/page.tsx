import { SiteNav } from "@/components/marketing/SiteNav";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { TrustBar } from "@/components/marketing/Showcase";
import { PricingTiers } from "./PricingTiers";

export const metadata = {
  title: "Pricing — CreditVector™ Credit Intelligence Operating System",
  description: "You're not buying dispute letters — you're hiring Kai, your Credit Intelligence Officer. Start free; upgrade for more intelligence. Explorer, Professional, and Agency are live today.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-ink-950 text-white">
      <SiteNav />
      <main id="main">
        <section className="container-x pb-10 pt-16 text-center">
          <span className="eyebrow">The Credit Intelligence Operating System</span>
          <h1 className="h-display mx-auto mt-5 max-w-3xl text-4xl text-white md:text-5xl text-balance">
            You&apos;re not buying dispute letters.
            <br />
            <span className="text-gradient">You&apos;re hiring Kai.</span>
          </h1>
          <p className="lede mx-auto mt-5 max-w-2xl">
            Kai — your Credit Intelligence Officer — reads your reports, finds what can be lawfully disputed,
            drafts compliant letters, tracks every deadline, and guides your whole credit journey. Everyone gets Kai.
            Your plan decides how capable Kai becomes.
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
