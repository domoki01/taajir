import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

// ── FIELD ENCRYPTION ─────────────────────────────────────────────────────────
// A second lock on the handful of fields that identify a bank account.
//
// Firestore is already encrypted at rest by Google, and that is not what this
// is for. Encryption at rest protects the disk; it decrypts for anybody the
// database answers to, which includes a leaked service-account key, a
// misconfigured export, and a future rule that turns out to be too generous.
// This protects against the copy leaving — a dump of `payouts` without the key
// is a list of amounts, not a list of RIP numbers.
//
// It is deliberately narrow. Encrypting everything would break search, sorting
// and moderation while protecting fields that are public by design: a listing's
// contact phone is printed on the ad. What is encrypted is what a thief would
// actually want and a user could not otherwise recover from: the RIP number, a
// RedotPay id, a Binance handle.

/** Prefix and version, so a stored value says what it is and what to do with it. */
const kPrefix = "enc.v1.";

/**
 * The key, from the environment.
 *
 * Read per call rather than at module load: a module that throws on import
 * takes the whole route down at build time, and the right failure for a missing
 * key is one action returning an error, not a site that will not compile.
 */
function key(): Buffer | null {
  const raw = process.env.FIELD_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  const buf = Buffer.from(raw, "base64");
  // AES-256 needs exactly 32 bytes. A short key silently weakens everything
  // encrypted with it, so a wrong length is refused rather than padded.
  if (buf.length !== 32) {
    console.error(
      `[crypto] FIELD_ENCRYPTION_KEY must be 32 bytes base64, got ${buf.length}`,
    );
    return null;
  }
  return buf;
}

/** Whether writes that need encryption can proceed. */
export function fieldEncryptionReady(): boolean {
  return key() !== null;
}

/**
 * Encrypt one field. Throws when no key is configured.
 *
 * Fails closed on purpose: storing a bank account in plaintext because a secret
 * was not set is exactly the outcome this exists to prevent, and it would be
 * invisible — the feature would look like it worked.
 */
export function encryptField(plain: string): string {
  const k = key();
  if (!k) throw new Error("FIELD_ENCRYPTION_KEY is not configured");

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  // GCM: the tag is what makes this authenticated rather than merely secret —
  // a tampered ciphertext fails to decrypt instead of decrypting to garbage.
  const tag = cipher.getAuthTag();
  return `${kPrefix}${iv.toString("base64")}.${tag.toString("base64")}.${ct.toString("base64")}`;
}

/**
 * Decrypt one field.
 *
 * A value that carries no prefix is returned as it is: rows written before this
 * existed are plaintext, and a moderation screen that showed "�" for them would
 * be worse than one that shows what is there. A value that carries the prefix
 * and fails to decrypt returns a marker rather than throwing — one unreadable
 * row must not take down the page listing the other forty.
 */
export function decryptField(stored: string | null | undefined): string {
  const value = (stored ?? "").trim();
  if (!value.startsWith(kPrefix)) return value;

  const k = key();
  if (!k) return "🔒 (المفتاح ماشي معرّف)";

  try {
    const [ivB64, tagB64, ctB64] = value.slice(kPrefix.length).split(".");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      k,
      Buffer.from(ivB64, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return (
      decipher.update(Buffer.from(ctB64, "base64")).toString("utf8") +
      decipher.final("utf8")
    );
  } catch {
    return "🔒 (ما تفكّش)";
  }
}

/**
 * Compare two secrets without leaking which byte differed.
 *
 * Not used by the fields above — kept here because it belongs with the rest of
 * the crypto and because the obvious `===` is the wrong tool for a token.
 */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}
