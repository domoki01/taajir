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
      "frame-src 'self' https://www.google.com https://www.recaptcha.net https://newmokit.firebaseapp.com",
      "worker-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), payment=(), geolocation=(self)",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
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
  // Matched on the Host header, so it fires only for the generated hostname:
  // localhost, the custom domain and Cloud Run's own health checks are all
  // untouched.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "taajir--newmokit.europe-west4.hosted.app",
          },
        ],
        destination: "https://taajirdz.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
