/**
 * Where a sign-in may send someone afterwards.
 *
 * `?next=` is written by whoever wrote the link, and the sign-in screen sends
 * the browser there the moment the session exists. Handing that value to the
 * router unchecked makes the site a redirector: `/connexion?next=https://…`
 * is a link that genuinely starts on تأجير, shows the real sign-in form, and
 * lands the person somewhere else immediately after they authenticate — which
 * is the exact shape of a credential-phishing chain, wearing our domain.
 *
 * So: same-origin paths only. A single leading slash, and nothing that a
 * browser would read as an authority — `//evil.dz` and `/\evil.dz` are both
 * protocol-relative in practice, and `https://…` needs no explanation.
 */
export const kDefaultNext = "/tableau-de-bord";

export function safeNext(
  raw: string | null | undefined,
  fallback = kDefaultNext,
): string {
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value.startsWith("/")) return fallback;
  // Rejects "//host", "/\host" and any backslash trickery outright rather than
  // trying to normalise it.
  if (value.startsWith("//") || value.includes("\\")) return fallback;
  // A control character can truncate the URL in some parsers; nothing legitimate
  // carries one.
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  return value;
}
