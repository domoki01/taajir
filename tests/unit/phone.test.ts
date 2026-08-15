import { describe, expect, it } from "vitest";
import { formatLocal, toE164 } from "@/lib/phone";

describe("toE164", () => {
  it("accepts the way Algerians actually type a number", () => {
    // All of these are the same Mobilis number.
    for (const input of [
      "0661234567",
      "0661 23 45 67",
      "066-12-34-567",
      "+213661234567",
      "+213 661 23 45 67",
      "00213661234567",
      "213661234567",
    ]) {
      expect(toE164(input)).toBe("+213661234567");
    }
  });

  it("accepts all three mobile prefixes", () => {
    expect(toE164("0551234567")).toBe("+213551234567"); // Ooredoo
    expect(toE164("0661234567")).toBe("+213661234567"); // Mobilis
    expect(toE164("0771234567")).toBe("+213771234567"); // Djezzy
  });

  it("refuses a landline — an SMS to one never arrives", () => {
    expect(toE164("021234567")).toBeNull(); // Alger landline
    expect(toE164("031234567")).toBeNull(); // Constantine
    expect(toE164("041234567")).toBeNull(); // Oran
  });

  it("refuses the wrong number of digits", () => {
    expect(toE164("066123456")).toBeNull(); // one short
    expect(toE164("06612345678")).toBeNull(); // one long
    expect(toE164("")).toBeNull();
    expect(toE164("06")).toBeNull();
  });

  it("refuses text", () => {
    expect(toE164("رقمي")).toBeNull();
    expect(toE164("not a number")).toBeNull();
  });
});

describe("formatLocal", () => {
  it("shows a number back the way its owner reads it", () => {
    expect(formatLocal("+213661234567")).toBe("0661 23 45 67");
  });

  it("leaves anything it cannot parse alone rather than mangling it", () => {
    expect(formatLocal("+33612345678")).toBe("+33612345678");
  });

  it("round-trips with toE164", () => {
    const e164 = toE164("0661 23 45 67")!;
    expect(toE164(formatLocal(e164))).toBe(e164);
  });
});
