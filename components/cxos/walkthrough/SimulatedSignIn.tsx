"use client";

// CXOS Phase 1A-CX2 (C) — the new-visitor branch's authentication beat.
//
// TRUTH BOUNDARY: "The simulated sign-in beat is a labeled theatrical beat,
// not a form." Deliberately NOT a <form> and NOT a real <input> — a real,
// focusable text field (even one that submits nowhere) would still LOOK and
// behave like a data-collecting control. The "fields" below are inert,
// aria-hidden decoration; the one real, focusable, labeled control is the
// Continue button. This mirrors the house pattern already used for other
// decorative mockups on the real landing page (app/page.tsx's
// KaiChatVisual/AgencyRosterVisual: `<div aria-hidden>` visual + real
// surrounding text for assistive tech).
//
// Does not import, call, or reference any real auth module — no next-auth,
// no @/lib/auth, no @/lib/session, no network request of any kind.
export function SimulatedSignIn({ onContinue }: { onContinue: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink-950 px-6 py-20 text-center text-white">
      <p className="rounded-full border border-gold-400/40 bg-gold-400/10 px-3 py-1 text-[11px] font-bold tracking-widest text-gold-400">
        SIMULATED SIGN-IN — no credentials, no session
      </p>
      <h1 className="h-display text-2xl md:text-3xl">Welcome back to CreditVector</h1>

      <div
        aria-hidden
        className="w-full max-w-sm space-y-3 rounded-2xl border border-ink-700/60 bg-ink-900/50 p-6 text-left"
      >
        <div className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            Email
          </span>
          <div className="rounded-lg border border-ink-700 bg-ink-800/60 px-3 py-2 text-sm text-slate-500">
            operator@example.com
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            Password
          </span>
          <div className="rounded-lg border border-ink-700 bg-ink-800/60 px-3 py-2 text-sm tracking-widest text-slate-500">
            ••••••••••
          </div>
        </div>
      </div>

      <p className="max-w-sm text-xs leading-relaxed text-slate-500">
        This is a theatrical placeholder for the walkthrough&apos;s narrative only. Nothing
        above is a real input — nothing is typed, collected, sent, or stored, and
        CreditVector&apos;s real sign-in page is untouched.
      </p>

      <button type="button" onClick={onContinue} className="btn-primary btn-lg">
        Continue — enter CreditVector
      </button>
    </main>
  );
}
