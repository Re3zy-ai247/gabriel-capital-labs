# CreditVector — Phase 1A Founder Package — Manifest

Package: `CreditVector-Phase1A-2026-08-03.zip` (internal folder: `phase-1a/`)
Built: 2026-08-03, from `feat/experience-runtime-phase-1a` @ `486925e` (base `origin/main` @ `f449c35`)
Subject: Phase 1A — Experience Runtime — implemented, gate-hardened, not yet merged/deployed

## Entry point

Start at **`FOUNDER-SUMMARY.html`** (or `.md` if reading in a plain-text/markdown viewer). It links to the other three narrative documents.

## Contents

| File | Format | Purpose |
|---|---|---|
| `FOUNDER-SUMMARY.md` | Markdown | The Founder-facing verdict, room-by-room changes, the gate story, disclosed follow-ups, CCO items, and next decisions. **Start here.** |
| `FOUNDER-SUMMARY.html` | Self-contained HTML | Same content as above, styled — inline CSS, light/dark aware, table of contents, mobile-responsive, zero external references. |
| `IMPLEMENTATION-REPORT.md` | Markdown | Full per-agent (A–E) technical detail plus the fix pass: files touched, mechanisms, exact guard counts. |
| `IMPLEMENTATION-REPORT.html` | Self-contained HTML | Styled twin of the above. |
| `VALIDATION.md` | Markdown | The full validation table (typecheck/build/lint/guard suite), zero-schema and zero-money confirmations, and the honest acceptance-gate narrative — what was independently re-verified today vs. carried forward. |
| `VALIDATION.html` | Self-contained HTML | Styled twin of the above. |
| `CONTINUE-IN-CHATGPT.md` | Markdown | Portable, self-contained context for resuming this work in a tool with no repo access (e.g. ChatGPT) or handing off to a fresh engineer: exact state, what's live, next decisions, a DO-NOT list. |
| `CONTINUE-IN-CHATGPT.html` | Self-contained HTML | Styled twin of the above. |
| `MANIFEST.md` | Markdown | This file. |
| `SHA256SUMS.txt` | Text | SHA-256 checksum of every other file in this package, for integrity verification after transfer. |

10 files total (this manifest is the 9th; `SHA256SUMS.txt` is the 10th and is generated last, after every other file is final).

## Design notes on the HTML twins

Each `.html` file is a fully self-contained document: inline `<style>` only (no external stylesheets, fonts, scripts, or images), an explicit `<meta charset="utf-8">`, a `prefers-color-scheme` media query for light/dark (defaults follow the reader's OS/browser setting), a sticky/collapsing "On this page" table of contents, and responsive layout down to mobile widths (tables and code blocks scroll horizontally within their own container rather than the page). They render correctly opened directly from disk (`file://`), from a GitHub Gist's raw view, or from any static file host.

## Verification

This package's integrity can be checked after transfer by re-computing SHA-256 over every file listed in `SHA256SUMS.txt` and comparing. Both the zip archive at `docs/handoffs-phase-1a/CreditVector-Phase1A-2026-08-03.zip` and its copy at `~/Desktop/Claude-Handoffs/CreditVector-Phase1A-2026-08-03.zip` were confirmed byte-identical (matching SHA-256) at build time, and both were verified with `unzip -t` (archive integrity, no corruption).

## Scope reminder

This package documents Phase 1A (Experience Runtime) only. It contains no money, Wallet, LetterStream, or provider-surface content, no schema/migration content, and no PII, credentials, or secrets — see `VALIDATION.md` for the specific commands that confirm the first two, and the sanitization scan results reported alongside this package's delivery for the third.
