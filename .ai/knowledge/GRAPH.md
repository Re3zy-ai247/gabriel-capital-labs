# CreditVector Knowledge Graph

**Rule zero (inherited from the AIOS graph): this is an INDEX, not a copy.** Every node points to ONE canonical source. Search here first; update the source, not this map — add a row only when a NEW domain is born. The company-level graph is AIOS `KNOWLEDGE-GRAPH.md`; this one is product/repo-scoped and finer-grained.

## Node index
| Node type | Canonical source | Find a specific one via |
|---|---|---|
| Features / modules | `../PRODUCT.md` + `lib/brand.ts` MODULES | Grep `lib/brand.ts` |
| Components | `components/` (marketing/, admin/, brief/, community/, landing/, ui/) | Glob + `../ARCHITECTURE.md` file map |
| API routes | `app/api/**` | `ls app/api`; auth conventions in `../SECURITY.md` |
| Data models | `prisma/schema.prisma` (22) + self-heal gates (ADR-0001) | Grep `^model` / `ensure.*Tables` |
| ADRs / decisions | `../DECISIONS.md` → `../ADR/` | index table |
| Roadmaps | `../ROADMAP.md` (repo) · `../VISION.md` (horizons) · AIOS `BACKLOG.md` (company G-NN) | — |
| Prompts (AI surfaces) | `../PROMPT-REGISTRY.md` → code | registry IDs (KAI-SYS…) |
| Legal/compliance sources | `../COMPLIANCE.md` + `lib/compliance.ts` + `lib/statutes.ts` (code = law) | never invent; quote from these |
| Workflows / SOPs | `../SOP/` + `../RUNBOOKS/` | `../INDEX.md` |
| UI / design | `../DESIGN-SYSTEM.md` → tokens in `tailwind.config.ts`/`globals.css` | — |
| Integrations | `../INTEGRATIONS.md` | env-var name |
| Marketing campaigns | `../marketing/CAMPAIGN-LIBRARY.md` | CAMP-NN |
| Brand assets | `../ASSET-REGISTRY.md` | CV-XXX-NN |
| Metrics | `../business-intelligence/METRICS.md` | BI-XXX-NN |
| Executives / ownership | `../executive/README.md` mapping table | role |
| Newsletter/digest | `lib/briefDigest.ts` + CAMP-002 | — |
| Support issues (live data) | `/admin/product` support counts; patterns → improvement engine | — |
| Tests / guards | `../TESTING.md` guard table | script name |

## Linking conventions
- Docs cite stable IDs (ADR-NNNN, BI-XXX-NN, CAMP-NN, CV-XXX-NN, G-NN, prompt IDs) — IDs survive file moves, prose doesn't.
- Code references use `path:line` only in session output, bare paths in docs (lines rot).
- A fact appearing in two docs = a bug; the second occurrence becomes a link.

## Kai consumption (PROPOSED — not built; do not imply otherwise)
Goal: Kai eventually answers over this graph (features, statutes-as-implemented, product how-tos). **Standing constraint: ADR-0005 made Kai deliberately tool-less and data-less — that is a security control, not a limitation to casually remove.** Path when pursued: (1) ADR superseding 0005 scoping READ-ONLY, non-PII, pre-scrubbed knowledge; (2) CSO pass (injection surface: graph content becomes prompt input — fencing required); (3) CCO pass (educational framing of statute knowledge); (4) start with a static, human-approved knowledge pack, not live repo access.
