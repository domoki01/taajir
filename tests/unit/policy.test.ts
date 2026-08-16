import { describe, expect, it } from "vitest";
import { checkPolicy, normalizeArabic } from "@/lib/policy";

const check = (title: string, description: string) =>
  checkPolicy({ title, description });

describe("normalizeArabic", () => {
  it("folds the spellings of the same word", () => {
    expect(normalizeArabic("شِقَّة")).toBe(normalizeArabic("شقه"));
    expect(normalizeArabic("أحمد")).toBe(normalizeArabic("احمد"));
    expect(normalizeArabic("مصطــفى")).toBe(normalizeArabic("مصطفي"));
  });
});

describe("honest posts publish themselves", () => {
  // The expensive failure mode is not letting spam through — it is refusing a
  // real seller, who does not come back. These are ordinary Algerian listings.
  const honest: Array<[string, string]> = [
    [
      "شقة F3 للكراء في باب الزوار",
      "شقة واسعة في الطابق الثاني، قريبة من الترامواي والمدرسة، مع كراج. السعر قابل للنقاش.",
    ],
    [
      "نشري دار في وهران",
      "نحوّس على دار بعقد موثق، ميزانيتي 800 مليون، ونشري بقرض بنكي إذا لزم الأمر.",
    ],
    [
      "أرض فلاحية 5 هكتار في المدية",
      "أرض مسقية بدفتر عقاري، صالحة للاستثمار الفلاحي، قريبة من الطريق الوطني.",
    ],
    [
      "استوديو مفروش قرب الجامعة",
      "يصلح للطلبة، فيه كل التجهيزات، الكراء شهري ويشمل الماء والكهرباء.",
    ],
    [
      "فيلا للبيع في حيدرة",
      "فيلا R+2 على مساحة 400 م²، حديقة ومسبح، عقد موثق، السعر بالاتفاق.",
    ],
    [
      "محل تجاري في وسط المدينة",
      "محل 60 م² على الشارع الرئيسي، يصلح لأي نشاط تجاري، دفتر شروط جاهز.",
    ],
  ];

  for (const [title, body] of honest) {
    it(`publishes «${title}»`, () => {
      expect(check(title, body).decision).toBe("clean");
    });
  }
});

describe("links are refused", () => {
  it("catches a plain domain", () => {
    const v = check("شقة للكراء", "شوف الصور في example.com وتواصل معايا");
    expect(v.decision).toBe("reject");
    expect(v.rule).toBe("links");
  });

  it("catches an obfuscated one", () => {
    expect(check("شقة", "زورو mysite [.] com للتفاصيل").decision).toBe(
      "reject",
    );
    expect(check("شقة", "الموقع example نقطة dz فيه كلش").decision).toBe(
      "reject",
    );
  });

  it("does not trip on ordinary Arabic prose with full stops", () => {
    expect(
      check("شقة F3", "الشقة كبيرة. الحمام جديد. المطبخ مجهّز.").decision,
    ).toBe("clean");
  });
});

describe("profanity is refused", () => {
  it("catches an insult in the description", () => {
    const v = check("شقة للكراء", "الجيران ولاد القحبة ما نتحملهمش");
    expect(v.decision).toBe("reject");
    expect(v.rule).toBe("profanity");
  });

  it("catches French obscenity", () => {
    expect(check("Appartement", "putain de quartier").decision).toBe("reject");
  });

  it("catches a term wearing the definite article", () => {
    // Arabic attaches ال / بال / وال with no space. A whole-word matcher that
    // does not know that catches nothing anyone actually writes.
    expect(check("شقة", "الجيران القحبة").decision).toBe("reject");
    expect(check("فيلا", "الدفع بالبيتكوين").decision).toBe("reject");
  });

  it("leaves the site's own vocabulary alone", () => {
    // "علّق" is the reply button on every card in the demand feed, and
    // تعليق/التعليقات are all over the product. A profanity list containing
    // "علق" would reject posts for quoting the UI at them.
    expect(check("شقة للكراء", "علّق هنا وناقشني في السعر").decision).toBe(
      "clean",
    );
    expect(check("دار للبيع", "شوف التعليقات تحت").decision).toBe("clean");
  });

  it("does not fire on a word that merely contains a short root", () => {
    // "نيك" sits inside plenty of innocent strings; whole-word matching is what
    // keeps this from being the Scunthorpe problem in Arabic.
    expect(check("شقة في عين النعجة", "حي هادئ وقريب من كلش").decision).toBe(
      "clean",
    );
    expect(check("دار في تيزي وزو", "المنطقة مليحة بزاف").decision).toBe(
      "clean",
    );
  });
});

describe("payment scams are refused", () => {
  it("catches a wire-transfer demand", () => {
    const v = check(
      "شقة رخيصة جداً",
      "راني برّا، ابعثلي العربون عبر Western Union ونبعثلك المفاتيح",
    );
    expect(v.decision).toBe("reject");
    expect(v.rule).toBe("scam");
  });

  it("catches crypto", () => {
    expect(check("فيلا", "نقبل الدفع بالبيتكوين برك").decision).toBe("reject");
    expect(check("فيلا", "الدفع USDT فقط").decision).toBe("reject");
  });

  it("leaves an ordinary bank loan alone", () => {
    // A buyer saying how they will pay is not a scam, and refusing this would
    // block a large share of genuine Algerian buyers.
    expect(
      check("نشري شقة", "عندي قرض بنكي موافق عليه ونشري كاش الباقي").decision,
    ).toBe("clean");
    expect(check("نشري دار", "نخلّص بالتقسيط مع سلفة من البنك").decision).toBe(
      "clean",
    );
  });
});

describe("uncertain posts go to a human, not to the bin", () => {
  it("flags off-topic recruitment", () => {
    const v = check("عقد عمل في الخارج", "نوفرو تأشيرة وعقد عمل لأوروبا");
    expect(v.decision).toBe("review");
    expect(v.rule).toBe("offtopic");
  });

  it("still publishes a flat that merely mentions students", () => {
    expect(
      check("استوديو للطلبة", "قريب من الجامعة ويصلح للطلبة والعمال").decision,
    ).toBe("clean");
  });

  it("flags keyword stuffing", () => {
    const v = check(
      "شقة شقة شقة",
      "شقة شقة شقة شقة شقة شقة شقة شقة شقة شقة شقة شقة",
    );
    expect(v.decision).toBe("review");
    expect(v.rule).toBe("spam");
  });

  it("flags a wall of one repeated character", () => {
    expect(check("شقة", `للبيع بسرعة${"!".repeat(12)}`).decision).toBe(
      "review",
    );
  });
});

describe("the verdict is actionable", () => {
  it("gives a refused author a reason in Arabic", () => {
    const v = check("شقة", "تواصل على example.com");
    expect(v.decision).toBe("reject");
    expect(v.reason.length).toBeGreaterThan(20);
    // No English leaking into a message the seller reads.
    expect(/[a-z]{4,}/i.test(v.reason.replace(/[a-z]*\./gi, ""))).toBe(false);
  });

  it("says nothing when there is nothing to say", () => {
    const v = check("شقة F3 في الجزائر", "شقة مليحة في حي هادئ قرب كل الخدمات");
    expect(v).toEqual({ decision: "clean", rule: "", reason: "" });
  });
});
