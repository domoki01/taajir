// ── FCM SERVICE WORKER ───────────────────────────────────────────────────────
// Must live at the site root under exactly this name: the Firebase JS SDK looks
// for /firebase-messaging-sw.js by convention when no registration is passed to
// getToken(), and a worker anywhere else is simply never found.
//
// The compat bundles are loaded from gstatic because a service worker is not
// part of the app's module graph — it cannot import from the bundle, and the
// modular SDK has no service-worker entry point. Pin the version to the one in
// package.json so the worker and the page speak the same protocol.
//
// The config below is the same public Firebase config the client bundle already
// ships. These are project identifiers, not credentials; what protects the data
// is firestore.rules.
// ── INSTALLABILITY FIRST ─────────────────────────────────────────────────────
// These three listeners are registered before anything is imported, and that
// ordering is the point. `importScripts` is synchronous and throws on a network
// failure, which aborts evaluation of the whole worker — so with the imports
// first, a moment where gstatic is unreachable meant no worker at all: no fetch
// handler, therefore no install prompt, therefore (on iOS) no push, ever, for
// that visit. The fetch handler is what makes the site installable and it needs
// nothing from Firebase, so it must not be able to fail with it.
//
// The handler passes every request through untouched. Deliberately not a cache:
// a stale shell would show yesterday's ads with no way to tell, and Next already
// fingerprints and caches its own assets over HTTP.
self.addEventListener("fetch", () => {});
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);

// ── MESSAGING ────────────────────────────────────────────────────────────────
// Wrapped: if the CDN is unreachable the site is still installable, still works,
// and simply does not receive push until the next load that can reach it.
try {
  importScripts(
    "https://www.gstatic.com/firebasejs/12.17.0/firebase-app-compat.js",
  );
  importScripts(
    "https://www.gstatic.com/firebasejs/12.17.0/firebase-messaging-compat.js",
  );

  firebase.initializeApp({
    apiKey: "AIzaSyAKonS-qRWyhWOi_sK7chdOf14SiQklTz4",
    authDomain: "newmokit.firebaseapp.com",
    projectId: "newmokit",
    storageBucket: "newmokit.firebasestorage.app",
    messagingSenderId: "224868230062",
    appId: "1:224868230062:web:8f2342346aa6ca0bd9de3f",
  });

  const messaging = firebase.messaging();

  // Fires only when no tab of the site is focused. A foreground message is
  // delivered to onMessage() on the page instead, which is why the page shows its
  // own toast rather than relying on this.
  messaging.onBackgroundMessage((payload) => {
    const url = payload.data?.url || "/";
    self.registration.showNotification(payload.notification?.title || "تأجير", {
      body: payload.notification?.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // Same tag replaces the previous alert instead of stacking; someone away
      // for a day should not come back to forty separate notifications.
      tag: payload.notification?.tag || "taajir-alert",
      dir: "rtl",
      lang: "ar",
      data: { url },
    });
  });
} catch (error) {
  // No push this load. The site stays installable and fully usable; the
  // next load that can reach the CDN registers messaging normally.
  console.error("[sw] messaging unavailable:", error);
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        // Reuse an open tab when there is one — opening a fourth copy of the
        // site because someone tapped three notifications is its own annoyance.
        for (const client of windows) {
          if (client.url === url && "focus" in client) return client.focus();
        }
        return self.clients.openWindow(url);
      }),
  );
});
