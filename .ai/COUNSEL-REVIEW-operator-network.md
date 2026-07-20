# Counsel-review package — Operator Network & Arena

**Status: DRAFT for counsel review. Not legal language. Every item below is operational draft text a lawyer must review, ratify, or replace before the gated activation it governs.**

This package gates **public/production activation**, not engineering. Development, preview, internal testing, and restricted-cohort testing behind the OFF-by-default flags may proceed without it. Unrestricted public access may **not**.

---

## 0. The hard compliance STOP (engineering already enforces this)

**No cross-user, outcome-derived ranking or leaderboard may ship without a ratified compliance decision.** A public "who got the most deletions" surface is an implied-typical-results claim under **CROA §1679b and FTC §5**, and CreditVector's own bar forbids promising outcomes. Arena v1 therefore ships **own-XP only**; the engine exposes cross-user data solely as **aggregate integers with no identity**. This is not advisory — it is the ship posture, and any change to it needs a compliance ADR, not an env flag.

## 1. Community privacy disclosure (DRAFT — the live gap)

The live privacy policy has **zero** coverage of the Operator Network. Before any cross-user surface activates publicly, it must disclose, at minimum:
- that posts, a chosen display handle, reactions, and timestamps are visible to other members;
- that presence ("active now") and typing state, *if enabled*, are visible to others;
- retention: how long messages and presence are kept;
- that Kai, an automated intelligence, participates and is labeled as such.

*Owner/legal action: draft and publish the amendment; nothing here is binding language.*

## 2. Acceptable-use rules (DRAFT)

Members agree not to post: another person's private information; credit-report contents, account numbers, or bureau correspondence; guaranteed-outcome or deletion-guarantee claims (already machine-screened via `screenCommunityText`, fail-closed 422); spam, harassment, or illegal content. Violations may be moderated or removed.

## 3. Prohibited sensitive-data sharing

Consumer names, credit-report detail, account numbers, bureau correspondence, and any client-identifying evidence must never appear on a cross-user or platform-voiced surface. **Engineering constraint carried from the review:** before any agency-private channel that can carry attachments ships, the attachment-serving route must apply the channel's audience predicate (not just `canAccessCommunity`) — otherwise client-private evidence (bureau letters, IDs) leaks to any paying member by id. This is a build gate, listed here so counsel understands the data boundary.

## 4. Moderation policy (DRAFT)

Every moderation action (hide/remove/lock) is authorized by scope (`canModerate`: global admin, or the owning agency within its own private channel) and recorded to an immutable audit trail. Members may report a message; reports enter a queue. Removal reasons are retained.

## 5. Message retention (DRAFT — owner decision)

*Owner decision required:* how long are messages, reports, and presence records retained, and what is the deletion process on account closure?

## 6. Operator presence disclosure (DRAFT)

If presence/typing indicators are enabled, members must be told their online state is visible, and given a way to appear offline. Presence is refused until this disclosure is reviewed.

## 7. Automated Kai participation (DRAFT)

Kai may post narrowly scoped system messages (welcome, a verified milestone, a scheduled announcement) and must be **clearly labeled as automated intelligence**, must respect channel and agency permissions, and must never reveal private client evidence. Broad autonomous conversation is not in this slice.

## 8. Agency-private channel expectations (DRAFT)

An agency-private channel is visible only to the owning agency (by verified `managedByAgencyId` edge / account id — never the free-text brand) and platform admins. Members of other agencies cannot view, post, or moderate it. This is runtime-enforced (`lib/network/authz.ts`, proven 36/36).

## 9. Reporting & enforcement (DRAFT)

Report → queue → scoped moderator review → action + audit entry. Repeat or severe violations may result in removal from the network. Appeals process: *owner decision required.*

---

## What must clear before each activation

| Surface | Gate |
|---|---|
| Operator Network public activation | items 1, 2, 3(+build fix), 4, 6, 9 reviewed; tenant isolation runtime-proven (done); moderation path operational |
| Presence / typing | item 6 reviewed |
| Arena cross-user ranking | §0 compliance ADR + a separate display-consent record + CCO sign-off — **or it never ships** |
| Kai participation | item 7 reviewed |

*Prepared 2026-07-20. Draft operational text only — legal review gates remain in force.*
