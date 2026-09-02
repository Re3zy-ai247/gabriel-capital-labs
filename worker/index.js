// Custom service-worker code that next-pwa compiles and imports into the generated
// workbox service worker (public/sw.js). Adds Web Push notification handling without
// touching the auto-generated PWA/offline logic.
/* eslint-disable no-undef */

self.addEventListener("push", function (event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  const title = data.title || "CreditVector";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ── One-time purge of pre-P1-32 caches (M-3) ─────────────────────────────────
// Until this wave, next-pwa ran with its bundled default runtimeCaching list
// (node_modules/next-pwa/cache.js). Two of those rules wrote consumer data to
// Cache Storage on the device: "apis" cached every same-origin GET /api/*
// NetworkFirst for 24 h — including /api/documents/[id]/raw, which streams
// DECRYPTED government-ID bytes — and "others" cached every rendered page and
// RSC payload. next-pwa's register.js also kept a "start-url" cache of the
// AUTHENTICATED start_url (/dashboard).
//
// next.config.js now denies all of that, so the new worker never writes those
// buckets again. But entries the OLD worker already wrote stay on the device
// until the browser evicts them — on a shared or resold phone, that is exactly
// the exposure P1-32 exists to close. Cache Storage ignores HTTP cache
// directives, so `Cache-Control: no-store` on those routes never applied.
//
// Deleting a cache that does not exist is a no-op, so this is safe to run on
// every activation and on installs that never had the old worker. The list is
// EXPLICIT rather than "delete everything unknown": workbox's own precache
// (workbox-precache-v2-*) and the caches this build does use must survive.
var LEGACY_CACHES = [
  // held consumer data
  "apis",
  "others",
  "start-url",
  "next-data",
  "static-data-assets",
  // orphaned by the new cache names (no personal data, but nothing reads them)
  "static-js-assets",
  "static-style-assets",
  "static-image-assets",
  "static-font-assets",
  "static-audio-assets",
  "static-video-assets",
  "cross-origin",
  "google-fonts-webfonts",
  "google-fonts-stylesheets",
];

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names
          .filter(function (name) {
            return LEGACY_CACHES.indexOf(name) !== -1;
          })
          .map(function (name) {
            return caches.delete(name);
          })
      );
    })
  );
});
