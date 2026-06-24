"use client";
import { useState } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { AuthLayout } from "@/components/marketing/AuthLayout";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      /* generic UX regardless — see below */
    }
    setBusy(false);
    setSent(true); // always show the same confirmation (anti-enumeration)
  }

  return (
    <AuthLayout heading="Reset your password" subheading="We'll email you a secure link to set a new one.">
      {sent ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-success-500/30 bg-success-500/10 px-3 py-3 text-sm text-success-200">
            <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              If an account exists for <span className="font-medium">{email}</span>, we&apos;ve sent a password reset
              link. Check your inbox (and spam) — the link expires in 1 hour.
            </p>
          </div>
          <Link href="/login" className="btn-ghost w-full">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button className="btn-primary btn-lg w-full" disabled={busy || !email}>
            {busy ? (<><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>) : "Send reset link"}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-slate-400">
        Remembered it? <Link href="/login" className="font-medium text-brand-300 transition hover:text-brand-200">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
