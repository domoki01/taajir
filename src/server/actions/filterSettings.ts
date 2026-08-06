"use server";

// ── FILTER SETTINGS ──────────────────────────────────────────────────────────
// Which options the site's search filter offers, and in what order.
//
// Site configuration rather than content, so it is `admin` only — a moderator
// reviews ads, they do not reshape the front page. Every slug is checked
// against the enums before it is written: the screen only ever sends known
// values, but the action is what makes that true.

import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser } from "@/server/auth";
import { kFilterSettingsPath } from "@/server/filterSettings";
import {
  kPropertyTypes,
  kTransactionFilterLabels,
  type PropertyType,
  type TransactionType,
} from "@/lib/enums";

export type FilterSettingsResult = { ok: true } | { ok: false; error: string };

export type FilterSettingsInput = {
  transactionTypeOrder: string[];
  hiddenTransactionTypes: string[];
  propertyTypeOrder: string[];
  hiddenPropertyTypes: string[];
};

/** Keep only known slugs, and only once each. */
function clean<T extends string>(
  input: string[],
  labels: Record<T, string>,
): T[] {
  const known = new Set(Object.keys(labels));
  return [...new Set(input)].filter((s): s is T => known.has(s));
}

export async function saveFilterSettings(
  input: FilterSettingsInput,
): Promise<FilterSettingsResult> {
  const user = await requireUser("/admin/filtre");
  if (user.role !== "admin") {
    return { ok: false, error: "هذا من صلاحيات المشرف العام وحده" };
  }

  const hiddenTransactionTypes = clean<TransactionType>(
    input.hiddenTransactionTypes,
    kTransactionFilterLabels,
  );
  const hiddenPropertyTypes = clean<PropertyType>(
    input.hiddenPropertyTypes,
    kPropertyTypes,
  );

  // An empty dropdown is a broken page, not a configuration. Refuse rather than
  // let someone lock the filter into a state they cannot see to undo.
  if (
    hiddenTransactionTypes.length >=
    Object.keys(kTransactionFilterLabels).length
  ) {
    return { ok: false, error: "لازم تخلّي نوع عملية واحد على الأقل ظاهر" };
  }
  if (hiddenPropertyTypes.length >= Object.keys(kPropertyTypes).length) {
    return { ok: false, error: "لازم تخلّي نوع عقار واحد على الأقل ظاهر" };
  }

  await adminDb()
    .doc(kFilterSettingsPath)
    .set(
      {
        transactionTypeOrder: clean<TransactionType>(
          input.transactionTypeOrder,
          kTransactionFilterLabels,
        ),
        hiddenTransactionTypes,
        propertyTypeOrder: clean<PropertyType>(
          input.propertyTypeOrder,
          kPropertyTypes,
        ),
        hiddenPropertyTypes,
        updatedAt: Date.now(),
        updatedBy: user.uid,
      },
      { merge: false },
    );

  await adminDb()
    .collection("adminAudit")
    .add({
      actorUid: user.uid,
      action: "filter-settings",
      targetType: "settings",
      targetId: "filter",
      note: `مخفي: ${hiddenTransactionTypes.length + hiddenPropertyTypes.length}`,
      at: Date.now(),
    })
    .catch(() => {});

  // The home page is the only cached route that renders the filter — the browse
  // and search routes are dynamic and pick this up on their next request.
  revalidatePath("/");
  revalidatePath("/admin/filtre");
  return { ok: true };
}

/** Back to the code defaults: every option visible, in its original order. */
export async function resetFilterSettings(): Promise<FilterSettingsResult> {
  const user = await requireUser("/admin/filtre");
  if (user.role !== "admin") {
    return { ok: false, error: "هذا من صلاحيات المشرف العام وحده" };
  }

  // Deleted rather than blanked: absent is exactly what "never configured"
  // means, and the reader already falls back to the enums for it.
  await adminDb().doc(kFilterSettingsPath).delete();

  revalidatePath("/");
  revalidatePath("/admin/filtre");
  return { ok: true };
}
