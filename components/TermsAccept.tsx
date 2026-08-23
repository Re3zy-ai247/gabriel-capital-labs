"use client";

// Terms-of-Service acceptance, as a form field.
//
// ADOPTED from the m2 lane (4ece50622b1e6b1a3f7c9cb40aef3dd411d5b80d,
// components/TermsAccept.tsx) and ADAPTED for RC1-S8. What changed and why:
//
//   · m2's component was a standalone recovery card for a 428 challenge on the
//     paid Stripe upgrade — it owned its own confirm button and read the terms
//     version out of the server's refusal body. RC1's gate is registration, an
//     ordinary form the user is already filling in, so this is a FIELD inside
//     that form: the parent owns the submit button and the state.
//   · m2's `readTermsChallenge` is NOT carried over. There is no 428 challenge
//     on this path and nothing would call it; an unused consent helper is a
//     helper nobody keeps correct.
//   · Rule 3 got STRICTER rather than weaker. m2 echoed the server's version
//     back so the server could validate the echo. Registration sends no version
//     at all — the client asserts only "I accepted", and the server records its
//     own published constant (lib/terms.ts CURRENT_TERMS_VERSION). A client that
//     cannot name a version cannot choose which terms it is deemed to have
//     accepted.
//
// THE RULES THIS COMPONENT STILL ENFORCES (unchanged from m2)
//  1. UNCHECKED BY DEFAULT, always. The value is a required prop with no
//     default and there is no `defaultChecked` anywhere; the parent seeds it
//     `false`. A pre-checked box is not an acceptance.
//  2. It links to the CURRENTLY PUBLISHED documents and states no terms of its
//     own. Nothing here paraphrases, summarises, or adds to what those pages
//     say, and it makes no claim about any outcome.
//  3. The VERSION IS THE SERVER'S. This file contains no version string and no
//     way to construct one.
//  4. The blocked state is ANNOUNCED, never signalled by colour alone: a real
//     <label htmlFor>, an aria-describedby hint that is always present, and a
//     role="alert" message when a submit was refused.
//  5. It renders no status code, no error enum, and no jargon.
import Link from "next/link";
import { useId } from "react";

/** The published documents. Same routes as lib/terms.ts TERMS_URL / PRIVACY_URL. */
export const DEFAULT_TERMS_URL = "/legal/terms";
export const DEFAULT_PRIVACY_URL = "/legal/privacy";

export interface TermsAcceptFieldProps {
  /** Current value. Owned by the parent form; seeded false. Never defaulted here. */
  accepted: boolean;
  onChange: (next: boolean) => void;
  /**
   * True once a submit was attempted with the box unchecked. Renders the
   * announced refusal. The parent must also refuse the submit itself — this
   * field is how the user SATISFIES the gate, never where the gate lives.
   */
  blocked?: boolean;
  disabled?: boolean;
  className?: string;
}

export function TermsAcceptField({
  accepted,
  onChange,
  blocked = false,
  disabled = false,
  className = "",
}: TermsAcceptFieldProps) {
  const uid = useId();
  const boxId = `${uid}-accept`;
  const errorId = `${uid}-error`;
  const hintId = `${uid}-hint`;

  return (
    <div className={className}>
      <div className="flex items-start gap-3">
        <input
          id={boxId}
          type="checkbox"
          checked={accepted}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={blocked ? errorId : hintId}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
        />
        <label htmlFor={boxId} className="cursor-pointer text-sm leading-relaxed text-slate-300">
          I have read and agree to the{" "}
          <Link
            href={DEFAULT_TERMS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand-300 underline underline-offset-2 hover:text-brand-200"
          >
            Terms of Service
          </Link>{" "}
          and the{" "}
          <Link
            href={DEFAULT_PRIVACY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand-300 underline underline-offset-2 hover:text-brand-200"
          >
            Privacy Policy
          </Link>
          <span className="text-slate-500"> (each opens in a new tab)</span>.
        </label>
      </div>

      {blocked ? (
        <p id={errorId} role="alert" className="mt-2 text-sm font-medium text-rose-300">
          Check the box above to agree to the Terms of Service and Privacy Policy before creating your account.
        </p>
      ) : (
        // Always present, so the requirement is readable before it is hit.
        <p id={hintId} className="mt-2 text-xs text-slate-500">
          Required. We record which version you agreed to and when.
        </p>
      )}
    </div>
  );
}
