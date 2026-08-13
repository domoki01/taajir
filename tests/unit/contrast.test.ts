import { describe, expect, it } from "vitest";
import { contrastRatio, kAaNormal, luminance, parseHex } from "@/lib/contrast";

describe("parseHex", () => {
  it("reads #rrggbb", () => {
    expect(parseHex("#ffffff")).toEqual([255, 255, 255]);
    expect(parseHex("#000000")).toEqual([0, 0, 0]);
    expect(parseHex("#1E293B")).toEqual([30, 41, 59]);
  });

  it("refuses anything else", () => {
    for (const bad of ["#fff", "1e293b", "#gggggg", "", "red", "#1e293b7"]) {
      expect(parseHex(bad)).toBeNull();
    }
  });
});

describe("luminance", () => {
  it("anchors at the two ends of the scale", () => {
    expect(luminance("#ffffff")).toBeCloseTo(1, 5);
    expect(luminance("#000000")).toBeCloseTo(0, 5);
  });
});

describe("contrastRatio", () => {
  it("gives 21:1 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 2);
  });

  it("gives 1:1 for a colour against itself", () => {
    expect(contrastRatio("#059669", "#059669")).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    const a = contrastRatio("#1e293b", "#ffffff");
    const b = contrastRatio("#ffffff", "#1e293b");
    expect(a).toBeCloseTo(b!, 10);
  });

  it("passes AA for the navy half of the palette the site ships with", () => {
    // These are the pairs the branding screen checks. If a change to
    // globals.css ever drops one of them below the floor, this fails here
    // rather than in someone's sunlight.
    expect(contrastRatio("#1e293b", "#ffffff")!).toBeGreaterThan(kAaNormal);
    expect(contrastRatio("#0f172a", "#ffffff")!).toBeGreaterThan(kAaNormal);
    expect(contrastRatio("#047857", "#ffffff")!).toBeGreaterThan(kAaNormal);
    // The navy badge on its own soft background.
    expect(contrastRatio("#1e293b", "#dde5f0")!).toBeGreaterThan(kAaNormal);
  });

  it("records that the shipped accent is below AA against white", () => {
    // Not an assertion that this is fine — it is not. `--color-accent`
    // (#059669) carries white 14px bold text on every filled button, which is
    // "normal text" under WCAG, so the floor is 4.5:1 and the button sits at
    // 3.77:1. The branding screen flags it on first open, which is how this was
    // found. Changing the brand colour is the site owner's call, so this test
    // pins the current value rather than silently accepting any value: if
    // someone darkens the emerald to fix it, this fails and gets updated on
    // purpose. `accent-strong` (#047857) already clears the bar.
    expect(contrastRatio("#059669", "#ffffff")!).toBeCloseTo(3.77, 2);
    expect(contrastRatio("#059669", "#ffffff")!).toBeLessThan(kAaNormal);
  });

  it("catches a brand colour that is too light for white text", () => {
    // A mid-emerald that looks fine in a colour picker and is unreadable with
    // white on top — exactly the mistake the warning exists to catch.
    expect(contrastRatio("#34d399", "#ffffff")!).toBeLessThan(kAaNormal);
  });

  it("returns null rather than guessing when a colour is unparseable", () => {
    expect(contrastRatio("nope", "#ffffff")).toBeNull();
  });
});
