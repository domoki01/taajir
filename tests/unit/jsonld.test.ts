import { describe, expect, it } from "vitest";
import { jsonLdScript } from "@/lib/jsonld";

describe("jsonLdScript", () => {
  it("cannot be closed by a listing title", () => {
    // The payload an attacker would actually use: end the script element, then
    // write markup. Anyone with an account can put this in an ad title, and a
    // clean ad publishes itself.
    const out = jsonLdScript({
      name: "شقة</script><img src=x onerror=alert(1)>",
    });
    expect(out).not.toContain("</script");
    expect(out).not.toContain("<img");
    expect(out).toContain("\\u003c");
  });

  it("survives a round trip, so the page still says what it meant", () => {
    const data = {
      name: "شقة F3 <باب الزوار> & حيدرة",
      description: "قريبة من الترامواي",
    };
    expect(JSON.parse(jsonLdScript(data))).toEqual(data);
  });

  it("escapes the line separators that break an inline script", () => {
    const out = jsonLdScript({ name: "a\u2028b\u2029c" });
    expect(out).not.toContain("\u2028");
    expect(out).not.toContain("\u2029");
    expect(JSON.parse(out).name).toBe("a\u2028b\u2029c");
  });

  it("leaves ordinary Arabic alone", () => {
    expect(JSON.parse(jsonLdScript({ t: "دار للبيع" })).t).toBe("دار للبيع");
  });
});
