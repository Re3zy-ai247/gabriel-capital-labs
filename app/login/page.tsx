"use client";
import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/marketing/AuthLayout";
import { safeCallbackUrl } from "@/lib/callbackUrl";

// useSearchParams must sit inside a Suspense boundary for the App Router build
// (same shape as app/reset-password/page.tsx and app/letters/page.tsx).
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  // A1-15 / P0-5: the return path a guard recorded when it sent this visitor
  // here. Read once, validated hard (lib/callbackUrl.ts) — an unusable or
  // off-site value silently becomes the dashboard rather than a destination
  // someone else chose. Deep links and post-expiry returns land where the
  // consumer was actually going.
  const params = useSearchParams();
  const returnTo = safeCallbackUrl(params.get("callbackUrl"));
  // A guard sent them here mid-session, so this is a resumption, not a failure —
  // and it reads the same way for the pre-RC1 sessions that lib/auth.ts now
  // correctly declines to honour. Nothing here blames the consumer.
  const returning = params.get("callbackUrl") !== null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    // .catch guards the transport: a network drop must re-enable the button,
    // never strand the spinner.
    const res = await signIn("credentials", { email, password, redirect: false }).catch(() => null);
    setBusy(false);
    if (!res) setErr("We couldn't reach the sign-in service. Check your connection and try again — your account is unchanged.");
    else if (res.error) setErr("We couldn't sign you in. Check your details and try again.");
    else router.push(returnTo);
  }

  return (
    <AuthLayout
      heading="Welcome back"
      subheading={
        returning
          ? "Your session ended, so please sign in again — we'll take you straight back to where you were. Nothing in your file has changed."
          : "Sign in to pick up where you left off."
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label htmlFor="email" className="label">Email or username</label>
          <input
            id="email"
            className="input"
            placeholder="you@example.com or username"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className="label">Password</label>
            <Link href="/forgot-password" className="text-xs font-medium text-brand-300 transition hover:text-brand-200">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={show ? "text" : "password"}
              className="input pr-10"
              autoComplete="current-password"
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
        </div>

        {err && (
          <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {err}
          </p>
        )}

        <button className="btn-primary btn-lg w-full" disabled={busy}>
          {busy ? (<><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>) : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        New to {`CreditVector`}? <Link href="/register" className="font-medium text-brand-300 transition hover:text-brand-200">Create an account</Link>
      </p>
      {/* A1-09: the one escape hatch for someone who cannot get back in was
          reachable only from inside the app. Both of these work signed-out. */}
      <p className="mt-2 text-center text-xs text-slate-500">
        Can&apos;t get in? <Link href="/help" className="font-medium text-slate-400 underline decoration-slate-600 underline-offset-2 transition hover:text-slate-200">Read the help guides</Link>
        {" "}or email{" "}
        <a href="mailto:support@creditvector.app" className="font-medium text-slate-400 underline decoration-slate-600 underline-offset-2 transition hover:text-slate-200">support@creditvector.app</a>.
      </p>
    </AuthLayout>
  );
}
