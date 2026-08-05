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
