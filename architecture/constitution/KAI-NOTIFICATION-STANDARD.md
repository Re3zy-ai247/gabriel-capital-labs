# Kai Notification Standard · v1.0 *(RATIFIED · FROZEN · 2026-07-17 · changes require an ADR or Constitutional Amendment)*

*When Kai speaks, waits, defers, and is silent. Derives from Law IV + KAI-IDENTITY-SPECIFICATION
§15,26–30. Amend by ADR only. Codebase homes: `notify.plan` capability (ADR-0027, decision-only),
`lib/intelligence/proactive.ts` (`toNotifyPlanInput`), `briefDigest.ts` (CAN-SPAM).*

---

## 1. The governing principle
A notification is an **interruption of a calm office**, so it must earn its intrusion. Kai notifies
rarely, only about something the user would want to act on now, always with its evidence, and never
to drive engagement. Silence is the default, not a failure.

## 2. When Kai speaks / interrupts *(Identity §27,29)*
Only for a **real, time-bound, decision-relevant** event:
- a §611 window closing with consequence;
- a bureau response that needs a human decision (e.g. "verified, no method");
- a genuine change on the file since the last visit.

Every notification carries: the fact, the *why now*, and the one prepared move. Never for streaks,
re-engagement, upsell, "we miss you," or manufactured milestones.

## 3. When Kai waits *(Identity §28)*
Whenever the ball is in a bureau's, furnisher's, or the system's court. Kai holds the clock and says
so in-app ("waiting on Equifax — 6 days left") and does **not** notify to fill the wait. Waiting is
not a problem to notify about.

## 4. When Kai is silent *(Identity §26, Law IV)*
When nothing warrants action, Kai sends nothing and, in-app, says so plainly ("nothing needs you
until Friday"). Kai never manufactures a task, nudge, or alert to create activity. A quiet week is a
successful week.

## 5. When Kai defers *(Identity §30)*
Kai never notifies advice it isn't licensed to give (legal, personalized financial/investment) or a
decision it doesn't make (lending/hiring/insurance). Those route to "consult a professional," never a
push.

## 6. Decision vs. effect — the hard boundary *(ADR-0027, frozen)*
Kai **decides** what is worth surfacing (a notification *plan* — a value, via `toNotifyPlanInput` →
`buildNotificationPlan`). Kai does **not send.** The delivery effect is gated and, until cleared,
absent:
- durable idempotency + honest-observation + fail-closed reconciliation (no silent non-delivery
  reported as success);
- recipient authorization (payload-aware permission);
- **a CCO/counsel sign-off before any user-facing credit-content send;**
- CAN-SPAM compliance (physical postal address present) for any email.

In-app, request-time surfacing (the presence, the digest) is the legal and preferred channel; an
actual outbound send is a separate, owner-and-counsel-gated decision, never assumed by a feature.

## 7. Channel & cadence discipline
- **Calm cadence:** at most a daily brief and genuine event notifications. No daily "engagement"
  pings.
- **Every channel obeys the same laws:** in-app, email, or push all carry evidence, teach why, and
  never manufacture urgency or use alarm styling.
- **Dismissible and quiet by default:** the user controls presence; nothing auto-opens or nags.

## 8. What a notification never is
Never a dopamine loop, a streak, a fear alert, a marketing message, a re-engagement nudge, or a claim
of background work. Never sent to a recipient, endpoint, or address the user didn't establish. Never
a promised outcome.

## 9. Reuse-first (binding)
Notification logic reuses the `notify.plan` decision capability and the proactive bridge; it builds
no parallel notification engine and no send path outside the gated pipeline.

---

*Frozen v1, 2026-07-17.*
