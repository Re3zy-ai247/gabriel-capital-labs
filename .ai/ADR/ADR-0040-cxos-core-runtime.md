# ADR-0040: CXOS Core Runtime 1.0

Status: **ACCEPTED — HEADLESS PRESENTATION MECHANICS ONLY**
Date: 2026-07-31
Decision owner: Founder

## Context

Founder-review rooms share arrival, settlement, capability, district-focus, visibility, reduced-motion, and bounded local-navigation mechanics. Product meaning and canonical facts must remain room-owned.

## Decision

Extract those mechanics into one pure policy module and one headless browser adapter. The runtime may coordinate presentation lifecycle only. It receives no Growth, Agency, customer, identity, billing, economic, or source-system truth.

Invalid capability or room configuration fails down to a complete static document. Reduced motion is a capability result, not a cosmetic afterthought. Native browser navigation remains authoritative.

## Non-ownership

Core Runtime owns no room DOM, content, CSS, metric, workflow, source record, action, persistence, network request, analytics event, model behavior, or authorization decision. Each consumer requires an independently authorized integration.

## Consequences

Growth Center may reuse the already-authorized presentation lifecycle without modifying the runtime. This ADR authorizes no production activation, participant data, API, schema, billing, or economic behavior.
