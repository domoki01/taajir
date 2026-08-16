import { describe, expect, it } from "vitest";
import { kDefaultNext, safeNext } from "@/lib/redirect";

describe("safeNext", () => {
  it("keeps an ordinary destination", () => {
    expect(safeNext("/publier?deal=vente")).toBe("/publier?deal=vente");
    expect(safeNext("/demandes/nouvelle")).toBe("/demandes/nouvelle");
  });

  it("refuses to send anyone off the site", () => {
    // Each of these is a link that starts on تأجير, shows the real sign-in
    // form, and lands somewhere else the moment the session exists.
    for (const hostile of [
      "https://evil.dz/login",
      "http://evil.dz",
      "//evil.dz",
      "/\\evil.dz",
      "/\\/evil.dz",
      "javascript:alert(1)",
      "evil.dz",
    ]) {
      expect(safeNext(hostile)).toBe(kDefaultNext);
    }
  });

  it("refuses a control character hidden in the path", () => {
    expect(safeNext("/publier\u0000https://evil.dz")).toBe(kDefaultNext);
    expect(safeNext("/publier\nhttps://evil.dz")).toBe(kDefaultNext);
  });

  it("falls back when there is nothing to go on", () => {
    expect(safeNext(null)).toBe(kDefaultNext);
    expect(safeNext("")).toBe(kDefaultNext);
    expect(safeNext("   ")).toBe(kDefaultNext);
  });

  it("honours a caller's own fallback", () => {
    expect(safeNext("https://evil.dz", "/demandes")).toBe("/demandes");
  });
});
