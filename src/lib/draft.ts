// ── THE UNFINISHED AD ────────────────────────────────────────────────────────
// The publish wizard is nine screens, and finishing it can send you away from
// the page: somebody arriving from /bienvenue has no account yet, fills the
// whole thing in, and only at the end is offered حساب جديد. Before this, that
// hand-off returned them to an empty form — the funnel's own visitors paying
// the highest price for having come through it.
//
// So the form keeps a copy on the device. Not a feature so much as the missing
// half of asking for the account last.

/**
 * Versioned. A draft is restored field by field into a form that has since
 * changed shape, and the failure is silent — a value landing in a field that no
 * longer means the same thing. Bumping the suffix retires every stored draft
 * instead of trying to migrate one.
 */
export const kListingDraftKey = "taajir:draft:listing:1";

/**
 * A week. Long enough to cover signing up, losing the phone signal, and coming
 * back tomorrow; short enough that a draft nobody finished stops resurfacing on
 * a form somebody is now using for a different property.
 */
export const kDraftMaxAgeMs = 7 * 24 * 60 * 60 * 1000;

export type Draft<T> = { savedAt: number; values: T };

/**
 * Read a draft back, or null.
 *
 * Every failure is a null rather than a throw. localStorage is refused outright
 * in some in-app browsers and in private mode, the stored string can be
 * anything, and none of that is worth taking the form away over — the worst
 * case is the form a visitor would have had anyway.
 */
export function readDraft<T>(
  key: string,
  now = Date.now(),
  maxAgeMs = kDraftMaxAgeMs,
): Draft<T> | null {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<Draft<T>>;
    if (typeof parsed?.savedAt !== "number" || !parsed.values) return null;
    // A savedAt in the future is a clock that moved, not a fresh draft. Treated
    // as expired: a phone whose date is wrong would otherwise hold one forever.
    const age = now - parsed.savedAt;
    if (age < 0 || age > maxAgeMs) return null;

    return { savedAt: parsed.savedAt, values: parsed.values as T };
  } catch {
    return null;
  }
}

/** Save, best-effort. A full quota must never break the form being typed into. */
export function writeDraft<T>(key: string, values: T): void {
  try {
    globalThis.localStorage?.setItem(
      key,
      JSON.stringify({ savedAt: Date.now(), values }),
    );
  } catch {
    // Quota, private mode, a browser refusing storage. Nothing to do and
    // nothing worth saying: the form in front of them still works.
  }
}

export function clearDraft(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // Same.
  }
}
