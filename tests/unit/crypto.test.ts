// ── FIELD ENCRYPTION ─────────────────────────────────────────────────────────
// The key is read per call from the environment, so each test sets it and the
// module needs no re-import.

import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decryptField,
  encryptField,
  fieldEncryptionReady,
  safeEqual,
} from "@/server/crypto";

const kKey = randomBytes(32).toString("base64");
const original = process.env.FIELD_ENCRYPTION_KEY;

beforeEach(() => {
  process.env.FIELD_ENCRYPTION_KEY = kKey;
});
afterEach(() => {
  if (original === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
  else process.env.FIELD_ENCRYPTION_KEY = original;
});

describe("encryptField / decryptField", () => {
  it("round-trips a RIP number", () => {
    const rip = "00799999000123456789";
    const stored = encryptField(rip);
    expect(stored).not.toContain(rip);
    expect(decryptField(stored)).toBe(rip);
  });

  it("round-trips Arabic and unicode", () => {
    const value = "بريدي موب ٠٥٥١ ٣١ ٠٠ ١٤";
    expect(decryptField(encryptField(value))).toBe(value);
  });

  it("produces a different ciphertext every time", () => {
    // A fresh IV per call: identical RIP numbers from two users must not look
    // identical in the database, or the encryption leaks who shares an account.
    const a = encryptField("00799999000123456789");
    const b = encryptField("00799999000123456789");
    expect(a).not.toBe(b);
    expect(decryptField(a)).toBe(decryptField(b));
  });

  it("refuses to decrypt a tampered ciphertext", () => {
    // GCM is authenticated: a flipped byte fails the tag rather than decrypting
    // to something plausible.
    const stored = encryptField("00799999000123456789");
    const parts = stored.split(".");
    const ct = Buffer.from(parts[4], "base64");
    ct[0] ^= 0xff;
    parts[4] = ct.toString("base64");
    expect(decryptField(parts.join("."))).toBe("🔒 (ما تفكّش)");
  });

  it("refuses a ciphertext encrypted under another key", () => {
    const stored = encryptField("00799999000123456789");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    expect(decryptField(stored)).toBe("🔒 (ما تفكّش)");
  });

  it("passes plaintext through, so rows written before this still read", () => {
    expect(decryptField("00799999000123456789")).toBe("00799999000123456789");
    expect(decryptField(null)).toBe("");
  });

  it("fails closed when no key is configured", () => {
    delete process.env.FIELD_ENCRYPTION_KEY;
    expect(fieldEncryptionReady()).toBe(false);
    // Storing a bank account in the clear because a secret was missing is the
    // exact outcome this exists to prevent, so it throws rather than degrades.
    expect(() => encryptField("00799999000123456789")).toThrow();
  });

  it("refuses a key of the wrong length rather than padding it", () => {
    process.env.FIELD_ENCRYPTION_KEY = Buffer.alloc(16).toString("base64");
    expect(fieldEncryptionReady()).toBe(false);
    expect(() => encryptField("x")).toThrow();
  });
});

describe("safeEqual", () => {
  it("compares equal and unequal secrets", () => {
    expect(safeEqual("token", "token")).toBe(true);
    expect(safeEqual("token", "toker")).toBe(false);
    expect(safeEqual("token", "tokens")).toBe(false);
  });
});
