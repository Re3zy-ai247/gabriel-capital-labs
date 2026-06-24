"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/marketing/AuthLayout";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (res?.error) setErr("We couldn't sign you in. Check your details and try again.");
    else router.push("/dashboard");
  }

  return (
    <AuthLayout heading="Welcome back" subheading="Sign in to pick up where you left off.">
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
    </AuthLayout>
  );
}
