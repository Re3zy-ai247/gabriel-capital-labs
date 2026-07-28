# RUNBOOK — Alert activation & delivery drill (B-10)

> **Status: PARTIAL.** The reporting *mechanism* exists and is wired into the launch-critical paths.
> The *delivery* half does not: `ALERT_WEBHOOK_URL` is unset, so `reportError` structured-logs and
> returns. Every Stripe webhook failure, checkout failure, billing-linkage failure and cron failure
> currently lands in Vercel logs and **pages nobody**.
>
> **B-10 stays PARTIAL until an alert has been observed arriving in a human-watched destination.**
> Setting the env var does not close it. **Configuration presence is not delivery proof** — that is
> the entire point of this runbook, and the reason V-04 in `OPERATIONS.md` has two clauses.

**What is already true (VERIFIED in-repo, 2026-07-28):**

- `lib/observability.ts` → `reportError(err, context)` always `log.error`s; it POSTs to
  `ALERT_WEBHOOK_URL` **only when that var is set**, fire-and-forget, `.catch(() => {})`, never awaited,
  never throws. An alert-delivery failure can never break a user request — and, symmetrically,
  **can never tell you it failed.** That is why a drill is required.
- Payload shape: `{ "text": "CreditVector error: <Name>: <message>" (≤500 chars), "context": {…} }`.
- 11 `reportError` call sites across `app/api/cron/brief-ingest`, `app/api/cron/brief-digest`,
  `app/api/stripe/webhook`, `app/api/stripe/checkout`, and `lib/billing.ts`.
- Guard: `npx --no-install tsx scripts/observability.test.ts`.

Related: `OPERATIONS.md` → "Cron liveness" and rows **V-04**, **V-05**, **V-06** ·
`scripts/prod-health.sh` (daily, unauthenticated) · `.ai/RUNBOOKS/deploy.md`.

---

## 1. Choose a destination

The requirement is not "a URL that accepts POSTs" — it is **a place a human actually looks**. An
alert delivered to an unwatched channel is indistinguishable from no alert, and worse, it *feels*
solved.

| Option | Payload fit | Notes |
|---|---|---|
| **Slack incoming webhook** | **Native.** Slack renders the top-level `text` field, which is exactly what `reportError` sends | Recommended if the owner already lives in Slack. Extra keys (`context`) are ignored by the renderer |
| **Discord webhook** | **MISMATCH — VERIFICATION REQUIRED.** Discord expects `content`, not `text`; a body with neither `content` nor `embeds` is rejected (HTTP 400) | Do not assume it works. §3 will reveal it immediately. If it fails, use a relay, or change the sender — a code change, out of scope here |
| **Generic collector** (Better Stack, Pagerduty events, a small relay) | Accepts arbitrary JSON | Best when the destination should also page a phone. Adds a dependency to keep alive |
| **Email-to-webhook bridge** | Varies | Weakest — email is where alerts go to be ignored |

**Decide and record:** destination platform · exact channel/room · **who is expected to see it** ·
whether it reaches a phone outside working hours. A destination with no named human is not a
destination.

> **Volume sanity, before enabling.** Alerting is worth having only if it stays quiet. The noisiest
> plausible source is the stripe-webhook `phase: "signature"` site (any bogus POST to the public
> webhook endpoint fires it). If the channel starts flooding, the fix is **not** to unset the var
> and re-open this blocker silently — it is to record the noise source and route it (filter at the
> destination, or change the sender behind the normal review gate).

---

## 2. Set the variable — without ever printing its value

A webhook URL **is** a credential: it grants anyone holding it the ability to post into the channel.
Treat it exactly like a key.

```bash
# Interactive; reads the value from stdin. Do NOT pass the value as an argument
# (it lands in shell history) and do NOT echo it back.
npx vercel env add ALERT_WEBHOOK_URL production
# → paste the URL at the prompt, press Enter.

# Confirm PRESENCE only — this prints names, not values.
npx vercel env ls production | grep ALERT_WEBHOOK_URL     # expect exactly one row
```

Rules, non-negotiable:

- **Never** `echo`, `cat`, log, screenshot, paste into a ticket/chat/commit, or read back the value.
- **Never** add it to `.env.example`, a test fixture, or any file in this repository.
- Store it in the owner's password manager alongside the other prod key material (`OPERATIONS.md`
  → Backup-scope checklist), so it survives a Vercel-project rebuild.
- Add it to Preview **only** if you want preview failures paging the same channel — usually no.
- If it is ever exposed, **rotate at the destination** (regenerate the webhook), then re-add here.
  Rotation is cheap; a leaked webhook is a spam vector into the owner's channel.

**An env change does not reach running code until a redeploy.** Per `CLAUDE.md`:

```bash
npx vercel redeploy <latest-prod-url>
curl -sI https://www.creditvector.app/ | grep x-cv-release    # unchanged SHA is expected & correct
```

After the redeploy — and only after — an authenticated ADMIN GET of `/api/admin/diagnostics` should
report `ALERT_WEBHOOK_URL` present (names/booleans only; the endpoint reports presence, never values).

**Everything so far proves configuration. It proves nothing about delivery. Continue.**

---

## 3. The delivery drill — proving an alert actually arrives

**The success criterion is a message visible in the destination channel, seen by the person who is
supposed to see it.** Not a 200 from the webhook. Not "the var is set". Not a log line.

### 3.1 Trigger (safe, real, side-effect-free)

Use the **Stripe webhook signature-verification path**. It is a genuine production `reportError` call
site, it runs *before* any database write or Stripe API call, and it cannot affect billing state.

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST https://www.creditvector.app/api/stripe/webhook \
  -H "content-type: application/json" \
  -H "stripe-signature: t=0,v1=alert_delivery_drill_not_a_real_signature" \
  -d '{"drill":"alert-delivery"}'
# Expect: 400
```

Why exactly this shape:

- The `stripe-signature` header **must be present but invalid**. With the header absent the route
  returns 400 at the missing-signature guard **before** `reportError` — which is precisely what
  `scripts/prod-health.sh` check 3 sends, so **the daily health probe does not generate an alert.**
  Do not expect one from it, and do not treat its passing as evidence of alerting.
- `constructEvent` throws on the bad signature → `reportError(e, { scope: "stripe-webhook",
  phase: "signature" })` → 400 to the caller. No DB write, no Stripe call, no entitlement change.
- Expected alert text begins `CreditVector error:` with a Stripe signature-verification message and
  `context.scope === "stripe-webhook"`, `context.phase === "signature"`.

Record the **exact UTC time** of the curl. You will need it to correlate.

### 3.2 Confirm arrival (this is the actual test)

1. **Open the destination channel and look.** A message must appear within seconds. Screenshot it
   with the timestamp visible — **redact nothing except any URL/credential the renderer echoes.**
2. **Confirm the message is legible to a human at 3am:** does it say what broke, and where? If it
   renders as `undefined`, raw JSON, or an empty card, delivery works but the alert is useless —
   record that as a finding (a rendering fix is a code change, out of scope here).
3. **Corroborate in Vercel logs** that the same request logged its `log.error`
   (`npx vercel logs <latest-prod-url>` or Vercel MCP `get_runtime_logs`, project
   `prj_1SouMFFSQ5icOY9APDtiMqnSUCCJ`, team `rey-gabriel-s-projects`). Log present **and** channel
   message present = the whole path works. Log present, no message = delivery is broken (§5).

### 3.3 Record the result

```
ALERT DELIVERY DRILL
  Date/time of trigger (UTC):    ____________________
  Destination platform/channel:  ____________________
  Human responsible for it:      ____________________
  HTTP status from curl:         ______ (expect 400)
  Message appeared in channel?   YES / NO
  Latency (trigger → visible):   ____________________
  Message legible/actionable?    YES / NO — notes: ______________
  Vercel log line found?         YES / NO
  Reaches a phone off-hours?     YES / NO
  Drill outcome:                 PASS / FAIL
  B-10 status after this drill:  PARTIAL (unproven) / CLOSED (message observed above)
```

**Re-run this drill after any change to the destination, the env var, or `lib/observability.ts`.**
A webhook that was revoked at the destination fails exactly as silently as one that was never set.

---

## 4. Cron-liveness verification (the other half of B-10)

Alerting proves *failures* get out. It says nothing about a job that **never runs** — a cron that
does not fire emits no error, so it triggers no alert. These are two independent unproven things and
must be checked separately.

`vercel.json` schedules `/api/cron/brief-ingest` daily **13:00 UTC** and `/api/cron/brief-digest`
weekly **Mon 14:00 UTC**.

**VERIFICATION REQUIRED — PRODUCTION**, weekly:

1. **Vercel → Project → Settings → Cron Jobs** — the authoritative surface: last run time + status
   per job. Escalate if ingest's last run is >48h old or digest's is >8 days.
2. **Runtime logs filtered by path** — expect one `/api/cron/brief-ingest` invocation per day near
   13:00 UTC.
3. **Data-side corroboration (confirming only, never clearing):** a `BriefArticle` created in the
   last 24h proves the ingest ran. **The converse does not hold** — a run finding no new feed items
   creates zero rows. Presence is evidence; absence is not.

What `scripts/prod-health.sh` check 6 already proves without credentials: the routes still exist
(404 = removed by a deploy), `CRON_SECRET` is set so they *can* run (503 = unset), and they refuse
anonymous callers (200 = fail). **It does not prove a schedule fired.**

> **HANDOFF — scripts owner (Agent 4 / `scripts/`).** Nothing here should be automated by inventing
> an endpoint that reports internal state to the public internet (`prod-health.sh` refuses this on
> purpose). The only honest automation would be a *credentialed* job reading the Vercel API's cron
> last-run data and failing when it exceeds the thresholds above. Out of scope for this runbook; do
> not add an unauthenticated liveness endpoint to satisfy it.

**Standing caveat, until §3 passes:** a cron that runs and *fails* also reaches no human.

---

## 5. When the drill fails

Work down this list; stop at the first that explains it. **Do not skip to "it probably works now" —
re-run §3 after every fix, because only §3 can close B-10.**

| Symptom | Likely cause | Action |
|---|---|---|
| Curl returns something other than 400 | Wrong path, or the webhook route changed | Check the route is deployed; `bash scripts/prod-health.sh` |
| No channel message, no Vercel log line | The trigger never reached the reportError site | Confirm the `stripe-signature` header was **present but invalid** — absent header short-circuits before reporting |
| Vercel log present, no channel message | Delivery is broken — the fetch failed silently by design | Continue below |
| ↳ var not visible to the running code | Env added but **no redeploy** | `npx vercel redeploy <latest-prod-url>`, re-drill |
| ↳ var added to the wrong environment | Added to Preview/Development only | `npx vercel env ls production` → expect one row; add to Production |
| ↳ destination rejects the payload | Discord (`content` vs `text`), or a collector requiring auth headers/a specific schema | Test the destination independently with a hand-rolled POST of the **same shape** `{"text":"…","context":{}}`. If it rejects that shape, the destination is incompatible — pick another, add a relay, or change the sender (code change, five-review gate) |
| ↳ destination 401/403/404 | Webhook revoked, rotated, or channel deleted | Regenerate at the destination, re-add the var (§2), redeploy, re-drill |
| ↳ message arrives minutes late or intermittently | Destination rate-limiting | Record it; a rate-limited alert channel drops the *second* alert in an incident, which is usually the important one |
| Message arrives but is unreadable | Payload/rendering mismatch | Record as a finding; fixing the payload is a code change behind the normal gate |

**Never "fix" a failing drill by unsetting `ALERT_WEBHOOK_URL` and moving on.** That restores the
exact silent state B-10 exists to end. If alerting cannot be made to work, leave it unset **and** say
so explicitly in `OPERATIONS.md` V-04 with the reason and the date.

**Never claim B-10 closed on the basis of `env ls` output.** The only evidence that closes it is an
observed message in a human-watched destination, recorded in §3.3.
