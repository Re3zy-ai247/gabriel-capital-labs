"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Gauge } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) setErr("Invalid credentials"); else router.push("/dashboard");
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-6">
        <div className="mb-5 flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500 text-ink-950"><Gauge className="h-5 w-5" /></div>
          <span className="font-semibold">Gabriel Capital Labs</span>
        </div>
        <label className="label">Email or username</label>
        <input className="input mb-3" placeholder="you@example.com or username" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="label">Password</label>
        <input type="password" className="input mb-4" value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <p className="mb-3 text-xs text-rose-400">{err}</p>}
        <button className="btn-primary w-full">Sign in</button>
        <p className="mt-4 text-center text-[11px] text-slate-500">New here? <a href="/register" className="text-brand-400">Create an account</a></p>
      </form>
    </div>
  );
}
