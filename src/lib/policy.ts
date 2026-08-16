// ── CONTENT POLICY ───────────────────────────────────────────────────────────
// What a post has to clear before it goes live, and why each rule is here.
//
// This runs on every listing and every demand at submission. Clean content
// publishes itself; a certain violation is refused with a reason the author can
// act on; anything in between is handed to a human. That third outcome is the
// point — a filter with only two answers either lets scams through or blocks
// honest sellers, and on a property site both are expensive.
//
// Every rule is a pure function of the text, so the whole thing is unit-tested
// against real Algerian phrasing rather than trusted by eye.

import { containsLink } from "@/lib/text";

export type PolicyDecision = "clean" | "reject" | "review";

export type PolicyVerdict = {
  decision: PolicyDecision;
  /** Stable id for the audit trail. Empty when clean. */
  rule: string;
  /** Arabic, addressed to the author, and specific enough to act on. */
  reason: string;
};

const kClean: PolicyVerdict = { decision: "clean", rule: "", reason: "" };

/**
 * Fold the spellings that mean the same word.
 *
 * Arabic gets written with and without diacritics, with أ/إ/آ/ا interchanged,
 * with ة/ه and ى/ي swapped, and with tatweel stretching letters apart. Someone
 * evading a filter reaches for exactly those, so the comparison happens after
 * they are collapsed.
 */
export function normalizeArabic(input: string): string {
  return input
    .replace(/[ً-ٰٟ]/g, "") // harakat
    .replace(/ـ/g, "") // tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ؤئ]/g, "ء")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

/**
 * Insults and obscenity, Arabic/derja and French.
 *
 * Matched as whole words against the normalised text. Substring matching is
 * what makes filters infamous — it is the reason "Scunthorpe" is a byword —
 * and Arabic makes it worse, because short roots sit inside ordinary words.
 */
const kProfanity = [
  "زبي",
  "كس امك",
  "كسامك",
  "نيك",
  "ننيك",
  "نيكمك",
  "قحبة",
  "قحبه",
  "قحاب",
  "زامل",
  "شرموطة",
  "شرموطه",
  "حمار",
  "كلب ابن",
  "ولد القحبة",
  "ولد القحبه",
  // Deliberately NOT here: "علق" (the site's own reply button says «علّق»,
  // and تعليق/معلق are everywhere) and "طحان" (a common surname and a trade).
  // Both are mild derja insults and neither is worth the false positives.
  "putain",
  "salope",
  "connard",
  "enculé",
  "encule",
  "merde",
  "nique",
  "pute",
  "fuck",
  "bitch",
  "asshole",
];

/**
 * Advance-fee and payment-redirection scams.
 *
 * These are the ones that actually run on Algerian property listings: a deposit
 * wired abroad for a flat the "owner" is conveniently out of the country to
 * show. Money leaves the country and there is no recovering it, so this tier
 * refuses rather than queues.
 *
 * Note what is deliberately absent: قرض/سلفة/تمويل. A buyer writing "نشري
 * بقرض بنكي" is describing how they will pay, which is ordinary and true.
 */
const kScam = [
  "western union",
  "westernunion",
  "ويسترن يونيون",
  "moneygram",
  "موني قرام",
  "موني غرام",
  "bitcoin",
  "بيتكوين",
  "بتكوين",
  "usdt",
  "crypto",
  "كريبتو",
  "عملة رقمية",
  "عمله رقميه",
  "binance",
  "بينانس",
  "skrill",
  "paypal",
  "payeer",
];

/**
 * Off-topic recruitment and immigration spam.
 *
 * Reviewed rather than refused: "قرب الجامعة" and "قرب المدرسة" are selling
 * points, and a landlord may legitimately mention that a flat suits students or
 * workers. Only a human can tell that apart from a visa broker.
 */
const kOffTopic = [
  "تاشيره",
  "تاشيرة",
  "فيزا شنغن",
  "هجره",
  "الهجرة",
  "عقد عمل",
  "وظيفه شاغره",
  "وظيفة شاغرة",
  "توظيف",
  "recrutement",
  "visa schengen",
];

/**
 * Arabic proclitics, which attach with no space: و ف ب ك ل and the article ال.
 *
 * Without this the matcher is useless in Arabic — "القحبه" and "بالبيتكوين"
 * both walk straight past a plain whole-word test, and they are the forms
 * people actually write. Only these six letters are allowed to lead, so an
 * unrelated word that merely ends in a banned string still does not match.
 */
const kProclitic = "[وفبكل]{0,2}(?:ال)?";

/** Word match against already-normalised text, tolerant of attached prefixes. */
function hasTerm(normalized: string, terms: string[]): string | null {
  for (const term of terms) {
    const t = normalizeArabic(term);
    // Arabic has no case and few word boundaries JS understands, so the guard
    // is an explicit non-letter (or string edge) on each side.
    const pattern = new RegExp(
      `(^|[^\\p{L}\\p{N}])${kProclitic}${escapeRegExp(t)}($|[^\\p{L}\\p{N}])`,
      "u",
    );
    if (pattern.test(normalized)) return term;
  }
  return null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * One character or word hammered over and over — "شقة شقة شقة شقة" — which is
 * keyword stuffing rather than a description.
 */
function looksSpammy(text: string): boolean {
  if (/(.)\1{7,}/u.test(text)) return true;

  const words = text.split(/\s+/).filter((w) => w.length > 2);
  if (words.length < 8) return false;

  const unique = new Set(words.map((w) => normalizeArabic(w)));
  // Fewer than a third of the words are distinct.
  return unique.size * 3 < words.length;
}

export const kPolicyReasons = {
  links:
    "المنشور فيه رابط. الروابط ممنوعة — حطّ التفاصيل في الوصف والتواصل يتمّ عبر المنصّة.",
  profanity: "المنشور فيه ألفاظ نابية. اكتب وصف محترم وعاود انشر.",
  scam: "المنشور فيه إشارة لطرق دفع ممنوعة (تحويل خارجي ولا عملة رقمية). المعاملات تتمّ مباشرة بين الطرفين في الجزائر.",
  offtopic: "المنشور يبان ماشي على عقار. راه عند المراجعة.",
  spam: "المنشور فيه تكرار كثير. راه عند المراجعة.",
} as const;

/**
 * Judge one post.
 *
 * Title and description are judged together: splitting them lets a violation
 * hide in whichever field is checked less carefully.
 */
export function checkPolicy(input: {
  title: string;
  description: string;
}): PolicyVerdict {
  const raw = `${input.title}\n${input.description}`;
  const normalized = normalizeArabic(raw);

  // ── refuse ───────────────────────────────────────────────────────────────
  // Checked against the raw text: containsLink does its own folding, and
  // normalising first would eat the dots it keys on.
  if (containsLink(raw)) {
    return { decision: "reject", rule: "links", reason: kPolicyReasons.links };
  }

  const profanity = hasTerm(normalized, kProfanity);
  if (profanity) {
    return {
      decision: "reject",
      rule: "profanity",
      reason: kPolicyReasons.profanity,
    };
  }

  const scam = hasTerm(normalized, kScam);
  if (scam) {
    return { decision: "reject", rule: "scam", reason: kPolicyReasons.scam };
  }

  // ── hand to a human ──────────────────────────────────────────────────────
  const offTopic = hasTerm(normalized, kOffTopic);
  if (offTopic) {
    return {
      decision: "review",
      rule: "offtopic",
      reason: kPolicyReasons.offtopic,
    };
  }

  if (looksSpammy(raw)) {
    return { decision: "review", rule: "spam", reason: kPolicyReasons.spam };
  }

  return kClean;
}
