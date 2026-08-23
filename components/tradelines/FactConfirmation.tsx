"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// RC1-S4 — the consumer confirms WHICH fact is wrong, in their own name.
//
// This is the only place in the product where a factual claim about a
// consumer's account can be created, and the only actor who can create one is
// the consumer. Nothing here is pre-selected, nothing is pre-checked, and no
// suggestion is ever submitted on their behalf: `suggested` only REORDERS the
// choices, which is why suggested items carry a plain "worth checking" hint
// rather than a recommendation to assert them.
//
// It is free. There is no upgrade prompt, credit counter, or gated control in
// this component, deliberately.

export interface ConfirmChoice {
  type: string;
  prompt: string;
  help: string;
  requiresNote: boolean;
}

export interface ExistingAssertion {
  id: string;
  assertionType: string;
  prompt: string; // resolved server-side so this component needs no lookup table
  consumerNote: string | null;
  bureauScope: string | null;
  bureauLabel: string | null;
  createdAt: string;
}

export interface FactConfirmationProps {
  tradelineId: string;
  creditorName: string;
  choices: ConfirmChoice[];
  existing: ExistingAssertion[];
  /** Bureaus that actually report this account, for the optional scope picker. */
  bureaus: { value: string; label: string }[];
  /** Types worth a look on an item of this kind. Ordering hint only. */
  suggested: string[];
  noteMax: number;
}

export function FactConfirmation({
  tradelineId,
  creditorName,
  choices,
  existing,
  bureaus,
  suggested,
  noteMax,
}: FactConfirmationProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>("");
  const [note, setNote] = useState("");
  const [scope, setScope] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = choices.find((c) => c.type === type) ?? null;
  const noteRequired = selected?.requiresNote === true;
  const overLong = note.trim().length > noteMax;
  const canSubmit = Boolean(type) && !busy && !overLong && (!noteRequired || note.trim().length > 0);

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tradelines/${tradelineId}/assertion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assertionType: type,
          consumerNote: note.trim() || null,
          bureauScope: scope || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "That didn't save. Please try again.");
        return;
      }
      setType("");
      setNote("");
      setScope("");
      setOpen(false);
      router.refresh();
    } catch {
      setError("That didn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(assertionId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/tradelines/${tradelineId}/assertion?assertionId=${encodeURIComponent(assertionId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data?.error === "string" ? data.error : "That didn't save. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("That didn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900/40 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">The facts on this account</h4>
        <p className="text-[11px] text-slate-400">
          You are the factual authority — CreditVector drafts only from what you confirm.
        </p>
      </div>

      {existing.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {existing.map((a) => (
            <li key={a.id} className="rounded border border-ink-700 bg-ink-800/50 p-2.5 text-xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-200">{a.prompt}</p>
                  {a.consumerNote && (
                    <p className="mt-1 break-words text-slate-400">
                      In your words: &ldquo;{a.consumerNote}&rdquo;
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-slate-500">
                    Confirmed by you{a.bureauLabel ? ` about your ${a.bureauLabel} file` : ""} on{" "}
                    {new Date(a.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => withdraw(a.id)}
                  disabled={busy}
                  className="shrink-0 rounded border border-ink-600 px-2 py-1 text-[11px] text-slate-300 hover:border-ink-500 hover:bg-ink-700 disabled:opacity-50"
                >
                  Withdraw
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-slate-400">
          You haven&apos;t confirmed anything about this account yet. Nothing will be written in your name until you do.
        </p>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 inline-flex min-h-[44px] items-center text-xs font-semibold text-brand-400 underline-offset-2 hover:text-brand-300 hover:underline"
        >
          {existing.length ? "Confirm another fact" : "Review the facts"} →
        </button>
      ) : (
        <div className="mt-3 space-y-3">
          <fieldset>
            <legend className="text-xs text-slate-300">
              What is wrong about <span className="font-medium">{creditorName}</span>? Choose what you know to be true.
            </legend>
            <div className="mt-2 space-y-1.5">
              {choices.map((c) => (
                <label
                  key={c.type}
                  className={`flex cursor-pointer items-start gap-2 rounded border p-2 text-xs ${
                    type === c.type ? "border-brand-500/60 bg-brand-500/10" : "border-ink-700 hover:border-ink-600"
                  }`}
                >
                  <input
                    type="radio"
                    name={`assert-${tradelineId}`}
                    value={c.type}
                    checked={type === c.type}
                    onChange={() => setType(c.type)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="font-medium text-slate-200">{c.prompt}</span>
                    {suggested.includes(c.type) && (
                      <span className="ml-2 pill border border-ink-600 bg-ink-700/60 text-[10px] text-slate-400">
                        worth checking
                      </span>
                    )}
                    <span className="mt-0.5 block text-slate-400">{c.help}</span>
                  </span>
                </label>
              ))}
            </div>
            {/* REMEDIATION L-4 (partial): the letter states the chosen fact as
                the consumer's own statement and asks for it to be verified. The
                exact sentences are not previewed here (the full body is visible
                before printing); this says what shape they take, so the consumer
                is not surprised by the register of what they sign. */}
            <p className="mt-2 text-[11px] text-slate-500">
              Whatever you choose, the letter states it as your own statement and asks for it to be verified against the
              original records. It never claims a law was broken and never promises a result.
            </p>
          </fieldset>

          <div>
            <label htmlFor={`note-${tradelineId}`} className="label">
              In your own words {noteRequired ? "(required)" : "(optional)"}
            </label>
            <textarea
              id={`note-${tradelineId}`}
              className="input min-h-[72px]"
              value={note}
              /* REMEDIATION L-5: the same cap the server enforces, so the
                 consumer is stopped at the limit rather than typing twice it
                 and then being told to cut it down. */
              maxLength={noteMax}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What do you know about this account that the report gets wrong?"
            />
            <p className={`mt-1 text-[11px] ${overLong ? "text-rose-300" : "text-slate-500"}`}>
              {overLong
                ? `Please shorten this to ${noteMax} characters or fewer — your words go into the letter exactly as you write them, so we won't cut them off for you.`
                : `Goes into the letter exactly as you write it. ${Math.max(0, noteMax - note.length)} characters left.`}
            </p>
          </div>

          {bureaus.length > 1 && (
            <div>
              <label htmlFor={`scope-${tradelineId}`} className="label">
                Which file is this about? (optional)
              </label>
              <select
                id={`scope-${tradelineId}`}
                className="input"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                <option value="">Every bureau reporting this account</option>
                {bureaus.map((b) => (
                  <option key={b.value} value={b.value}>
                    Only my {b.label} file
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-xs text-rose-300">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={submit} disabled={!canSubmit} className="btn-primary !py-1.5 text-xs disabled:opacity-50">
              {busy ? "Saving…" : "Confirm this"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              disabled={busy}
              className="btn-ghost !py-1.5 text-xs"
            >
              Cancel
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            You can withdraw any confirmation at any time. Withdrawing it stops it being used in anything drafted from
            here on.
          </p>
        </div>
      )}
    </div>
  );
}
