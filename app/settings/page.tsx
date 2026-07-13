"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EduBanner } from "@/components/Disclaimer";
import { Loader2, Save, Lock, Bell, Mail } from "lucide-react";
import { PushToggle } from "@/components/PushToggle";

interface Profile {
  fullName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  email?: string;
}

const empty: Profile = { fullName: "", addressLine1: "", addressLine2: "", city: "", state: "", zip: "" };

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile>(empty);
  const [email, setEmail] = useState<string>("");
  const [originalEmail, setOriginalEmail] = useState<string>("");
  const [emailPw, setEmailPw] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [digest, setDigest] = useState(false);
  const [digestBusy, setDigestBusy] = useState(false);

  useEffect(() => {
    fetch("/api/brief/digest/preference")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setDigest(Boolean(d.briefDigest)); });
  }, []);

  async function toggleDigest(next: boolean) {
    setDigestBusy(true);
    const prev = digest;
    setDigest(next); // optimistic
    try {
      const res = await fetch("/api/brief/digest/preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscribe: next }),
      });
      if (!res.ok) setDigest(prev);
    } catch {
      setDigest(prev);
    } finally {
      setDigestBusy(false);
    }
  }

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setProfile({
            fullName: data.fullName ?? "",
            addressLine1: data.addressLine1 ?? "",
            addressLine2: data.addressLine2 ?? "",
            city: data.city ?? "",
            state: data.state ?? "",
            zip: data.zip ?? "",
          });
          setEmail(data.email ?? "");
          setOriginalEmail(data.email ?? "");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // True once the user has actually edited the account email — only then do we
  // require (and send) the current password to confirm the identity change.
  const emailChanged = email.trim().toLowerCase() !== originalEmail.trim().toLowerCase();

  const set = (field: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setProfile({ ...profile, [field]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (emailChanged && !emailPw) {
      setStatus("Enter your current password to confirm the email change.");
      return;
    }
    setBusy(true);
    setStatus(null);
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...profile, email, ...(emailChanged ? { currentPassword: emailPw } : {}) }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setStatus(d.error || "Could not save — please try again.");
      return;
    }
    setEmailPw("");
    if (d.emailChanged) setOriginalEmail(email);
    setStatus(
      d.emailChanged
        ? "Saved. Your account email was updated — you can sign in with the new email or your username."
        : "Profile saved. Your dispute letters will use this information."
    );
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (pw.next !== pw.confirm) {
      setPwMsg({ ok: false, text: "New passwords don't match." });
      return;
    }
    setPwBusy(true);
    const res = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }),
    });
    const d = await res.json().catch(() => ({}));
    setPwBusy(false);
    if (res.ok) {
      setPwMsg({ ok: true, text: "Password updated." });
      setPw({ current: "", next: "", confirm: "" });
    } else {
      setPwMsg({ ok: false, text: d.error || "Could not update password." });
    }
  }

  return (
    <AppShell title="/ Settings">
      <EduBanner />
      <div className="max-w-2xl">
        <h2 className="text-xl font-bold mb-1">Your Profile</h2>
        <p className="text-sm text-slate-400 mb-6">
          This name and mailing address appear on your dispute letters, so the bureaus can
          identify you and mail their responses.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Pulling up your account…
          </div>
        ) : (
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Account Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-slate-100 focus:border-brand-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-500">
                Used to sign in (along with your username) and to receive billing receipts. Changing it won&apos;t log you out.
              </p>
              {emailChanged && (
                <div className="mt-3">
                  <label className="block text-sm text-slate-400 mb-1">Confirm current password</label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={emailPw}
                    onChange={(e) => setEmailPw(e.target.value)}
                    placeholder="Required to change your email"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-slate-100 focus:border-brand-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    For your security, confirm your current password to change the account email.
                  </p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Full Legal Name</label>
              <input
                value={profile.fullName}
                onChange={set("fullName")}
                required
                placeholder="As it appears on your credit reports"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-white placeholder:text-slate-600 focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Address Line 1</label>
              <input
                value={profile.addressLine1}
                onChange={set("addressLine1")}
                required
                placeholder="Street address"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-white placeholder:text-slate-600 focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Address Line 2 (optional)</label>
              <input
                value={profile.addressLine2}
                onChange={set("addressLine2")}
                placeholder="Apt, suite, unit"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-white placeholder:text-slate-600 focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
                <label className="block text-sm text-slate-400 mb-1">City</label>
                <input
                  value={profile.city}
                  onChange={set("city")}
                  required
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-white focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm text-slate-400 mb-1">State</label>
                <input
                  value={profile.state}
                  onChange={set("state")}
                  required
                  maxLength={2}
                  placeholder="CA"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-white placeholder:text-slate-600 uppercase focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm text-slate-400 mb-1">ZIP</label>
                <input
                  value={profile.zip}
                  onChange={set("zip")}
                  required
                  inputMode="numeric"
                  placeholder="90210"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-white placeholder:text-slate-600 focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-6 py-2 font-semibold text-white keep-white transition hover:bg-brand-600 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                {busy ? "Saving your details…" : "Save Profile"}
              </button>
              {status && <span className="text-sm text-slate-400">{status}</span>}
            </div>
          </form>
        )}

        {/* Password & security */}
        <div className="mt-8 border-t border-ink-700/70 pt-6">
          <h2 className="mb-1 flex items-center gap-2 text-xl font-bold">
            <Lock className="h-5 w-5 text-brand-400" /> Password &amp; Security
          </h2>
          <p className="mb-4 text-sm text-slate-400">
            Changing your password only changes how you sign in — your reports, letters, and dispute history stay exactly as they are.
            Use at least 10 characters with an uppercase letter, a number, and a special character (e.g. ! @ # $).
          </p>
          <form onSubmit={changePassword} className="max-w-sm space-y-3">
            <div>
              <label className="mb-1 block text-sm text-slate-400">Current password</label>
              <input
                type="password"
                autoComplete="current-password"
                className="input w-full"
                value={pw.current}
                onChange={(e) => setPw({ ...pw, current: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">New password</label>
              <input
                type="password"
                autoComplete="new-password"
                className="input w-full"
                value={pw.next}
                onChange={(e) => setPw({ ...pw, next: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Confirm new password</label>
              <input
                type="password"
                autoComplete="new-password"
                className="input w-full"
                value={pw.confirm}
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button type="submit" disabled={pwBusy || !pw.current || !pw.next} className="btn-primary">
                {pwBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Update password
              </button>
              {pwMsg && (
                <span className={`text-sm ${pwMsg.ok ? "text-success-400" : "text-rose-400"}`}>{pwMsg.text}</span>
              )}
            </div>
          </form>
        </div>

        {/* Phone alerts (Web Push) */}
        <div className="mt-8 border-t border-ink-700/70 pt-6">
          <h2 className="mb-1 flex items-center gap-2 text-xl font-bold">
            <Bell className="h-5 w-5 text-brand-400" /> Phone Alerts
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-slate-400">
            <span className="mr-2 rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
            Turn this on and I&apos;ll send a push to this device when something needs your attention (e.g. a Brief draft awaiting approval).
            Turn it off and the alerts stop — nothing else about your account changes.
          </p>
          <PushToggle />
        </div>

        {/* Email updates (Brief digest) */}
        <div className="mt-8 border-t border-ink-700/70 pt-6">
          <h2 className="mb-1 flex items-center gap-2 text-xl font-bold">
            <Mail className="h-5 w-5 text-brand-400" /> Email Updates
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-slate-400">
            <span className="mr-2 rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
            I&apos;ll email you a weekly digest of the CreditVector Brief — educational consumer-credit news, explained plainly.
            You can stop it any time, and every email includes an unsubscribe link.
          </p>
          <button
            type="button"
            onClick={() => toggleDigest(!digest)}
            disabled={digestBusy}
            aria-pressed={digest}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition disabled:opacity-60 ${
              digest ? "border-success-500/40 bg-success-500/10 text-success-300" : "border-ink-700/70 text-slate-300 hover:border-brand-500/30 hover:text-brand-200"
            }`}
          >
            {digestBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {digest ? "Subscribed — weekly digest on" : "Subscribe to the weekly digest"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
