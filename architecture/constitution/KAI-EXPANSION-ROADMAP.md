# Kai Expansion Roadmap · v1 *(FROZEN 2026-07-17)*

*How the operating domain grows without ever changing Kai. Derives from Constitution Article I + V,
Brand Architecture §5, KAI-IDENTITY-SPECIFICATION §35. Amend by ADR only. This is architecture, not a
build schedule — no domain here is committed or dated.*

---

## 1. The invariant and the variable
**Kai never changes. Only the operating domain changes.**

| Invariant (frozen across all domains) | Variable (per domain) |
|---|---|
| The hierarchy pattern (`… → The \<Domain\> Operating System → powered by Kai → Kai, Chief Intelligence Officer`) | the domain name |
| The Five Laws | the domain's data sources & engines |
| Kai's identity, voice, trust & decision models | the domain's evidence set |
| The four-layer decision object; evidence-strength; calm | the domain's regulatory clearance |
| Reuse-first, evidence-first, deterministic, fail-closed | the domain-specific readiness indicators |

The pattern generalizes **for evidence-organizing domains**: today the **Credit** Operating System;
tomorrow each admissible domain is a `<Domain>` **Operating System**, still powered by the same Chief
Intelligence Officer. **The officer is constant; only the room changes.** It does **not** generalize
to every domain: a domain whose core utility requires giving advice, predicting an outcome, or making
a regulated decision is *excluded by §2* and may never be admitted — no matter how adjacent it looks.

## 2. The Domain Admission Rule *(the gate every new domain must pass)*
A new operating domain ships only when **all** of the following hold — this is the constitutional
checklist, and any "no" blocks the domain:

1. **Evidence basis exists.** The domain has real documentary data Kai can possess and cite —
   otherwise there is nothing to organize honestly (Law II, Law V).
2. **Regulatory clearance obtained.** The domain's specific regime (SEC/fiduciary, state insurance,
   ECOA/lending, legal/estate, etc.) is cleared by counsel for the *exact* behavior shipped.
3. **No-advice, no-decision posture confirmed.** Kai organizes evidence and states readiness; it
   never gives personalized financial/investment/legal advice and never makes a lending, hiring,
   insurance, or eligibility *decision* (Identity §30).
4. **Identity inherited unchanged.** The domain adopts this specification verbatim — same voice,
   trust, decision, notification laws. No domain gets a special persona.
5. **Positioning discipline held.** Present tense stays scoped to what actually ships; the broader
   "Financial Operating System" remains vision-tense until the product genuinely spans the domain
   *and* counsel clears the broader claim (Brand Architecture §4).
6. **Reuse-first.** The domain extends the existing readiness/roadmap/reasoning engines where it can;
   new architecture is earned only against verified absence.

## 3. The future domains *(illustrative; each subject to §2)*
Ordered by adjacency to today's credit evidence and by regulatory weight — **not a commitment.**

**Near — credit-adjacent, evidence largely held today, lighter regime:**
- **Lending** (readiness/obstacles a lender sees — never an approval or an amount).
- **Real Estate** (mortgage-readiness of the file — never an approval or affordability).
- **Business** (business-credit organization; personal-guarantee slice grounded, entity data gated).
- **Personal Finance** (credit-file health; true budgeting/income is out of scope until data + posture exist).

**Mid — new data + a real regulatory regime:**
- **Insurance** (the credit slice an insurer may consider — never a score, never a premium claim;
  counsel-gated, because credit-insurance factors border on computing an insurance score).
- **Retirement** (organizing readiness signals — never investment advice; fiduciary line respected).

**Far — candidate-conditional; heavy regime, mostly outside credit evidence, may never be admitted:**
- **Wealth · Trading · Estate Planning** (SEC/fiduciary/legal territory). Admissible **only if** a
  genuinely useful *evidence-organizing* product exists that never advises, predicts, or transacts —
  which may not be possible for these domains, since their core utility often *is* advice or a trade.
  Absent that, they remain vision-tense only, and Kai defers to licensed professionals. Do **not**
  treat them as a committed "tomorrow" sequence.
- **Enterprise Operations** (a B2B operating surface for firms; a distinct product line, same
  officer, its own admission review).

*Explicitly not admitted on adjacency alone:* any domain where Kai would have to advise, predict an
outcome, or make a regulated decision to be useful is **not** a Kai domain until §2 is satisfiable
without violating a Law.

## 4. What expansion never does
- Never rebrands Kai or forks the persona per domain.
- Never lets a new domain relax a Law "because that market expects it."
- Never ships a domain on vision-tense positioning (present tense stays honest).
- Never crosses from *organizing evidence* into *advising* or *deciding*, in any domain.
- Never claims the broader "Financial Operating System" as a present-tense capability before it's
  true and cleared.

## 5. Why architect this now
Freezing the invariant now means a decade of domains can be added as **ADRs against this
constitution** rather than rebuilds. The identity was deliberately built larger than the product so
that growth is *admission of a new room*, never *reconstruction of the officer*. That is the entire
point of the freeze.

---

*Frozen v1, 2026-07-17. New domains enter by ADR that passes the Domain Admission Rule (§2).*
