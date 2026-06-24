"use client";
import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

// Returns a plain ArrayBuffer (an unambiguous BufferSource) so it satisfies
// PushSubscriptionOptions.applicationServerKey across TS lib versions.
function vapidKeyBytes(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

// Per-device opt-in for Web Push. Reuses the next-pwa-registered service worker
// (which already carries our push handlers via worker/index.js).
export function PushToggle() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window &&
      !!VAPID;
    setSupported(ok);
    if (ok) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setEnabled(!!sub))
        .catch(() => {});
    }
  }, []);

  async function registration(): Promise<ServiceWorkerRegistration> {
    const existing = await navigator.serviceWorker.getRegistration();
    if (!existing) await navigator.serviceWorker.register("/sw.js");
    return navigator.serviceWorker.ready;
  }

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setMsg("Notifications are blocked. Enable them for this site in your browser settings.");
        return;
      }
      const reg = await registration();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKeyBytes(VAPID),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      if (!res.ok) {
        setMsg("Couldn't save your subscription — try again.");
        return;
      }
      setEnabled(true);
      setMsg("Phone alerts are on for this device.");
    } catch {
      setMsg("Couldn't enable notifications on this device.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      setEnabled(false);
      setMsg("Phone alerts are off for this device.");
    } catch {
      setMsg("Couldn't turn off notifications.");
    } finally {
      setBusy(false);
    }
  }

  if (supported === false) {
    return (
      <p className="text-sm text-slate-400">
        This browser can&apos;t do push notifications. On iPhone: tap Share → <span className="font-medium">Add to Home Screen</span>,
        open CreditVector from the new icon, then enable alerts here.
      </p>
    );
  }

  return (
    <div>
      <button
        onClick={enabled ? disable : enable}
        disabled={busy || supported === null}
        className={enabled ? "btn-ghost" : "btn-primary"}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : enabled ? (
          <BellOff className="h-4 w-4" />
        ) : (
          <Bell className="h-4 w-4" />
        )}
        {enabled ? "Disable phone alerts" : "Enable phone alerts"}
      </button>
      {msg && <p className="mt-2 text-xs text-slate-400">{msg}</p>}
      <p className="mt-2 text-xs text-slate-500">
        Sends a push to this device for things that need attention (e.g., a Brief draft awaiting approval). On iPhone, add
        CreditVector to your Home Screen first.
      </p>
    </div>
  );
}
