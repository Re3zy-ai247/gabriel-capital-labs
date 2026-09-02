// Run: npx tsx scripts/observability.test.ts
//
// Guards that launch-critical failures are VISIBLE and HONESTLY reported.
//
// WHY (found 2026-07-20): reportError existed and was wired into exactly one file.
// The revenue path (stripe checkout) failed with a bare console.error, and the
// brief-ingest cron answered a hardcoded `ok: true` that survived every official
// source being unreachable — a run could ingest nothing and still report success.
// With ALERT_WEBHOOK_URL unset the whole mechanism is dormant, so the failure mode
// was: nothing pages anyone, and the one signal that did exist was lying.
//
// SCOPE IS DELIBERATELY NARROW — launch-critical surfaces only, not coverage for its
// own sake: stripe checkout, stripe webhook, and the two scheduled jobs. The auth and
// document/PII paths are NOT instrumented here because they contain no catch blocks
// and no console.error to convert; adding reporting there would mean inventing error
// paths, which is a different change.
import { readFileSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function check(label: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; console.error(`  FAIL ${label}`); }
}

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const checkout = read("app/api/stripe/checkout/route.ts");
const webhook = read("app/api/stripe/webhook/route.ts");
const ingestRoute = read("app/api/cron/brief-ingest/route.ts");
const digestRoute = read("app/api/cron/brief-digest/route.ts");
const ingestLib = read("lib/briefIngest.ts");
const observability = read("lib/observability.ts");
const alertTestRoute = read("app/api/admin/alerts/test/route.ts");

console.log("\ncritical paths report failures");
check("stripe checkout reports its catch", /reportError\(/.test(checkout));
check("stripe checkout no longer relies on a bare console.error",
  !/console\.error\("stripe checkout error"/.test(checkout));
check("stripe webhook still reports (pre-existing, must not regress)",
  (webhook.match(/reportError\(/g) || []).length >= 2);
check("brief-ingest cron reports", /reportError\(/.test(ingestRoute));
check("brief-digest cron reports", /reportError\(/.test(digestRoute));

console.log("\nfailures are reported with a correlation id and safe identifiers only");
check("checkout attaches a requestId", /requestId:\s*requestId\(req\)/.test(checkout));
check("both crons attach a requestId",
  /requestId:\s*rid/.test(ingestRoute) && /requestId:\s*rid/.test(digestRoute));
check("each report carries a stable scope/operation name",
  /scope:\s*["']stripe-checkout["']/.test(checkout) &&
  /scope:\s*["']cron-brief-ingest["']/.test(ingestRoute) &&
  /scope:\s*["']cron-brief-digest["']/.test(digestRoute));
// The alert payload must never carry credentials, documents, credit data, or the
// raw request. userId/plan are safe identifiers; a request body is not.
//
// Scope this to the reportError CALL SITES, not the whole file: the cron routes
// legitimately read process.env.CRON_SECRET for authorization, and a whole-file
// grep would fail on that correct code.
function alertPayloadsOf(src: string): string {
  const out: string[] = [];
  let i = src.indexOf("reportError(");
  while (i > -1) {
    // Take up to the end of the call — depth-count parens so nested objects are included.
    let depth = 0, j = i + "reportError".length;
    for (; j < src.length; j++) {
      if (src[j] === "(") depth++;
      else if (src[j] === ")") { depth--; if (depth === 0) { j++; break; } }
    }
    out.push(src.slice(i, j));
    i = src.indexOf("reportError(", j);
  }
  return out.join("\n");
}
const alertPayloads = [checkout, ingestRoute, digestRoute, webhook].map(alertPayloadsOf).join("\n");
check("reportError call sites were actually located (the check is not vacuous)",
  alertPayloads.length > 0 && (alertPayloads.match(/reportError\(/g) || []).length >= 5);
check("no secret or raw body is sent to the alert channel",
  !/STRIPE_SECRET_KEY|ANTHROPIC_API_KEY|CRON_SECRET|DOCUMENT_ENCRYPTION_KEY|NEXTAUTH_SECRET/.test(alertPayloads) &&
  !/body:\s*body\b|rawText|password|\bsecret\b/.test(alertPayloads));

console.log("\ncron endpoints cannot report a dishonest success");
check("brief-ingest no longer hardcodes ok: true", !/\{\s*ok:\s*true,\s*\.\.\.result\s*\}/.test(ingestRoute));
check("brief-ingest DERIVES ok from the run result", /const ok = result\.feedErrors === 0/.test(ingestRoute));
check("an unreachable feed is counted, not just logged",
  (ingestLib.match(/result\.feedErrors\+\+/g) || []).length === 2);
check("feedErrors is part of the result contract", /feedErrors:\s*number/.test(ingestLib));
check("a throw in either cron returns a non-200",
  /status:\s*500/.test(ingestRoute) && /status:\s*500/.test(digestRoute));

console.log("\nreporting can never break the product path");
check("reportError never throws (fire-and-forget, catch swallowed)",
  /\.catch\(\(\)\s*=>\s*\{\}\)/.test(observability));
check("reportError is dormant, not fatal, when ALERT_WEBHOOK_URL is unset",
  /if \(!url\) return \{ delivered: false, reason: "not_configured" \}/.test(observability));
check("awaited delivery rejects non-2xx webhook responses",
  /if \(!response\.ok\)/.test(observability) && /reason: "rejected"/.test(observability));
check("awaited delivery has a bounded network wait",
  /const ALERT_TIMEOUT_MS = 5_000/.test(observability) &&
  /AbortSignal\.timeout\(ALERT_TIMEOUT_MS\)/.test(observability));
check("awaited delivery refuses redirects rather than forwarding alert data",
  /redirect:\s*["']error["']/.test(observability));
check("the customer-facing checkout response is unchanged on failure",
  /Could not start checkout\. Please try again\./.test(checkout));

console.log("\nadmin synthetic alert is a closed, constant-input capability");
const adminAt = alertTestRoute.indexOf("await requireAdmin()");
const limitAt = alertTestRoute.indexOf("await enforceRateLimit(");
const deliveryAt = alertTestRoute.indexOf("await deliverAlertWebhook(");
const executableAlertRoute = alertTestRoute.replace(/\/\/.*$/gm, "");
check("the route is POST-only and accepts no Request object",
  /export async function POST\(\)/.test(alertTestRoute) && !/export async function GET/.test(alertTestRoute));
check("admin authority and abuse control precede delivery",
  adminAt > -1 && limitAt > adminAt && deliveryAt > limitAt);
check("the exact synthetic text is constant in source",
  alertTestRoute.includes("CreditVector RC1 readiness test — synthetic production alert. No action required."));
check("the route never reads caller body, query, message, or destination",
  !/(?:req|request)\s*\.\s*(?:json|text)\s*\(|searchParams|destination|webhookUrl/i.test(executableAlertRoute));

console.log("\nStripe pre-verification traffic cannot trigger external alerts");
const postBody = webhook.slice(webhook.indexOf("export async function POST"));
const authenticatedAt = postBody.indexOf("if (!HANDLED_EVENT_TYPES.has(event.type))");
const preVerification = postBody.slice(0, authenticatedAt);
check("pre-verification Stripe handling has no external-alert primitive",
  authenticatedAt > -1 &&
  !/\b(?:reportError|deliverAlertWebhook|fetch)\s*\(/.test(preVerification));
check("Stripe imports only reportError from the observability boundary",
  /import\s*\{\s*reportError\s*\}\s*from\s*["']@\/lib\/observability["']/.test(webhook));
check("invalid Stripe signatures retain local structured logging",
  /log\.warn\("Stripe webhook signature rejected"/.test(preVerification));

console.log(`\nobservability.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
