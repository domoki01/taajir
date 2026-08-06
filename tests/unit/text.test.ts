import { describe, expect, it } from "vitest";
import { containsLink } from "@/lib/text";

describe("containsLink", () => {
  it("catches an ordinary URL", () => {
    for (const s of [
      "شوف هنا https://example.com/promo",
      "http://immo-dz.net",
      "زور www.example.dz",
      "WWW.EXAMPLE.COM",
    ]) {
      expect(containsLink(s), s).toBe(true);
    }
  });

  it("catches a bare domain with no scheme", () => {
    for (const s of [
      "عندي شقة، شوف example.com",
      "t.me/canal_immo",
      "bit.ly/abcd",
      "wa.me/213555123456",
      "الموقع تاعنا immo.dz",
    ]) {
      expect(containsLink(s), s).toBe(true);
    }
  });

  // Someone who has just been told links are blocked writes the next one like
  // this. Catching only the plain form would make the rule decorative.
  it("catches the usual evasions", () => {
    for (const s of [
      "example[.]com",
      "example (dot) com",
      "example نقطة com",
      "example . com",
      "t . me / canal",
      "EXAMPLE(.)COM",
    ]) {
      expect(containsLink(s), s).toBe(true);
    }
  });

  it("leaves ordinary Arabic alone", () => {
    for (const s of [
      "نشري شقة F3 في باب الزوار، الميزانية 800 مليون.",
      "عندي فيلا في وهران. مساحة 250 م². الوثائق كاملة.",
      "الطابق الثالث. السعر 4.5 مليون في الشهر.",
      "اتصل بيا في الصباح، من 9.30 حتى 12.00",
      "شقة . كبيرة . وقريبة من المترو",
    ]) {
      expect(containsLink(s), s).toBe(false);
    }
  });

  // The permissive "label dot two-letters" pattern flags these, which is why
  // the TLD list is explicit.
  it("does not flag Latin prose that merely has a full stop", () => {
    for (const s of [
      "Nice apartment.Very big and bright.",
      "Bonjour.Je cherche un F3.",
      "F3.Bab Ezzouar.Negociable",
    ]) {
      expect(containsLink(s), s).toBe(false);
    }
  });
});
