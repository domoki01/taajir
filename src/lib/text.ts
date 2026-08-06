// ── LINK DETECTION ───────────────────────────────────────────────────────────
// Requests and their replies allow no links at all.
//
// This is not prudishness about the open web. A demand thread — "نشري شقة في
// باب الزوار" — is the highest-value spam target on a classifieds site: it is a
// list of people who have just announced they are ready to spend money, and it
// is public. Left open, the replies fill with links to Telegram channels and
// competitor sites within a week, and the feature dies.
//
// The check refuses rather than strips. Silently editing what someone wrote is
// worse than telling them why it was rejected, and a stripped link leaves a
// sentence that no longer says anything.

/**
 * TLDs worth catching, rather than "any two letters after a dot".
 *
 * The permissive form flags ordinary Latin prose — "nice apartment.Very big"
 * contains `apartment.very`, which matches a generic pattern and would reject a
 * legitimate reply. Spam converges on a small set of endings, so an explicit
 * list is both stricter where it matters and quiet where it does not.
 */
const kTlds = [
  // generic
  "com",
  "net",
  "org",
  "info",
  "biz",
  "io",
  "co",
  "me",
  "ly",
  "gl",
  "to",
  "cc",
  "tv",
  "xyz",
  "top",
  "site",
  "online",
  "store",
  "shop",
  "club",
  "link",
  "page",
  "app",
  "dev",
  "live",
  "space",
  "website",
  "fun",
  "icu",
  "pro",
  "vip",
  "cloud",
  "digital",
  "agency",
  "immo",
  // country codes that show up in Algerian traffic
  "dz",
  "fr",
  "tn",
  "ma",
  "eg",
  "sa",
  "ae",
  "qa",
  "kw",
  "tr",
  "uk",
  "de",
  "es",
  "it",
  "be",
  "nl",
  "ch",
  "ca",
  "us",
  "ru",
  "cn",
  "in",
  "pk",
].join("|");

/**
 * Fold the ways a link gets written when someone knows links are blocked:
 * `example[.]com`, `example (dot) com`, `example نقطة com`, `example . com`.
 *
 * Collapsing spaces around a dot is safe here because the match below still
 * needs a known TLD on the right-hand side — "شقة . كبيرة" folds to
 * "شقة.كبيرة" and matches nothing.
 */
function fold(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[\[\(\{]\s*\.\s*[\]\)\}]/g, ".")
      .replace(/\s*(?:\(|\[)?\s*(?:dot|point|نقطة)\s*(?:\)|\])?\s*/gi, ".")
      .replace(/\s*\.\s*/g, ".")
      // Full-width and Arabic-decimal separators used the same way.
      .replace(/[．｡。٫]/g, ".")
  );
}

const kSchemeOrWww = /(?:[a-z][a-z0-9+.-]*:\/\/|\bwww\.)/i;
const kBareDomain = new RegExp(
  // A label, a dot, one of the known endings, and then either a boundary or
  // the start of a path — so "example.com/promo" and "example.com" both match.
  String.raw`\b[a-z0-9][a-z0-9-]{0,62}\.(?:${kTlds})(?:[/?#:]|\b)`,
  "i",
);

/** True when the text contains something that functions as a link. */
export function containsLink(input: string): boolean {
  const folded = fold(input);
  return kSchemeOrWww.test(folded) || kBareDomain.test(folded);
}

/** The one message shown wherever a link is refused, so the rule reads as one rule. */
export const kNoLinksMessage = "ما يمكنش تحط روابط.";
