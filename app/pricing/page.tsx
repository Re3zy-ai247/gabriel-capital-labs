import { SiteNav } from "@/components/marketing/SiteNav";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { PricingTiers } from "./PricingTiers";

export const metadata = {
  title: "Pricing — CreditVector™ AI Credit Intelligence OS",
  description: "You're not buying dispute letters — you're hiring Kai, your Credit Intelligence Officer. Start free; upgrade for more intelligence. Explorer, Professional, and Agency are live today.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-ink-950 text-white">
      <SiteNav />
      <main id="main">
        <section className="container-x pb-10 pt-16 text-center">
          <span className="eyebrow">The AI Credit Intelligence Operating System</span>
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
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
