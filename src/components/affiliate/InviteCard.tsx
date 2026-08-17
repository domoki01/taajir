"use client";

// ── THE LINK, AND THE TWO WAYS IT TRAVELS ────────────────────────────────────
// Sharing in Algeria is WhatsApp first and a pasted link second, so those are
// the two buttons. The code is shown as well as the link because it survives a
// phone call and a scrap of paper, which a URL does not.

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { referralLink } from "@/lib/referral";

export function InviteCard({
  code,
  origin,
  siteName,
}: {
  code: string;
  origin: string;
  siteName: string;
}) {
  const [copied, setCopied] = useState(false);
  const link = referralLink(origin, code);
  const message = `شوف ${siteName} — إعلانات عقارات في الجزائر، النشر مجاني.\n${link}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Older Android WebViews refuse the clipboard outside a secure context.
      // The link is on screen and selectable, so this is a lost convenience,
      // not a lost feature — but saying nothing would read as a dead button.
      window.prompt("انسخ الرابط:", link);
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-card border-border bg-surface border p-4">
      <p className="text-sm font-extrabold">رابط الدعوة تاعك</p>

      <p className="ltr-nums border-border bg-surface-soft rounded-input mt-3 border border-dashed py-3 text-center text-2xl font-black tracking-[0.3em]">
        {code}
      </p>

      <p
        dir="ltr"
        className="ltr-nums text-muted mt-2 truncate text-center text-xs font-semibold"
      >
        {link}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-whatsapp rounded-input flex items-center justify-center gap-2 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          <Share2 className="size-4" strokeWidth={2.6} />
          ابعثو في واتساب
        </a>
        <button
          type="button"
          onClick={copy}
          className="rounded-input border-primary text-primary hover:bg-primary-soft flex items-center justify-center gap-2 border py-3 text-sm font-bold transition-colors"
        >
          {copied ? (
            <Check className="size-4" strokeWidth={2.6} />
          ) : (
            <Copy className="size-4" strokeWidth={2.6} />
          )}
          {copied ? "تنسخ" : "انسخ الرابط"}
        </button>
      </div>
    </div>
  );
}
