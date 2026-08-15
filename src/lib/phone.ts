// ── ALGERIAN MOBILE NUMBERS ──────────────────────────────────────────────────
// Firebase wants E.164 (+213…). Algerians type 0X XX XX XX XX and nothing else,
// so the conversion happens here rather than being asked of the person holding
// the phone.

export const kDialCode = "+213";

/**
 * Mobile prefixes, after the leading 0: Mobilis 06, Djezzy 07, Ooredoo 05.
 *
 * Landlines (02x, 03x, 04x…) are excluded on purpose — an SMS to one never
 * arrives, and "الكود ما وصلش" is a far worse thing to debug than being told
 * up front that the number cannot receive one.
 */
const kMobilePrefixes = ["5", "6", "7"];

/** Keep the digits, drop everything a person might type between them. */
export function digitsOnly(input: string): string {
  return input.replace(/\D+/g, "");
}

/**
 * `0661234567`, `+213661234567`, `00213 66 12 34 56 7` → `+213661234567`.
 * Returns null for anything that is not an Algerian mobile number.
 */
export function toE164(input: string): string | null {
  let d = digitsOnly(input);

  if (d.startsWith("00213")) d = d.slice(5);
  else if (d.startsWith("213")) d = d.slice(3);
  else if (d.startsWith("0")) d = d.slice(1);

  // Nine digits after the country code, starting with a mobile prefix.
  if (d.length !== 9 || !kMobilePrefixes.includes(d[0])) return null;
  return `${kDialCode}${d}`;
}

/** `+213661234567` → `0661 23 45 67`, for showing a number back to its owner. */
export function formatLocal(e164: string): string {
  const d = digitsOnly(e164);
  const n = d.startsWith("213") ? d.slice(3) : d;
  if (n.length !== 9) return e164;
  return `0${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7)}`;
}

export const kPhoneHint = "رقم جزائري نقّال: 05، 06 ولا 07";
