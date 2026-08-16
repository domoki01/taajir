/**
 * Date formatting for anything that is rendered on the server.
 *
 * Two things go wrong without this. The timezone: the server runs in UTC and
 * the reader is in Algeria (UTC+1), so an ad posted at 00:30 shows as the
 * previous day. And hydration: a client component formats once during SSR and
 * again in the browser, and the two disagree — different timezone, sometimes
 * different ICU data — which React reports as a hydration mismatch and repairs
 * by throwing away the server HTML for that subtree.
 *
 * Pinning the zone makes both renders identical *and* correct. Anything shown
 * to a user should be formatted through here, on the server, and passed down as
 * a string.
 */
const kZone = "Africa/Algiers";

export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString("ar-DZ", {
    timeZone: kZone,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatFullDateTime(ms: number): string {
  return new Date(ms).toLocaleString("ar-DZ", {
    timeZone: kZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * "توّا", "من 5 د", "البارح" — how a feed says when.
 *
 * A demand feed is read the way a social feed is: what matters is whether a
 * post is fresh, not the exact minute it landed. "23/08 14:30" makes the reader
 * do that subtraction themselves, on every card.
 *
 * Computed on the server like everything else here, and handed down as a
 * string. It is a snapshot rather than a live clock — the page is dynamic and
 * re-renders on navigation, and a ticking timestamp is not worth a client
 * component on every card.
 *
 * Deliberately avoids Arabic dual/plural agreement (دقيقتان، 3 دقائق…) by
 * abbreviating the unit: the short forms read naturally in Algerian usage and
 * stay correct at every count.
 */
export function formatRelative(ms: number, now = Date.now()): string {
  const seconds = Math.round((now - ms) / 1000);

  // A clock skew between the server and the record should read as "now", not
  // as a negative age.
  if (seconds < 60) return "توّا";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `من ${minutes} د`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `من ${hours} سا`;

  const days = Math.round(hours / 24);
  if (days === 1) return "البارح";
  if (days < 7) return `من ${days} يام`;

  return new Date(ms).toLocaleString("ar-DZ", {
    timeZone: kZone,
    day: "2-digit",
    month: "2-digit",
  });
}
