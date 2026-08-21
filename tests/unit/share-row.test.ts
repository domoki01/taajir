// ── THE SHARE ROW STAYS A ROW ────────────────────────────────────────────────
// This started as a bordered panel with its own heading and four full-width
// buttons: about 190px, sitting between a demand and the box for answering it,
// which on a phone is the composer and the sign-up button pushed off the
// bottom. The page whose whole point is replying opened on no way to reply.
//
// Both halves of the fix are one careless edit from coming back — a label
// re-added to a button, or the block moved back above the thread — and neither
// looks wrong in a diff. So they are pinned.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const share = readFileSync("src/components/share/ShareButtons.tsx", "utf8");
const demand = readFileSync("src/app/demandes/[id]/page.tsx", "utf8");

describe("the share row", () => {
  it("is a row, not a card with a heading", () => {
    expect(share).toContain('<section aria-label="شارك"');
    expect(share).not.toContain("rounded-card");
  });

  it("sizes every target the same, with no text to grow one", () => {
    // Three literals for four rendered buttons: the two branded targets share
    // a map. Fixed-size is the whole point — labelled buttons *nearly* fit at
    // 360px, which is another way of saying they wrap on anything narrower.
    expect(share.match(/grid size-10 place-items-center/g)).toHaveLength(3);
    expect(share).not.toMatch(/px-3(\.5)? py-2/);
  });

  it("names each target for a screen reader, since nothing is written on them", () => {
    expect(share).toContain("aria-label={`شارك على ${label}`}");
    expect(share).toContain('aria-label="شارك في تطبيق آخر"');
    expect(share).toContain("aria-label={copied ? ");
  });
});

describe("where it sits on a demand", () => {
  it("comes after the thread, like it does on a listing", () => {
    const thread = demand.indexOf("<RequestThread");
    const row = demand.indexOf("<ShareButtons");
    expect(thread).toBeGreaterThan(-1);
    expect(row).toBeGreaterThan(thread);
  });
});
