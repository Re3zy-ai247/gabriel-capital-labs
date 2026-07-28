# B-05 — Prohibited-Claim Control: Decision Table for Counsel

**Product:** CreditVector™ (Gabriel Capital Labs) — consumer-credit **education** software.
**Subject:** the automated phrase control that screens every AI-generated dispute letter,
every AI assistant ("Kai") answer, every editorial Brief, and every member-authored
community post before it is saved or shown.
**Prepared:** 2026-07-28, RC1 Wave 2. **Status of item B-05: PARTIAL — it stays PARTIAL
until counsel sets the standard.** Nothing below is a legal conclusion, and passing this
control does **not** establish CROA, FCRA, FTC Act/UDAAP, or state-law compliance.

---

## 1. What the control is, in one paragraph

It is a deterministic list of phrase patterns. When text matches a pattern, two things
happen depending on the surface:

| Surface | Effect of a match |
| --- | --- |
| Generated dispute letter | The phrase is **rewritten** into hedged/educational wording, the change is **logged** on the letter record, and an admin can see it in the compliance dashboard. The consumer reviews and approves the final letter before it is used. |
| Kai (AI assistant) answer, Brief summary/caption | The phrase is **rewritten** the same way before display. |
| Member post in the Operator Network / Brief comments | The post is **rejected** with the message: *"Posts can't promise guaranteed deletions or score increases, cite §609/Metro-2 deletion myths, or state legal conclusions. Please rephrase as your own experience or question."* Nothing the member wrote is silently changed. |

It is pattern matching, not judgment. It cannot read intent, cannot evaluate whether a
claim is true, and cannot certify anything as lawful. It is one deterministic layer under
whatever policy counsel defines.

## 2. What changed, and what we measured

Two rule sets are compared throughout this document:

* **"Today"** — the rule set in place before this change (a small list of literal phrases,
  e.g. the exact string *"guaranteed deletion"*).
* **"Proposed"** — the generalised rule set in this release branch, **not yet released**.
  Whether the "Today" set is what is currently running in production is a deployment
  question outside this document (**VERIFICATION REQUIRED — PRODUCTION**).

Against a 49-phrase adversarial set (the same claim written 49 different ways) and a
29-phrase set of legitimate credit education:

| Measure | Today | Proposed |
| --- | --- | --- |
| Prohibited claims caught (49) | **17 (35%)** | **49 (100%)** |
| Legitimate education wrongly blocked (29) | 2 | **0** |

The 65% that slipped through today were not clever attacks. They were ordinary rewordings:
putting the word "guaranteed" *after* the claim instead of before it, spelling "50" as
"fifty", or saying "your score will definitely go up" instead of "we guarantee". No
AI, no external service, and no new data collection was added; the control remains a
fixed list of patterns that produces the same result every time.

## 3. Decision table — one row per claim category

Read "Today" and "Proposed" as *what the software does*, not as *what the law requires*.
The last three columns are what we need counsel to rule on.

| # | Category | Example claim | Enforced today | Proposed | Ambiguity requiring counsel | False-positive risk (blocking legitimate education) | False-negative risk (letting a claim through) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Guarantee **before** a score outcome | "Guaranteed higher credit score." | Caught | Caught | None on the core case. Is "guaranteed" the only trigger word, or do "assure", "ensure", "pledge" carry the same bar? | Low | Low |
| 2 | Guarantee **after** the outcome (word order) | "Score increase guaranteed." | **Missed** | Caught | Same substantive claim as row 1 — confirm it is treated identically. | Low | Was high; now low |
| 3 | Guarantee + a point figure | "Guaranteed 50 points." | Partly | Caught | Does a stated point figure alone make the statement a prohibited representation, or only when paired with a guarantee word? | Low | Low |
| 4 | Numbers written as words / ranges | "A hundred point jump", "50–100 points" | **Missed** | Caught | None. Confirm words and digits are the same claim. | Low | Was high; now low |
| 5 | Spacing, hyphen and punctuation variants | "Guaranteed score-increase", "100 % guaranteed" | Partly | Caught | None. | Low | Low |
| 6 | Certainty language without the word "guarantee" | "Your score will definitely go up", "we'll fix your credit score" | Partly | Caught | **Key question.** Is a definite future-tense claim ("will improve") a prohibited representation, or only an express guarantee? The proposed rules treat "will" as a promise and leave "may/can/often" alone. | **Medium** — "paying on time **will** improve your score" is arguably true general education and *is* rewritten. | Was high; now low |
| 7 | Quantified gain with no guarantee word | "Expect a 40 to 80 point increase", "a 50 point boost" | Partly | Caught | **Key question.** Are non-guaranteed outcome *estimates* and testimonials ("members often see 30–50 points") permitted with a disclaimer, or prohibited outright? Proposed = prohibited outright. | **Medium** — blocks statistical/testimonial teaching even when hedged. | Low |
| 8 | Deletion **result** claims | "The collection will be removed", "these accounts are going to be deleted" | Partly ("will be deleted" only) | Caught | Confirm that predicting deletion is prohibited regardless of the verb ("removed", "erased", "expunged"). | Low–Medium — a letter may want to state a *conditional* statutory consequence (see row 16). | Was medium; now low |
| 9 | Guarantee attached to deletion/removal | "Deletion guaranteed", "guaranteed removal of collections" | Partly (one exact phrase) | Caught | None. | Low | Was high; now low |
| 10 | Service claims it performs deletions | "We delete negative items from your report." | **Missed** | Caught | Is describing the *service* ("we dispute items on your behalf") acceptable while describing the *result* ("we delete them") is not? Proposed assumes yes. | Low | Was high; now low |
| 11 | Universal success claims | "100% success rate", "it works every time" | Partly | Caught | Confirm these are prohibited outcome representations even without the word "guarantee". | Low | Was medium; now low |
| 12 | §609 / Metro-2 deletion myths | "§609 requires deletion of the account." | Caught | Caught (unchanged) | None — this is settled internal policy. | Low | Low |
| 13 | Legal conclusions | "This is fraud", "you are in violation of the FCRA" | Caught | Caught (unchanged) | Whether a consumer may assert a violation *in their own letter* is a live question; today the software will not let them. | Low–Medium — arguably suppresses the consumer's own protected assertion. | Low |
| 14 | **Negated / disclaiming statements** | "Nobody can promise a 50 point increase" | **Wrongly blocked today** (rewritten to nonsense: *"Nobody can promise a point change that varies…"*) | Allowed through untouched | **Key question.** Confirm that the *denial* of a guarantee must never be treated as a guarantee. This carve-out is also what lets the platform print its own disclaimer. | Was a real over-block; now none | Creates a bounded evasion route — see §4. |
| 15 | **Third-party attribution / warning copy** | "Avoid any service that guarantees a 100 point increase"; "credit repair companies that promise guaranteed deletions are violating the CROA" | The first is **wrongly blocked today**; the second escapes today only because the rule was too literal to see the plural — and would be blocked by the broadened rules without this carve-out | Allowed through untouched | **Key question.** May the platform quote a prohibited claim in order to warn consumers about it? Proposed = yes, when the sentence names a third party and contains no first-person voice. | Was a real over-block (a member teaching correctly would have had the post rejected); now none | Creates a bounded evasion route — see §4. |
| 16 | Statutory language a lawful letter needs | "The FCRA requires the bureau to correct or delete information that cannot be verified." | Allowed | Allowed (deliberately) | **Key question.** Confirm quoting §611's "correct or delete" duty is not an outcome promise. A naive rule here would break every dispute letter. | n/a | A promise could be dressed in statutory clothing; not currently detectable by pattern. |
| 17 | Hedged education | "Paying down balances **can** improve your score over time, though results vary." | Allowed | Allowed | Confirm the hedged/definite line drawn in row 6 is the right one. | n/a | An implied promise can be built entirely from hedged sentences; pattern matching cannot see it. |
| 18 | **"Correction" outcome — known uncovered gap** | "Your report will be corrected." | **Not covered** | **Still not covered** | **Decision needed.** The platform's own disclaimer says no *correction* is guaranteed, but no rule enforces it, because any plausible rule collides with the lawful statutory language in row 16. Engineering will not write this rule without a legal standard. | Writing it naively would break lawful dispute letters | **Open** — a correction promise is not caught today. |

## 4. The two carve-outs, stated plainly (they are the main residual risk)

Rows 14 and 15 are *suppressions*: the control finds a prohibited phrase and deliberately
leaves it alone. Both are necessary — without them the platform cannot print its own
disclaimer or warn consumers about scams — and both are bounded, but neither is airtight.

* **Clause negation.** A prohibited phrase is left alone when the same clause negates it
  ("**no** score improvement is guaranteed"). Scope is the clause only, capped at 120
  characters, and a contrast word resets it, so *"this is not legal advice, **but** we
  guarantee 50 points"* is still caught (verified). Residual: a promise buried in a clause
  that negates something unrelated could be sheltered.
* **Third-party attribution.** A prohibited phrase is left alone when the sentence names a
  third party ("companies **that**…", "anyone **who**…") **and** contains no first-person
  voice ("we", "our", "I", "CreditVector"). *"We are the company that guarantees deletion"*
  is still caught (verified). Residual: a claim written in fully third-person marketing
  voice could be sheltered.

Both are documented in the code and pinned by automated tests, so a future change that
widens them fails the build. **Counsel should decide whether either carve-out is
acceptable, and whether the platform may quote a prohibited claim to warn about it.**

## 5. What this control still cannot do

1. It cannot detect an **implied** promise assembled from individually clean sentences.
2. It cannot judge **truth** — an accurate outcome statement and a false one look identical.
3. It cannot evaluate **context or medium**; the same sentence is treated the same in a
   letter, a lesson, and an ad.
4. It does not review **static marketing pages, pricing pages, emails, or paid ads** — it
   runs only on generated and member-authored text.
5. It **cannot certify compliance.** Regex is not a legal opinion.

## 6. What we are asking counsel to decide

1. **Definite-future language** (row 6): is "your score will improve" prohibited, or only an
   express guarantee?
2. **Quantified estimates and testimonials** (row 7): prohibited outright, permitted with a
   disclaimer, or permitted only with substantiation?
3. **Deletion-result verbs** (row 8): confirm all result verbs are equivalent to "deleted".
4. **Service vs. result descriptions** (row 10): where is the line between describing what
   we do and promising what will happen?
5. **The "correction" gap** (row 18): what wording enforces it without breaking the lawful
   FCRA §611 "correct or delete" language a dispute letter must contain?
6. **Consumer-authored legal assertions** (row 13): may a consumer assert an FCRA violation
   in their own letter, or must the software continue to soften it?
7. **The two carve-outs** (§4): approve, narrow, or remove.
8. **Scope**: should this control (or an equivalent review) extend to marketing pages,
   emails, and ads, which it does not cover today?

Until items 1–8 are answered, **B-05 remains PARTIAL**. The engineering change described
here measurably reduces evasion (35% → 100% on the tested set) with no measured
over-blocking, but the *standard* those rules are supposed to implement is still counsel's
to set.

---

*Engineering references (for the record, not required to review this document): the rule
set is `lib/compliance.ts`; the corpora, mutation-tested guard, and the measured rates are
`scripts/compliance-bar.test.ts` (`npx tsx scripts/compliance-bar.test.ts`); the admin-visible
rule inventory is generated from the enforced rules themselves and states each carve-out, so
it cannot describe a bar the software does not apply.*
