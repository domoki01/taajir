// ── WHAT A PRIZE LOOKS LIKE ──────────────────────────────────────────────────
// A drawn card per kind, used whenever the admin has not uploaded a photo.
//
// Drawn rather than shipped as images for two reasons. The Content-Security
// Policy allows no external hosts, so a logo pulled from a CDN would simply not
// render; and a card that has to wait for an upload before it looks like
// anything means every campaign starts life looking broken.
//
// These are deliberately *evocative* rather than imitations: a card shape in
// the service's own colour with its name set in type. Reproducing Binance's or
// Google's actual mark would be a trademark someone else owns, sitting on a
// page that offers to give it away.

import type { PrizeKind } from "@/types/affiliate";

/**
 * The one place raw colour is allowed.
 *
 * globals.css owns the site's palette, and nothing here borrows from it: these
 * are three other companies' brand colours, quoted the way a logo is quoted.
 * Putting them in `@theme` would make them look like tokens of ours, and the
 * first time someone reached for `bg-binance` for a button the split that keeps
 * the design honest would be gone.
 */
const kArt: Record<
  PrizeKind,
  { from: string; to: string; ink: string; word: string; sub: string }
> = {
  binance: {
    from: "#1e2329",
    to: "#2b3139",
    ink: "#f0b90b",
    word: "BINANCE",
    sub: "GIFT CARD",
  },
  playstore: {
    from: "#0f172a",
    to: "#1e293b",
    ink: "#ffffff",
    word: "Google Play",
    sub: "GIFT CARD",
  },
  baridimob: {
    from: "#0b4f3a",
    to: "#0f7a58",
    ink: "#ffffff",
    word: "BaridiMob",
    sub: "رصيد",
  },
  custom: {
    from: "#1e293b",
    to: "#334155",
    ink: "#ffffff",
    word: "جائزة",
    sub: "",
  },
};

export function PrizeArt({
  kind,
  className = "",
}: {
  kind: PrizeKind;
  className?: string;
}) {
  const art = kArt[kind] ?? kArt.custom;
  // Unique per kind so two cards on one page cannot share a gradient id — SVG
  // ids are document-global, and the second definition would win everywhere.
  const id = `prize-${kind}`;

  return (
    <svg
      viewBox="0 0 320 200"
      role="img"
      aria-label={art.word}
      className={className}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={art.from} />
          <stop offset="100%" stopColor={art.to} />
        </linearGradient>
      </defs>

      <rect width="320" height="200" rx="16" fill={`url(#${id})`} />

      {/* The chip and the band, which is what makes a rectangle read as a card
          rather than as a coloured box. */}
      <rect
        x="28"
        y="52"
        width="42"
        height="32"
        rx="6"
        fill={art.ink}
        opacity="0.85"
      />
      <path d="M28 122 H292" stroke={art.ink} strokeWidth="1" opacity="0.25" />
      <circle cx="268" cy="52" r="34" fill={art.ink} opacity="0.12" />
      <circle cx="292" cy="76" r="22" fill={art.ink} opacity="0.1" />

      <text
        x="28"
        y="152"
        fill={art.ink}
        fontSize="26"
        fontWeight="800"
        letterSpacing="0.5"
      >
        {art.word}
      </text>
      {art.sub && (
        <text
          x="28"
          y="176"
          fill={art.ink}
          fontSize="13"
          fontWeight="600"
          opacity="0.7"
          letterSpacing="2"
        >
          {art.sub}
        </text>
      )}
    </svg>
  );
}
