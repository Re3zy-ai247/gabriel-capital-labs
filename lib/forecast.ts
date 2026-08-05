// Engine 3 (Outcome Intelligence) — Tier A: single-user, own-data forecast.
// ADR-0010 / INTELLIGENCE-LAYER.md. Predictive of TIMELINE and OPTIONS only —
// never of the result (CROA: no probability of deletion/score change). Reads
// ONLY the requesting user's own letters + the FCRA §611 statutory clock; no
// cross-user data, no AI, no consent surface needed. This is the gate-free seed
// of the compounding loop: the outcome record it reads is what Engine 1 will
// later aggregate anonymously (post-consent, post-CCO).

const DAY = 86_400_000;
export const REINVESTIGATION_DAYS = 30; // FCRA §611(a)(1)

// Phase 1A honesty triple (SIM-REVIEW finding 2, launch-blocking): the §611
// clock is RECEIPT-anchored by statute — it starts when the bureau gets the
// dispute, not when it's mailed. A self-mailed letter has no delivery receipt
// (that's Send-with-CreditVector-Fulfillment's certified-mail evidence, not
// available here), so every window estimate below uses this conservative,
// documented transit allowance instead of reading mailedAt as the clock start.
// USPS's own published domestic First-Class Mail estimate is 1-5 business
// days; using the upper end means the estimate never assumes the bureau
// received it earlier than USPS's own stated worst case — so a window is
// never reported as closer to closing (or already closed) than it plausibly
// is. This is an ESTIMATE, not tracking: no delivery confirmation exists for
// a self-mailed letter.
export const MAIL_TRANSIT_DAYS = 5;

// Days elapsed against the ESTIMATED receipt date (mailedAt + the transit
// allowance), never against the mailing date itself. Floors at zero so a
// letter mailed within the transit allowance reads as "0 days on the clock,"
// not a negative number — the clock hasn't estimably started yet.
export function daysElapsedSinceEstimatedReceipt(mailedAtMs: number, now: number = Date.now()): number {
  const daysSinceMailed = Math.max(0, Math.floor((now - mailedAtMs) / DAY));
  return Math.max(0, daysSinceMailed - MAIL_TRANSIT_DAYS);
}

export interface ForecastLetterInput {
  id: string;
  targetBureau: string | null;
  mailedAt: Date | string | null;
  responseAt: Date | string | null;
  round: number;
  status: string;
}

function toTime(d: Date | string | null): number | null {
  if (!d) return null;
  const t = (typeof d === "string" ? new Date(d) : d).getTime();
  return isNaN(t) ? null : t;
}

// Median days mailed→response across the user's OWN answered letters. Optionally
// scoped to one bureau. Returns null below a minimum sample so we never present
// one data point as a pattern (BI Art. II — thin data discloses itself).
export function ownResponseLatencyDays(
  letters: ForecastLetterInput[],
  bureau?: string | null,
  minSample = 3 // a "median" needs ≥3 own observations to read as earned (FTC substantiation)
): { medianDays: number; sample: number } | null {
  const spans: number[] = [];
  for (const l of letters) {
    if (bureau && l.targetBureau !== bureau) continue;
    const m = toTime(l.mailedAt);
    const r = toTime(l.responseAt);
    if (m != null && r != null && r >= m) spans.push(Math.round((r - m) / DAY));
  }
  if (spans.length < minSample) return null;
  spans.sort((a, b) => a - b);
  const mid = Math.floor(spans.length / 2);
  const median = spans.length % 2 ? spans[mid] : Math.round((spans[mid - 1] + spans[mid]) / 2);
  return { medianDays: median, sample: spans.length };
}

// The four FCRA outcomes a reinvestigation can produce, each with its statutory
// meaning and the user's next move. Educational enumeration — NOT a prediction
// of which will occur.
export const POSSIBLE_RESPONSES: { outcome: string; meaning: string; next: string }[] = [
  { outcome: "Deleted", meaning: "The item is removed from this bureau's report.", next: "Watch your next report — reinsertion requires the bureau to notify you (§611(a)(5))." },
  { outcome: "Corrected", meaning: "The bureau updated a field it couldn't verify as reported.", next: "Compare the change against your records; a partial fix can still leave inaccurate data." },
  { outcome: "Verified", meaning: "The bureau claims the furnisher confirmed the item.", next: "You can demand the method of verification — how, exactly, they checked (§611(a)(7))." },
  { outcome: "No response", meaning: "Nothing substantive arrives within the window.", next: "A non-answer doesn't satisfy §611 — that failure itself is grounds to escalate." },
];

export interface Forecast {
  daysElapsed: number;
  daysLeft: number; // negative = statutory window has passed
  pastWindow: boolean;
  windowText: string;
  ownHistoryText: string | null; // own-data note, or null when data is too thin
  contingency: string;
}

// Per mailed-but-unanswered letter: where the §611 clock stands, what the user's
// OWN bureaus have historically done (if enough data), and the contingency path.
export function forecastFor(
  letter: ForecastLetterInput,
  ownLatency: { medianDays: number; sample: number } | null,
  now: number = Date.now()
): Forecast | null {
  const m = toTime(letter.mailedAt);
  if (m == null || letter.status !== "MAILED") return null;

  // Receipt-anchored, not mailing-anchored (see MAIL_TRANSIT_DAYS above).
  const daysElapsed = daysElapsedSinceEstimatedReceipt(m, now);
  const daysLeft = REINVESTIGATION_DAYS - daysElapsed;
  const pastWindow = daysLeft <= 0;

  const windowText = pastWindow
    ? `The §611 window starts when the bureau receives your dispute, not when you mail it — estimating ~${MAIL_TRANSIT_DAYS} days for it to arrive, the ~${REINVESTIGATION_DAYS}-day window has likely passed (bureaus can take up to 45 days if you sent more information mid-review). If nothing substantive arrived, that's grounds to follow up or escalate.`
    : `The bureau owes a reinvestigation within ~${REINVESTIGATION_DAYS} days of RECEIVING this, not mailing it — estimating ~${MAIL_TRANSIT_DAYS} days for delivery, about ${daysLeft} day${daysLeft === 1 ? "" : "s"} are left on the statutory clock. This is an estimate; self-mailed letters aren't tracked.`;

  // Own-data note only when we have a real sample; framed as observed history,
  // never a prediction. "By day N of the window" is factual context, not a promise.
  const ownHistoryText =
    ownLatency && !pastWindow
      ? `Your bureaus have answered in a median of ${ownLatency.medianDays} day${ownLatency.medianDays === 1 ? "" : "s"} across your ${ownLatency.sample} logged responses so far.`
      : null;

  const contingency = pastWindow
    ? "Next: log any response you did get, or send a §611(a)(7) method-of-verification demand; if the bureau stalls, the CFPB complaint path is open."
    : "If it comes back “verified,” the method-of-verification demand is the counter; a non-response by the deadline opens the §623 furnisher dispute and CFPB paths — all already mapped for you.";

  return { daysElapsed, daysLeft, pastWindow, windowText, ownHistoryText, contingency };
}
