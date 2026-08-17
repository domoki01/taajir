import { describe, expect, it } from "vitest";
import {
  kReservedArticleSlugs,
  kSlugPattern,
  normaliseSlug,
  parseBody,
  readingMinutes,
  richRuns,
  toRaw,
} from "@/lib/article";

describe("parseBody", () => {
  it("reads the three prefixes and defaults to a paragraph", () => {
    expect(parseBody("## عنوان\nنصّ عادي\n- نقطة\n> اقتباس")).toEqual([
      { type: "h2", text: "عنوان" },
      { type: "p", text: "نصّ عادي" },
      { type: "li", text: "نقطة" },
      { type: "quote", text: "اقتباس" },
    ]);
  });

  it("drops blank lines rather than making empty blocks", () => {
    expect(parseBody("أوّل\n\n\nثاني")).toHaveLength(2);
  });

  it("never produces markup, whatever is typed", () => {
    // The reason the body is blocks at all: an editor account is one
    // compromised staff login away from script on every page of the site.
    const blocks = parseBody("<script>alert(1)</script>\n<img onerror=x>");
    expect(blocks.every((b) => b.type === "p")).toBe(true);
    // The angle brackets survive as *text*, which React then escapes.
    expect(blocks[0].text).toBe("<script>alert(1)</script>");
  });

  it("round-trips through toRaw so the editor can reopen its own work", () => {
    const raw = "## عنوان\n\nفقرة\n\n- نقطة\n\n> اقتباس";
    expect(toRaw(parseBody(raw))).toBe(raw);
  });
});

describe("richRuns", () => {
  it("splits bold runs out of a paragraph", () => {
    expect(richRuns("خذ **السعر** قبل")).toEqual([
      { text: "خذ ", bold: false },
      { text: "السعر", bold: true },
      { text: " قبل", bold: false },
    ]);
  });

  it("leaves an unclosed marker as literal text", () => {
    // Half a bold run is a typo, and a typo should look like one rather than
    // swallow the rest of the paragraph.
    expect(richRuns("سعر **ناقص")).toEqual([
      { text: "سعر **ناقص", bold: false },
    ]);
  });

  it("returns plain text untouched", () => {
    expect(richRuns("بلا تشكيل")).toEqual([{ text: "بلا تشكيل", bold: false }]);
  });
});

describe("readingMinutes", () => {
  it("never says zero", () => {
    expect(readingMinutes([{ type: "p", text: "كلمة" }])).toBe(1);
  });

  it("rounds up, so a two-minute read is not announced as one", () => {
    const text = Array.from({ length: 200 }, () => "كلمة").join(" ");
    expect(readingMinutes([{ type: "p", text }])).toBe(2);
  });
});

describe("normaliseSlug", () => {
  it("produces the Latin, hyphenated shape every URL here takes", () => {
    expect(normaliseSlug("  Louer Un Logement!! ")).toBe("louer-un-logement");
  });

  it("strips Arabic entirely rather than percent-encoding it", () => {
    // An Arabic slug turns into unreadable bytes in a URL and breaks the
    // WhatsApp preview these articles are shared through.
    expect(normaliseSlug("كراء دار")).toBe("");
    expect(kSlugPattern.test("")).toBe(false);
  });

  it("rejects a slug that would shadow the editor's own route", () => {
    expect(kReservedArticleSlugs.has("nouveau")).toBe(true);
  });

  it("accepts what it produces", () => {
    for (const raw of ["Marché Immobilier — Algérie 2026", "a/b/c", "x_y_z"]) {
      const slug = normaliseSlug(raw);
      if (slug) expect(kSlugPattern.test(slug)).toBe(true);
    }
  });
});
