"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Gauge } from "lucide-react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const res = await fetch("/api/register", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const j = await res.json();
    if (!res.ok) { setErr(j.error || "Could not create account"); setBusy(false); return; }
    const s = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (s?.error) setErr("Account created — please sign in."); else router.push("/dashboard");
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-6">
        <div className="mb-5 flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500 text-ink-950"><Gauge className="h-5 w-5" /></div>
          <span className="font-semibold">Create your account</span>
        </div>
        <label className="label">Name</label>
        <input className="input mb-3" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="label">Email</label>
        <input className="input mb-3" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label className="label">Password (min 8 chars)</label>
        <input className="input mb-4" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        {err && <p className="mb-3 text-xs text-rose-400">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
        <p className="mt-4 text-center text-[11px] text-slate-500">Already have an account? <Link href="/login" className="text-brand-400">Sign in</Link></p>
      </form>
    </div>
  );
}
