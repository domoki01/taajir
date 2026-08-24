import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Listing photos are served straight from Firebase Storage; next/image
    // generates the responsive AVIF/WebP srcset, so no second stored thumbnail.
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "storage.googleapis.com" },
    ],
    // Note for anyone debugging locally: with the Storage emulator, uploaded
    // images render broken. The emulator hands out http://127.0.0.1:9199 URLs
    // and Next 16's optimizer refuses loopback upstreams outright — adding a
    // remotePattern for it does not help, it is blocked a layer below. Nothing
    // to fix; production URLs are on firebasestorage.googleapis.com.
    // Next 16 ships [75] only. 65 is for grid thumbnails, where the smaller
    // payload matters more than the detail on a mobile connection.
    qualities: [65, 75],
  },

  // ── SECURITY HEADERS ───────────────────────────────────────────────────────
  // The site shipped with none of these. They are the layer that decides what
  // an injected script could *do* — where it may load code from, where it may
  // send what it steals, and whether the page can be framed by someone else's.
  //
  // `script-src` still carries 'unsafe-inline' because Next inlines its own
  // hydration bootstrap on every page and the alternative is a per-request
  // nonce from middleware, which makes every route dynamic. So this is not a
  // defence against injected *inline* script — escaping the JSON-LD is that
  // (src/lib/jsonld.ts). What it does block is the rest of the chain: pulling
  // a payload from another origin, posting stolen data anywhere but here, and
  // framing the site to click something on the visitor's behalf.
  async headers() {
    // Turbopack's dev runtime evaluates modules through eval(), and a build
    // pointed at the emulators talks to 127.0.0.1 rather than Google. Both
    // relaxations are keyed on what makes them necessary — NODE_ENV for the
    // dev toolchain, the emulator flag for the emulator hosts — so neither can
    // reach a production build, where both are false.
    const dev = process.env.NODE_ENV !== "production";
    const emulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";
    const local = emulators ? " http://127.0.0.1:* http://localhost:*" : "";

    // Google sign-in renders its handler in an iframe served from whatever
    // `authDomain` the client SDK was given, so this host has to be the same
    // one. Read from the env var rather than written out, because the day it
    // changes — moving off newmokit.firebaseapp.com onto a domain of our own,
    // so the account chooser stops naming a project nobody has heard of — a
    // literal here would keep the old host and CSP would block the frame. The
    // failure mode is sign-in that stops working with nothing in the server
    // log, only a console message in someone else's browser.
    const authDomain =
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
      "newmokit.firebaseapp.com";

    const csp = [
      "default-src 'self'",
      // Google's script hosts are reCAPTCHA Enterprise, which phone sign-in
      // requires; apis.google.com is the Google sign-in popup.
      // Google's script hosts serve reCAPTCHA Enterprise, which both phone
      // sign-in and App Check attest with; apis.google.com is the Google
      // sign-in popup. recaptcha.net is Google's own alternate host, used
      // where www.google.com is unreachable.
      `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} https://www.google.com https://www.gstatic.com https://www.recaptcha.net https://apis.google.com`,
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: https://firebasestorage.googleapis.com https://storage.googleapis.com https://lh3.googleusercontent.com https://www.gstatic.com${local}`,
      "font-src 'self' data:",
      // Firebase Auth, Firestore, Storage and App Check, and nothing else — an
      // injected script cannot post what it reads to its own server.
      // www.google.com belongs here as well as in script-src: reCAPTCHA does
      // not only load a script, it posts its assessment back, and App Check
      // cannot mint a token without that round trip.
      `connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://firebaseinstallations.googleapis.com https://fcmregistrations.googleapis.com https://firebaseappcheck.googleapis.com https://www.google.com https://www.recaptcha.net${local}${dev ? " ws://127.0.0.1:* ws://localhost:*" : ""}`,
      // The auth handler and the reCAPTCHA challenge both render in an iframe.
      `frame-src 'self' https://www.google.com https://www.recaptcha.net https://${authDomain}`,
      "worker-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    const hsts = {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    };

    return [
      {
        // Everything except the proxied auth handler — see the block below for
        // why that one is carved out rather than covered.
        source: "/((?!__/auth/).*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), payment=(), geolocation=(self)",
          },
          hsts,
        ],
      },
      {
        // ── THE ONE PAGE THAT HAS TO BE FRAMED ─────────────────────────────
        // Google's sign-in helper is rendered in an iframe by the Firebase SDK.
        // The headers above exist to stop this site being framed at all —
        // `frame-ancestors 'none'` and X-Frame-Options: DENY — and either one
        // applied to the helper blocks the frame sign-in depends on. Firebase
        // serves it with no framing headers of its own, so the only thing that
        // could break it is us.
        //
        // Measured, not assumed: on Next 16.3 an externally rewritten path
        // passes the upstream response through and `headers()` does not run
        // for it, so today neither this block nor the exclusion above changes
        // a byte — /__/auth/handler comes back with no CSP either way. Both
        // stay because that is a behaviour of the framework, not a promise it
        // makes. If a later version starts applying headers to proxied paths,
        // the difference is sign-in that keeps working versus sign-in that
        // dies with DENY on the day of an upgrade, and the failure is silent
        // in the server log — the only sign is a console message in somebody
        // else's browser.
        source: "/__/auth/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self'",
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          hsts,
        ],
      },
    ];
  },

  // ── THE AUTH HANDLER, ON OUR OWN NAME ──────────────────────────────────────
  // "Sign in to continue to newmokit.firebaseapp.com" is what Google showed
  // every visitor: the name of a Firebase project, on the one screen where
  // somebody decides whether this site is worth handing an account to.
  //
  // The fix is to point `authDomain` at taajirdz.com, and the obstacle is that
  // taajirdz.com is served by App Hosting — this Next app — while /__/auth/* is
  // served by Firebase Hosting. The path simply 404s here, which is what makes
  // the obvious change break sign-in rather than rebrand it.
  //
  // So the app serves it, by proxy. The handler's own HTML pulls handler.js and
  // experiments.js relatively, and the SDK asks for /__/auth/iframe as well, so
  // the whole subtree is forwarded rather than the one page.
  //
  // Nothing here switches anything on: this only makes the path exist. The
  // switch is NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, which is also how it is
  // switched back in one deploy if the flow misbehaves.
  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination: "https://newmokit.firebaseapp.com/__/auth/:path*",
      },
    ];
  },

  // ── ONE ADDRESS ────────────────────────────────────────────────────────────
  // App Hosting keeps serving the site on its generated hostname, and every
  // link ever pasted from it stays alive — an invite in a WhatsApp group, a
  // Facebook post, whatever Google has already crawled. Changing the origin the
  // site *hands out* does not retire the ones already in circulation.
  //
  // So the old hostname sends everyone here, path intact, rather than serving a
  // second copy of the site under a name nobody would type. That also settles
  // the duplicate-content question at the source instead of relying on the
  // canonical tag to be honoured.
  //
  // Two rules for one condition, because the name the visitor typed reaches the
  // app in different places depending on who is in front of it.
  //
  // `type: "host"` compares the Host header. On App Hosting that header is the
  // Cloud Run container's own address, not the public hostname — the same trap
  // that once made the invite link redirect to https://localhost:8080 — so on
  // its own it matched nothing in production while passing every local test.
  // The public name arrives in x-forwarded-host instead.
  //
  // The header value is a regex rather than a literal: a chain of proxies is
  // allowed to append to x-forwarded-host, and an exact comparison would miss
  // "a.example, taajir--….hosted.app".
  //
  // Neither rule can fire on the custom domain, and a request carrying neither
  // header — Cloud Run's own health checks — matches nothing and is served
  // normally.
  async redirects() {
    const kOldHost = "taajir--newmokit.europe-west4.hosted.app";
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "header",
            key: "x-forwarded-host",
            value: `.*${kOldHost.replace(/\./g, "\\.")}.*`,
          },
        ],
        destination: "https://taajirdz.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: kOldHost }],
        destination: "https://taajirdz.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
