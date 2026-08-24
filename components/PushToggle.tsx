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

// Reject after `ms` so a never-settling step (e.g. a slow service worker) can't
// leave the button spinning forever.
function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
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

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      // 1) Make sure the service worker is active — with a timeout so we never hang.
      const existing = await navigator.serviceWorker.getRegistration();
      if (!existing) await navigator.serviceWorker.register("/sw.js");
      const reg = await withTimeout(
        navigator.serviceWorker.ready,
        10000,
        "Service worker didn't start — reload the page and try again."
      );

      // 2) Ask permission (this shows the browser prompt — tap Allow).
      const perm = await Notification.requestPermission();
      if (perm === "denied") {
        setMsg("Notifications are blocked for this site. Allow them in your browser's site settings, then try again.");
        return;
      }
      if (perm !== "granted") {
        setMsg("Tap Allow on the notification prompt to enable alerts.");
        return;
      }

      // 3) Subscribe (also timed out so a stalled push service can't hang the button).
      const sub = await withTimeout(
        reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyBytes(VAPID) }),
        15000,
        "Couldn't reach the push service — check your connection and try again."
      );

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      if (!res.ok) {
        setMsg(res.status === 401 ? "Please sign in first, then enable alerts." : "Couldn't save your subscription — try again.");
        return;
      }
      setEnabled(true);
      setMsg("This device is registered. Nothing is sent through it today.");
    } catch (e) {
      setMsg((e as Error)?.message || "Couldn't enable notifications on this device.");
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
        Registers this device for push notifications — nothing is sent through it today. On iPhone, add
        CreditVector to your Home Screen first.
      </p>
    </div>
  );
}
