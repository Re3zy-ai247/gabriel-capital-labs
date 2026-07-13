# ADR-0003: Brief news automation — official-source RSS + existing Anthropic key, draft-only

Status: Accepted (shipped 2026-06-26)
Date: 2026-07-12 (recorded)
Decision owners: Owner (explicit choice)

## Context
The Brief needed automated story intake. Options evaluated: Perplexity API, Abacus RouteLLM (scaffolded then reverted — no web search; consumer subscriptions ≠ API access), or curated official-source RSS.

## Decision
Pull curated **official** feeds only (`BRIEF_FEEDS` = CFPB Newsroom + FTC Press Releases) with a minimal pure RSS parser; dedup by `sourceUrl`; enrich with the full article body (or linked-PDF text fallback) fetched ONLY from trusted feed hosts (SSRF guard); summarize via the existing compliance-bound `summarizeArticle` (existing `ANTHROPIC_API_KEY` — no new vendor); create **DRAFTS only** (`maxPerRun=5`) — a human publishes. Daily cron + manual admin "Fetch latest news" button.

## Alternatives considered
Perplexity/RouteLLM — rejected: cost, no web search (RouteLLM), higher legal risk vs .gov sources.

## Consequences
Cheap, low-defamation-risk, high-authority sources; narrower coverage (two feeds). Extending `BRIEF_FEEDS` requires extending the SSRF allowlist deliberately.

## Security implications
SSRF guards: body fetch restricted to consumerfinance.gov/ftc.gov, 12s timeout; PDF fetch trusted-host, 15MB/20s caps.

## Compliance implications
Admin-approval-before-publish is THE control; compliance verdict GO. **Counsel advisory still open: news-editorial/defamation posture sign-off before publishing the FIRST auto-drafted article.**

## Migration or rollback plan
Disable the cron in `vercel.json` / leave drafts unpublished.

## Evidence
`lib/briefIngest.ts` (`BRIEF_FEEDS`, `parseRssItems`, `extractMainText`, `findPdfLink`/`fetchPdfText`, `findEmbeddedYouTube`), `app/api/cron/brief-ingest`, `vercel.json` crons, guard `scripts/brief-ingest.test.ts` 26/26; commits `6d44a73`, `b536a07`, `ccb2f77`.
