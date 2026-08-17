// ── EVERY PRIVATE PAGE GUARDS ITSELF ─────────────────────────────────────────
// The (dashboard) layout deliberately does not gate on the session — see the
// note at the top of it. That only stays safe while every page in the group
// guards itself, and "everyone remembers" is not a guarantee. This is.
//
// It reads the source rather than rendering, because what is being checked is
// a property of the file: that the guard is there, and that it names its own
// route so the visitor lands where they were going after signing in.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const kRoot = "src/app/(dashboard)";

/** Every page.tsx under the group, with the route it answers on. */
function pages(
  dir = kRoot,
  segments: string[] = [],
): Array<{
  file: string;
  route: string;
}> {
  const out: Array<{ file: string; route: string }> = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      // Route groups — (dashboard) itself — contribute no URL segment.
      out.push(
        ...pages(path, entry.startsWith("(") ? segments : [...segments, entry]),
      );
    } else if (entry === "page.tsx") {
      out.push({ file: path, route: `/${segments.join("/")}` });
    }
  }
  return out;
}

const found = pages();

/**
 * The file with its comments removed.
 *
 * Without this the checks below are satisfied by prose: the layout's own note
 * explains why it must not call requireUser, and naming the function there was
 * enough to pass a test asserting it does not. It cuts the other way too — a
 * page whose only mention of the guard is in a comment is a page with no guard.
 */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("the dashboard group", () => {
  it("has pages to check", () => {
    // A rename that emptied this list would otherwise make every assertion
    // below pass by vacuum.
    expect(found.length).toBeGreaterThanOrEqual(6);
  });

  it.each(found)("$route guards itself", ({ file }) => {
    expect(code(file)).toMatch(/\brequireUser\s*\(/);
  });

  it.each(found.filter((p) => !p.route.includes("[")))(
    "$route sends a signed-out visitor back to itself",
    ({ file, route }) => {
      const call = code(file).match(/\brequireUser\s*\(\s*"([^"]*)"\s*\)/);

      // The dashboard root is the one page whose own route is the default, so
      // it may call requireUser() bare.
      if (route === "/tableau-de-bord" && !call) return;

      expect(call?.[1]).toBe(route);
    },
  );

  it("keeps the layout out of the gating business", () => {
    // The regression this exists for: a requireUser() here runs before every
    // child and overrides all of the destinations asserted above.
    expect(code(join(kRoot, "layout.tsx"))).not.toMatch(/\brequireUser\s*\(/);
  });
});
