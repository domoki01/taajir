"use client";

// ── THE SHARE ROW ────────────────────────────────────────────────────────────
// Every share carries the sharer's referral code, so passing an ad to a friend
// and inviting them are the same act. Nobody has to visit the referral page,
// copy a link and remember to send it — the thing they already wanted to send
// is the invite.
//
// The native sheet comes first where the browser has one, because on a phone it
// offers every app the person actually uses, including the ones no button here
// could name. The explicit buttons stay for the browsers that do not, and
// because "WhatsApp" as a labelled target is faster to hit than a sheet.

import { useEffect, useState } from "react";
import { Check, Copy, Send } from "lucide-react";
import { shareHref, shareUrl, type ShareTarget } from "@/lib/share";
import { shortLinkUrl } from "@/lib/shortlink";
import { shareInfo } from "@/server/actions/affiliate";

/** WhatsApp and Facebook have no lucide glyph; these are their own marks. */
function WhatsAppMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
      <path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.6.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-1.6-.8-2.6-1.4-3.7-3.2-.3-.5.3-.5.8-1.5.1-.2 0-.4 0-.5s-.6-1.5-.9-2c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-1 1-1.2 2.3-.5 3.6 1.3 2.4 2.8 4 5.3 5 1.6.7 2.3.7 3.1.6.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.2-.2-.2-.4-.4z" />
      <path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.4 1.3 4.9L2 22l5.3-1.4c1.4.8 3 1.2 4.7 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3.1.8.8-3-.2-.3C4.1 15 3.7 13.5 3.7 12c0-4.6 3.7-8.3 8.3-8.3s8.3 3.7 8.3 8.3-3.7 8.2-8.3 8.2z" />
    </svg>
  );
}

function FacebookMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z" />
    </svg>
  );
}

const kTargets: {
  id: ShareTarget;
  label: string;
  Mark: () => React.ReactElement;
  tone: string;
}[] = [
  {
    id: "whatsapp",
    label: "واتساب",
    Mark: WhatsAppMark,
    tone: "bg-whatsapp text-white",
  },
  {
    id: "facebook",
    label: "فيسبوك",
    Mark: FacebookMark,
    tone: "bg-[#1877F2] text-white",
  },
];

export function ShareButtons({
  path,
  text,
}: {
  /** Site-relative, so the origin is whichever one the visitor is actually on. */
  path: string;
  text: string;
}) {
  const [copied, setCopied] = useState(false);
  const [info, setInfo] = useState<{
    code: string | null;
    short: string | null;
  } | null>(null);

  // Asked for here rather than resolved when the page rendered: reading the
  // session during that render would opt the listing route out of its cache,
  // and that is the page search engines land on. A signed-out visitor gets a
  // null code and shares a perfectly good link without one.
  useEffect(() => {
    let alive = true;
    void shareInfo(path)
      .then((i) => alive && setInfo(i))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [path]);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  // The short link when there is one, the full link otherwise. Falling back
  // rather than waiting: the buttons work from the first paint, and quietly get
  // shorter a moment later.
  const url = info?.short
    ? shortLinkUrl(origin, info.short)
    : shareUrl(origin, path, info?.code);
  const earns = !!info?.code;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is refused in some in-app browsers. The link is visible in
      // the address bar either way, so this is not worth an error message.
    }
  }

  async function native() {
    // Feature-detected at the click rather than at render: `navigator.share`
    // exists in desktop Chrome but rejects, and a button that appears and then
    // fails is worse than one that was never offered.
    if (!navigator.share) return copy();
    try {
      await navigator.share({ text, url });
    } catch {
      // The person closed the sheet. Not an error.
    }
  }

  return (
    // A row, not a card. This sits between somebody reading a demand and the
    // box where they answer it: as a bordered panel with its own heading and
    // four full-width buttons it was ~190px tall, which on a phone pushed the
    // composer — and the sign-up button a signed-out visitor needs — off the
    // bottom of the screen. Sharing is worth offering, not worth the fold.
    <section aria-label="شارك" className="flex flex-wrap items-center gap-2">
      {kTargets.map(({ id, label, Mark, tone }) => (
        <a
          key={id}
          href={shareHref(id, url, text)}
          target="_blank"
          rel="noopener noreferrer"
          className={`rounded-input flex items-center gap-2 px-3 py-2 text-sm font-bold transition-opacity active:opacity-90 ${tone}`}
        >
          <Mark />
          {label}
        </a>
      ))}

      {/* The two secondary targets lose their labels rather than their place.
          Icon-only keeps all four on one line at 360px, and these are the two
          nobody scans for by name — the reader is looking for the green one. */}
      <button
        type="button"
        onClick={native}
        aria-label="شارك في تطبيق آخر"
        title="تطبيق آخر"
        className="rounded-input border-border bg-surface hover:border-primary flex items-center border p-2.5 transition-colors"
      >
        <Send className="size-5" />
      </button>

      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "تنسخ الرابط" : "انسخ الرابط"}
        title={copied ? "تنسخ" : "انسخ الرابط"}
        className={`rounded-input flex items-center border p-2.5 transition-colors ${
          copied
            ? "border-success text-success"
            : "border-border bg-surface hover:border-primary"
        }`}
      >
        {copied ? <Check className="size-5" /> : <Copy className="size-5" />}
      </button>

      {earns && (
        <p className="text-muted w-full text-xs leading-relaxed">
          الرابط متاعك يحسب — كل واحد يسجّل منّو ينضاف لنقاطك.
        </p>
      )}
    </section>
  );
}
