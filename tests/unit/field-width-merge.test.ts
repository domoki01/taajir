// ── A SHARED CLASS STRING PLUS A WIDTH IS A TRAP ─────────────────────────────
// `field` carries w-full, and every form that wants a narrow control writes
// `${field} w-28`. Both class names land on the element at equal specificity,
// so the winner is whichever Tailwind emits later — and it emits .w-full after
// .w-28 and .w-32. The narrow control was full width.
//
// On the publish form's price row that meant a select that took the whole line
// and a shrink-0 that refused to give any of it back, so the row ran off the
// side of the screen: the first thing a seller sees when they go to type a
// price. It looks correct in the JSX, which is why this is checked rather than
// remembered. cn() resolves the conflict; a template string cannot.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function tsxFiles(dir = "src"): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...tsxFiles(path));
    else if (entry.endsWith(".tsx")) out.push(path);
  }
  return out;
}

/** `${field}` interpolated into a template literal that also sets a width. */
const kTrap = /`\$\{field\}[^`]*\b(w-\d|w-full|w-auto|flex-1)\b[^`]*`/;

describe("interpolating the shared field class", () => {
  it("never sets a width in the same template string", () => {
    const offenders = tsxFiles().filter((f) =>
      kTrap.test(readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("leaves the price row's select actually narrow", () => {
    // The row the bug was found on, pinned by name so a later edit that goes
    // back to a template string fails here with something recognisable.
    const form = readFileSync("src/components/listing/PostForm.tsx", "utf8");
    expect(form).toContain(
      'cn(field, "w-28 shrink-0 font-bold disabled:opacity-50")',
    );
  });
});
