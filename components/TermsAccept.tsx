"use client";

// Terms-of-Service acceptance at the point of an in-place plan change — the UI
// half of B-06. The enforcement half lives in app/api/stripe/checkout/route.ts
// and is NOT this component's job: the route answers 428 when the signed-in
// account has no recorded acceptance of the published terms, and it refuses the
// Stripe mutation whether or not any UI ever rendered. This component exists so
// a customer can SATISFY that gate instead of hitting a dead end.
//
// THE RULES THIS COMPONENT ENFORCES
//  1. UNCHECKED BY DEFAULT, always. `accepted` is component-local state seeded
//     `false` on every mount — there is no prop, no default, and no persisted
//     value that can pre-check it. A pre-checked box is not an acceptance.
//  2. It links to the CURRENTLY PUBLISHED terms and states no terms of its own.
//     Nothing here paraphrases, summarises, or adds to what /legal/terms says.
//  3. The VERSION IS THE SERVER'S. This file contains no version string and no
//     way to construct one. `readTermsChallenge` reads the version out of the
//     server's own 428 body so the caller can echo it back as an assertion; the
//     route validates that assertion against its published constant and records
//     the constant, never the echo. A client cannot choose which terms it is
//     deemed to have accepted.
//  4. The confirm action is BLOCKED until acceptance is explicit — `aria-disabled`
//     (so the control stays focusable and screen readers announce the state)
//     plus a hard early return in the handler, plus always-visible text saying
//     why. Never colour alone.
//  5. It renders the server's human-readable reason. No status code, no error
//     enum, and no jargon reaches the customer.
import Link from "next/link";
import { useId, useState } from "react";

/** The currently published terms page. Same route as lib/terms.ts TERMS_URL. */
export const DEFAULT_TERMS_URL = "/legal/terms";

/**
 * Used only if the server sent a 428 with no message of its own. Deliberately a
 * restatement of the route's own wording — this file invents no legal language.
 */
const FALLBACK_MESSAGE = "Please review and accept the Terms of Service to continue.";

/** What the server asked for, as read off its 428 response. */
export interface TermsChallenge {
  /** The server's human-readable reason, shown verbatim to the customer. */
  message: string;
  /** The published revision, echoed back on retry. Server-owned — never built here. */
  version: string;
  /** Where the customer reads what they are accepting. */
  url: string;
}

/**
 * Recognise the acceptance precondition on a checkout response.
 *
 * Returns null for every other outcome, so callers keep their existing success
 * and error handling untouched. Returns null too when the server did not name a
 * version: without one there is nothing honest to ask the customer to accept,
 * and the generic error path is the correct fallback. Nothing is inferred and no
 * version is manufactured.
 */
export function readTermsChallenge(res: Response, data: unknown): TermsChallenge | null {
  if (res.status !== 428) return null;
  const body = (data ?? {}) as Record<string, unknown>;
  if (body.termsRequired !== true) return null;
  const version = typeof body.termsVersion === "string" ? body.termsVersion : "";
  if (!version) return null;
  return {
    message: typeof body.error === "string" && body.error ? body.error : FALLBACK_MESSAGE,
    version,
    url: typeof body.termsUrl === "string" && body.termsUrl ? body.termsUrl : DEFAULT_TERMS_URL,
  };
}

export interface TermsAcceptProps {
  /** The server's reason for asking. Rendered as written. */
  message: string;
  /** Terms link, from the server's 428 body. Falls back to the published page. */
  termsUrl?: string;
  /** True while the retry is in flight. */
  busy?: boolean;
  /** Called ONLY after the customer explicitly checked the box. */
  onAccept: () => void;
  /** Optional dismiss. The customer keeps whatever they had entered either way. */
  onCancel?: () => void;
  confirmLabel?: string;
  className?: string;
}

export function TermsAccept({
  message,
  termsUrl,
  busy = false,
  onAccept,
  onCancel,
  confirmLabel = "Agree and continue",
  className = "",
}: TermsAcceptProps) {
  const uid = useId();
  const boxId = `${uid}-accept`;
  const errorId = `${uid}-error`;
  const hintId = `${uid}-hint`;

  // Seeded false on every mount. Rule 1 — never a prop, never persisted.
  const [accepted, setAccepted] = useState(false);
  const [blocked, setBlocked] = useState(false);

  function confirm() {
    if (busy) return;
    if (!accepted) {
      // The request is BLOCKED here, and the reason is announced rather than
      // silently swallowed by a non-focusable disabled button.
      setBlocked(true);
      return;
    }
    onAccept();
  }

  return (
    <div
      role="group"
      aria-label="Terms of Service acceptance"
      className={`rounded-lg border border-ink-700 bg-ink-900/60 p-4 text-left ${className}`}
    >
      <p className="text-sm text-slate-300">{message}</p>

      <div className="mt-3 flex items-start gap-3">
        <input
          id={boxId}
          type="checkbox"
          checked={accepted}
          onChange={(e) => {
            setAccepted(e.target.checked);
            if (e.target.checked) setBlocked(false);
          }}
          aria-describedby={blocked ? errorId : hintId}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
        />
        <label htmlFor={boxId} className="cursor-pointer text-sm leading-relaxed text-slate-300">
          I have read and agree to the{" "}
          <Link
            href={termsUrl || DEFAULT_TERMS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand-300 underline underline-offset-2 hover:text-brand-200"
          >
            Terms of Service
          </Link>
          <span className="text-slate-500"> (opens in a new tab)</span>.
        </label>
      </div>

      {blocked ? (
        <p id={errorId} role="alert" className="mt-2 text-sm font-medium text-rose-300">
          Check the box above to agree to the Terms of Service, then choose &ldquo;{confirmLabel}&rdquo;.
        </p>
      ) : (
        // Always-present text, so the unavailable state is readable and not
        // signalled by dimming alone.
        <p id={hintId} className="mt-2 text-xs text-slate-400">
          {accepted
            ? `Thanks — choose "${confirmLabel}" and we'll pick up where you left off.`
            : `"${confirmLabel}" stays unavailable until you check the box.`}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={confirm}
          aria-disabled={!accepted || busy}
          aria-describedby={accepted ? undefined : hintId}
          className={`btn-primary ${!accepted || busy ? "opacity-50" : ""}`}
        >
          {busy ? "Working…" : confirmLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost">
            Not now
          </button>
        )}
      </div>
    </div>
  );
}
