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
importScripts(
  "https://www.gstatic.com/firebasejs/12.17.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/12.17.0/firebase-messaging-compat.js",
);

firebase.initializeApp({
  apiKey: "AIzaSyCbOzPZiJu2khbC1HZMpz--nTPeN0NmXjI",
  authDomain: "newmokit.firebaseapp.com",
  projectId: "newmokit",
  storageBucket: "newmokit.firebasestorage.app",
  messagingSenderId: "224868230062",
  appId: "1:224868230062:web:c43e0c67d18581aed9de3f",
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
