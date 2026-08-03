import { describe, expect, it } from "vitest";
import {
  areaBucket,
  bucketLabel,
  bucketsInRange,
  formatPrice,
  formatPriceExact,
  formatPriceWithUnit,
  fromDinars,
  priceBucket,
  toDinars,
} from "@/lib/price";

// The unit conversion is the single highest-risk piece of arithmetic in the
// codebase: confusing dinars with ملايين misprices a listing by 10 000x.

describe("unit conversion", () => {
  it("reads ملايين as ten thousand dinars each", () => {
    expect(toDinars(800, "million")).toBe(8_000_000);
    expect(toDinars(3.5, "million")).toBe(35_000);
    expect(toDinars(45_000, "dzd")).toBe(45_000);
  });

  it("round-trips without drift", () => {
    for (const dinars of [35_000, 8_000_000, 250_000, 12_500_000]) {
      expect(toDinars(fromDinars(dinars, "million"), "million")).toBe(dinars);
      expect(toDinars(fromDinars(dinars, "dzd"), "dzd")).toBe(dinars);
    }
  });

  it("never returns a fractional dinar", () => {
    expect(Number.isInteger(toDinars(3.33333, "million"))).toBe(true);
  });
});

describe("formatting", () => {
  it("speaks in ملايين the way a seller would", () => {
    expect(formatPrice(8_000_000)).toBe("800 مليون");
    expect(formatPrice(35_000)).toBe("3.5 مليون");
    expect(formatPrice(12_000_000)).toBe("1,200 مليون");
  });

  it("falls back to dinars below one مليون", () => {
    expect(formatPrice(8_000)).toBe("8,000 دج");
    expect(formatPrice(9_999)).toBe("9,999 دج");
    expect(formatPrice(10_000)).toBe("1 مليون");
  });

  it("drops a meaningless decimal", () => {
    expect(formatPrice(50_000)).toBe("5 مليون");
    expect(formatPrice(55_000)).toBe("5.5 مليون");
  });

  it("treats a missing or zero price as negotiable", () => {
    expect(formatPrice(0)).toBe("السعر بالاتفاق");
    expect(formatPrice(Number.NaN)).toBe("السعر بالاتفاق");
    expect(formatPriceExact(-1)).toBe("السعر بالاتفاق");
  });

  it("appends the period for rentals only", () => {
    expect(formatPriceWithUnit(45_000, "mois")).toBe("4.5 مليون في الشهر");
    expect(formatPriceWithUnit(8_000_000, "total")).toBe("800 مليون");
  });
});

describe("query buckets", () => {
  it("separates the sale and rent scales", () => {
    // 35 000 DZD is a mid-range monthly rent but a nonsense sale price, so the
    // same number must land in different buckets under each scale.
    expect(priceBucket(35_000, true)).toBe("r_3");
    expect(priceBucket(35_000, false)).toBe("s_0");
  });

  it("puts a value on an edge into the upper bucket", () => {
    expect(priceBucket(2_000_000, false)).toBe("s_1");
    expect(priceBucket(1_999_999, false)).toBe("s_0");
  });

  it("caps at the open-ended top bucket", () => {
    expect(priceBucket(500_000_000, false)).toBe("s_8");
    expect(priceBucket(1_000_000, true)).toBe("r_7");
  });

  it("expands a range into every overlapping bucket", () => {
    expect(bucketsInRange(2_000_000, 6_000_000, false)).toEqual([
      "s_1",
      "s_2",
      "s_3",
    ]);
  });

  it("treats an open range as unbounded on that side", () => {
    expect(bucketsInRange(null, 4_000_000, false)).toEqual([
      "s_0",
      "s_1",
      "s_2",
    ]);
    expect(bucketsInRange(35_000_000, null, false)).toEqual(["s_7", "s_8"]);
  });

  it("stays within the 30-value ceiling of a Firestore `in` filter", () => {
    expect(bucketsInRange(null, null, false).length).toBeLessThanOrEqual(30);
    expect(bucketsInRange(null, null, true).length).toBeLessThanOrEqual(30);
  });

  it("buckets area on its own scale", () => {
    expect(areaBucket(85)).toBe("a_2");
    expect(areaBucket(10)).toBe("a_0");
    expect(areaBucket(5_000)).toBe("a_7");
  });
});

describe("bucket labels", () => {
  it("phrases the ends as open ranges", () => {
    expect(bucketLabel(0, false)).toBe("أقل من 200 مليون");
    expect(bucketLabel(8, false)).toBe("أكثر من 6,000 مليون");
  });

  it("phrases the middle as a span", () => {
    expect(bucketLabel(2, false)).toBe("400 مليون — 600 مليون");
  });
});
