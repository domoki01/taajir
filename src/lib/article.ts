// ── ARTICLE TEXT ─────────────────────────────────────────────────────────────
// Turning what an editor types into the block list the page renders, and back.
// Deliberately not markdown: a full parser would accept inline HTML, and the
// whole reason the body is blocks is that nothing an admin types ever becomes
// markup.

import type { ArticleBlock } from "@/types/article";

/**
 * Three prefixes and a blank line, which is as much syntax as an Arabic editor
 * writing in a textarea should have to remember:
 *
 *   ## a heading
 *   - a bullet
 *   > a pulled quote
 *   anything else is a paragraph
 */
export function parseBody(raw: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const text = line.trim();
    if (!text) continue;
    if (text.startsWith("## "))
      blocks.push({ type: "h2", text: text.slice(3).trim() });
    else if (text.startsWith("- "))
      blocks.push({ type: "li", text: text.slice(2).trim() });
    else if (text.startsWith("> "))
      blocks.push({ type: "quote", text: text.slice(2).trim() });
    else blocks.push({ type: "p", text });
  }
  return blocks;
}

/**
 * Inline emphasis, resolved at render time into runs of text.
 *
 * `**like this**` — the one piece of inline syntax there is. It is split here
 * rather than converted to markup anywhere, so what reaches React is still a
 * list of strings: a `<strong>` with text inside it, never a string containing
 * a tag. An odd number of markers is treated as literal text, because half a
 * bold run is a typo and a typo should look like one, not eat the paragraph.
 */
export function richRuns(text: string): Array<{ text: string; bold: boolean }> {
  const parts = text.split("**");
  if (parts.length % 2 === 0) return [{ text, bold: false }];
  return parts
    .map((part, i) => ({ text: part, bold: i % 2 === 1 }))
    .filter((run) => run.text.length > 0);
}

/** The inverse, so the editor can reopen what it saved. */
export function toRaw(blocks: ArticleBlock[]): string {
  return blocks
    .map((b) =>
      b.type === "h2"
        ? `## ${b.text}`
        : b.type === "li"
          ? `- ${b.text}`
          : b.type === "quote"
            ? `> ${b.text}`
            : b.text,
    )
    .join("\n\n");
}

/**
 * Reading time, at 180 words a minute.
 *
 * Slower than the 220–250 usually quoted for English prose: Arabic packs more
 * meaning per word, and this text is read on a phone. Rounding up means a
 * two-minute read is never announced as one.
 */
export function readingMinutes(blocks: ArticleBlock[]): number {
  const words = blocks
    .map((b) => b.text.split(/\s+/).length)
    .reduce((a, b) => a + b, 0);
  return Math.max(1, Math.ceil(words / 180));
}

/** Latin, lowercase, hyphenated — the shape every URL on this site takes. */
export const kSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normaliseSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

/**
 * Segments the article routes must never hand to a slug.
 *
 * `/articles/nouveau` is the editor. A published article claiming that slug
 * would shadow it, and the way back would be a database edit.
 */
export const kReservedArticleSlugs = new Set(["nouveau", "new", "admin"]);
