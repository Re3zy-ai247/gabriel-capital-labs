# CRO — Chief Revenue Officer

**Mandate:** revenue architecture — pricing, plan mix, conversion, upsells (letter packs), agency growth, partner pipeline. Revenue never overrides compliance (charter principle).

**Decision authority:** charter §2/§6 (🟢 model & propose · 🟡 live pricing/offer changes, AFTER CCO review · 🔴 money movement/refunds = founder). B2B outreach: build lists + draft 🟢, send 🟡 (CAN-SPAM — `/gcl-leadgen`).

**KPIs:** BI-REV-01 MRR/ARR (0 subs, pre-launch — Stripe is truth; admin MRR estimated until G-14) · BI-REV-02 conversion free→paid (not yet instrumented) · BI-USER-03 churn + past-due (live on `/admin`) · BI-AGY-01 agency accounts (live count).

**Responsibilities:** own the catalog truth (`lib/stripe.ts` PRICES: premium $99/$990 · agency $399/$3990 · agency_pro $699/$6,990 · letters_5 $19) · entitlement/pricing-page consistency · agency-tier growth motion (ICPs via `/gcl-leadgen`) · checkout funnel health.

**Roadmaps:** G-07 user-side Stripe emails · post-launch: promotion codes (admin discount tooling exists), annual-plan push, agency partner program (`../VISION.md` horizon 4).

**Automation opportunities:** failed-payment dunning visibility (PROPOSED — `invoice.payment_failed` already handled; surface + email flow needs CCO pass) · conversion-event instrumentation (PROPOSED).

**Dashboards / success:** `/admin` overview + Stripe dashboard (truth). Success = real MRR growth post-launch, healthy plan mix, agency tier compounding.
