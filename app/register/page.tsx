"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Check } from "lucide-react";
import { AuthLayout } from "@/components/marketing/AuthLayout";

export default function RegisterPage() {
  const [name, setName] = useState("");
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
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    }).catch(() => null);
    if (!res) {
      setBusy(false);
      setErr("The connection dropped mid-request. Try again — nothing was lost.");
      return;
    }
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(j.error || "We couldn't create your account. Please try again.");
      setBusy(false);
      return;
    }
    const s = await signIn("credentials", { email, password, redirect: false }).catch(() => null);
    setBusy(false);
    if (!s) { setErr("Your account is ready — please sign in."); return; }
    if (s?.error) setErr("Your account is ready — please sign in.");
    // New accounts land on the real front door — five steps, each one honestly
    // marked as it's actually completed (Phase 1A, ROOM-RECOMMENDATIONS row 7).
    else router.push("/onboarding");
  }

  return (
    <AuthLayout heading="Create your account" subheading="Free to start — no card required. See your reports in minutes.">
      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label htmlFor="name" className="label">Name</label>
          <input id="name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <div>
          <label htmlFor="password" className="label">Password</label>
          <div className="relative">
            <input
              id="password"
              type={show ? "text" : "password"}
              className="input pr-10"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
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
          <p className={`mt-1.5 flex items-center gap-1.5 text-xs ${password.length >= 8 ? "text-success-400" : "text-slate-500"}`}>
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> At least 8 characters
          </p>
        </div>

        {err && (
          <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {err}
          </p>
        )}

        <button className="btn-primary btn-lg w-full" disabled={busy}>
          {busy ? (<><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>) : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        Already have an account? <Link href="/login" className="font-medium text-brand-300 transition hover:text-brand-200">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
