// ── SHARING, WITH THE REFERRAL ATTACHED ──────────────────────────────────────
// The invite link `/r/CODE` works because there is nothing to look at: it sets
// a cookie and redirects. That is the wrong shape for sharing a *listing* —
// what gets pasted into a WhatsApp group has to preview the flat, not bounce
// through a redirect that the preview crawler may or may not follow.
//
// So the referral rides on the listing's own URL as `?ref=CODE`. The link is
// the ad, the preview is the ad's photo, and the code is picked up on arrival.
// Same attribution, no detour.

export const kRefParam = "ref";

/** The public URL for a thing, carrying the sharer's code when there is one. */
export function shareUrl(
  origin: string,
  path: string,
  code?: string | null,
): string {
  const base = `${origin.replace(/\/$/, "")}${path}`;
  return code ? `${base}?${kRefParam}=${encodeURIComponent(code)}` : base;
}

export type ShareTarget = "whatsapp" | "facebook" | "telegram";

/**
 * Where each button sends the browser.
 *
 * WhatsApp first everywhere it appears: in Algeria a listing is shared into a
 * family group far more often than onto a timeline. Facebook takes only the
 * URL — it reads the title and photo from the page's own OpenGraph tags, and
 * any text passed alongside is ignored, so there is no point building one.
 */
export function shareHref(
  target: ShareTarget,
  url: string,
  text: string,
): string {
  const u = encodeURIComponent(url);
  switch (target) {
    case "whatsapp":
      return `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case "telegram":
      return `https://t.me/share/url?url=${u}&text=${encodeURIComponent(text)}`;
  }
}
