"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { AuthLayout } from "@/components/marketing/AuthLayout";
import { validatePassword } from "@/lib/password";

// useSearchParams must be inside a Suspense boundary for the App Router build.
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetInner />
    </Suspense>
  );
}

function ResetInner() {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const policyHint = password.length > 0 ? validatePassword(password) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const pwErr = validatePassword(password);
    if (pwErr) { setErr(pwErr); return; }
    if (password !== confirm) { setErr("Passwords don't match."); return; }
    setBusy(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(j.error || "Could not reset your password."); return; }
    setDone(true);
    setTimeout(() => router.push("/login"), 1800);
  }

  if (!token) {
    return (
      <AuthLayout heading="Reset link missing" subheading="This page needs a valid reset link.">
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-3 text-sm text-rose-300">
          This reset link is invalid or incomplete.{" "}
          <Link href="/forgot-password" className="font-medium underline hover:text-rose-200">Request a new one</Link>.
        </p>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout heading="Password updated" subheading="You're all set.">
        <div className="flex items-start gap-3 rounded-lg border border-success-500/30 bg-success-500/10 px-3 py-3 text-sm text-success-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Your password has been reset. Redirecting you to sign in…</p>
        </div>
        <Link href="/login" className="btn-primary btn-lg mt-4 w-full">Go to sign in</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout heading="Set a new password" subheading="Choose a strong password you don't use elsewhere.">
      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label htmlFor="password" className="label">New password</label>
          <div className="relative">
            <input
              id="password"
              type={show ? "text" : "password"}
              className="input pr-10"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute inset-y-0 right-0 grid w-10 place-items-center text-slate-400 transition hover:text-slate-200"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {policyHint && <p className="mt-1.5 text-xs text-slate-400">{policyHint}</p>}
        </div>

        <div>
          <label htmlFor="confirm" className="label">Confirm new password</label>
          <input
            id="confirm"
            type={show ? "text" : "password"}
            className="input"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>

        {err && (
          <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {err}
          </p>
        )}

        <button className="btn-primary btn-lg w-full" disabled={busy || !password || !confirm}>
          {busy ? (<><Loader2 className="h-4 w-4 animate-spin" /> Updating…</>) : "Update password"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        <Link href="/login" className="font-medium text-brand-300 transition hover:text-brand-200">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
