"use server";

// ── CATEGORIES AND FILTER ────────────────────────────────────────────────────
// Which options the site's filter offers, in what order, and under what names.
//
// Site configuration rather than content, so it sits behind `taxonomy.edit`.
// Every slug is checked against the resolved taxonomy before it is written: the
// screen only ever sends known values, but the action is what makes that true.

import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import { actorWith, kForbidden } from "@/server/auth";
import {
  getTaxonomy,
  kFilterSettingsPath,
  kSlugPattern,
} from "@/server/filterSettings";
import {
  kPriceUnits,
  kPropertyTypes,
  kTransactionFilterLabels,
  kTransactionTypes,
  type PriceUnit,
} from "@/lib/enums";
import type {
  CustomPropertyType,
  CustomTransactionType,
} from "@/types/filterSettings";

/**
 * Top-level paths a deal slug must not take.
 *
 * Browse lives at /{deal}, so a deal called "publier" would sit in front of the
 * publish form — Next resolves the static segment first, but the deal would
 * then be a page nobody can reach, and the reverse becomes true the moment a
 * route is renamed. Refusing the collision outright is cheaper than debugging
 * it later.
 */
const kReservedSegments = [
  "annonce",
  "demandes",
  "recherche",
  "publier",
  "connexion",
  "inscription",
  "admin",
  "api",
  "tableau-de-bord",
  "merci",
  "bienvenue",
  "lancement",
  "aide",
  "cgu",
  "confidentialite",
  "securite",
  "a-propos",
];

export type FilterSettingsResult = { ok: true } | { ok: false; error: string };

export type FilterRow = {
  slug: string;
  label: string;
  hidden: boolean;
};

export type FilterSettingsInput = {
  transactionTypes: FilterRow[];
  propertyTypes: FilterRow[];
};

const kLabel = { min: 2, max: 40 };

/** Split rows into order, hidden set and renamed labels, keeping only known slugs. */
function split(
  rows: FilterRow[],
  known: Set<string>,
  base: Record<string, string>,
) {
  const order: string[] = [];
  const hidden: string[] = [];
  const labels: Record<string, string> = {};

  for (const row of rows) {
    if (!known.has(row.slug) || order.includes(row.slug)) continue;
    order.push(row.slug);
    if (row.hidden) hidden.push(row.slug);

    const label = row.label.trim();
    // Only stored when it differs from the code default. Storing every label
    // would freeze the wording: a copy fix shipped in `enums.ts` would be
    // overridden by a settings document written before it.
    if (label && label !== base[row.slug]) labels[row.slug] = label;
  }

  return { order, hidden, labels };
}

function badLabel(rows: FilterRow[]): string | null {
  for (const row of rows) {
    const label = row.label.trim();
    if (label.length < kLabel.min || label.length > kLabel.max) {
      return `التسمية «${label}» لازم بين ${kLabel.min} و${kLabel.max} حرف`;
    }
  }
  return null;
}

export async function saveFilterSettings(
  input: FilterSettingsInput,
): Promise<FilterSettingsResult> {
  const user = await actorWith("taxonomy.edit");
  if (!user) return { ok: false, error: kForbidden };

  const taxonomy = await getTaxonomy();
  const deals = new Set(Object.keys(taxonomy.transactionFilterLabels));
  const types = new Set(Object.keys(taxonomy.propertyTypes));

  const bad = badLabel(input.transactionTypes) ?? badLabel(input.propertyTypes);
  if (bad) return { ok: false, error: bad };

  const t = split(input.transactionTypes, deals, kTransactionFilterLabels);
  const p = split(input.propertyTypes, types, taxonomy.propertyTypes);

  // An empty dropdown is a broken page, not a configuration. Refuse rather than
  // let someone lock the filter into a state they cannot see to undo.
  if (t.hidden.length >= deals.size) {
    return { ok: false, error: "لازم تخلّي نوع عملية واحد على الأقل ظاهر" };
  }
  if (p.hidden.length >= types.size) {
    return { ok: false, error: "لازم تخلّي نوع عقار واحد على الأقل ظاهر" };
  }

  // Custom rows are rewritten from the posted labels so a rename lands on the
  // definition rather than piling a label override on top of it.
  const settings = await adminDb().doc(kFilterSettingsPath).get();
  const existingCustom = (settings.data()?.customPropertyTypes ??
    []) as CustomPropertyType[];
  const renamed = new Map(
    input.propertyTypes.map((r) => [r.slug, r.label.trim()]),
  );
  const customPropertyTypes = existingCustom
    .filter((c) => types.has(c.slug))
    .map((c) => ({ slug: c.slug, label: renamed.get(c.slug) || c.label }));

  // The same for custom deals — and this write is `merge: false`, so a custom
  // deal missing from the payload is not left alone, it is deleted. The rows
  // this screen edits carry the *search* wording, so a rename lands on
  // `filterLabel` and the posting wording is left as it was.
  const existingDeals = (settings.data()?.customTransactionTypes ??
    []) as CustomTransactionType[];
  const renamedDeals = new Map(
    input.transactionTypes.map((r) => [r.slug, r.label.trim()]),
  );
  const customTransactionTypes = existingDeals
    .filter((c) => deals.has(c.slug))
    .map((c) => ({
      ...c,
      filterLabel: renamedDeals.get(c.slug) || c.filterLabel || c.label,
    }));

  // A custom slug is not a built-in, so its label is its definition, not an
  // override — drop it from the override map or it would be stored twice.
  for (const slug of taxonomy.customSlugs) delete p.labels[slug];
  for (const slug of taxonomy.customTransactionSlugs) delete t.labels[slug];

  await adminDb().doc(kFilterSettingsPath).set(
    {
      transactionTypeOrder: t.order,
      hiddenTransactionTypes: t.hidden,
      transactionLabels: t.labels,
      propertyTypeOrder: p.order,
      hiddenPropertyTypes: p.hidden,
      propertyLabels: p.labels,
      customPropertyTypes,
      customTransactionTypes,
      updatedAt: Date.now(),
      updatedBy: user.uid,
    },
    { merge: false },
  );

  await audit(
    user.uid,
    "filter-settings",
    `مخفي: ${t.hidden.length + p.hidden.length}`,
  );
  refresh();
  return { ok: true };
}

/**
 * Add a category.
 *
 * The slug is permanent from this moment on: it goes into `/vente/{slug}/alger`
 * and into every listing document filed under it. Renaming is the label; there
 * is no rename for the slug, only a delete of an unused one.
 */
export async function addPropertyType(
  slug: string,
  label: string,
): Promise<FilterSettingsResult> {
  const user = await actorWith("taxonomy.edit");
  if (!user) return { ok: false, error: kForbidden };

  const clean = slug.trim().toLowerCase();
  if (!kSlugPattern.test(clean)) {
    return {
      ok: false,
      error: "المعرّف: حروف لاتينية صغيرة وأرقام وشرطات، من 3 حروف",
    };
  }
  if (clean in kPropertyTypes) {
    return { ok: false, error: "المعرّف محجوز لفئة أساسية" };
  }

  const name = label.trim();
  if (name.length < kLabel.min || name.length > kLabel.max) {
    return {
      ok: false,
      error: `التسمية لازم بين ${kLabel.min} و${kLabel.max} حرف`,
    };
  }

  const taxonomy = await getTaxonomy();
  if (clean in taxonomy.propertyTypes) {
    return { ok: false, error: "الفئة موجودة من قبل" };
  }

  const ref = adminDb().doc(kFilterSettingsPath);
  const snap = await ref.get();
  const existing = (snap.data()?.customPropertyTypes ??
    []) as CustomPropertyType[];

  await ref.set(
    {
      customPropertyTypes: [...existing, { slug: clean, label: name }],
      updatedAt: Date.now(),
      updatedBy: user.uid,
    },
    { merge: true },
  );

  await audit(user.uid, "filter.type-add", clean);
  refresh();
  return { ok: true };
}

/**
 * Add a deal — a third thing to do with a property, beside selling and renting.
 *
 * The one field that is not a label is `priceUnit`, and it is the whole reason
 * this action can exist at all. A deal is the only category the code reasons
 * about numerically: the unit beside the price, and through `unitIsRental` the
 * scale the price is bucketed on. Declared here, it is read from the taxonomy
 * everywhere else, so no other file needs to learn the new deal's name.
 */
export async function addTransactionType(
  slug: string,
  label: string,
  filterLabel: string,
  priceUnit: string,
): Promise<FilterSettingsResult> {
  const user = await actorWith("taxonomy.edit");
  if (!user) return { ok: false, error: kForbidden };

  const clean = slug.trim().toLowerCase();
  if (!kSlugPattern.test(clean)) {
    return {
      ok: false,
      error: "المعرّف: حروف لاتينية صغيرة وأرقام وشرطات، من 3 حروف",
    };
  }
  if (clean in kTransactionTypes) {
    return { ok: false, error: "المعرّف محجوز لعملية أساسية" };
  }
  // The browse route is /{deal}/{type}/{wilaya}; a deal slug that collides with
  // a top-level route would shadow that page for good.
  if (kReservedSegments.includes(clean)) {
    return { ok: false, error: "المعرّف محجوز لصفحة في الموقع" };
  }

  const name = label.trim();
  if (name.length < kLabel.min || name.length > kLabel.max) {
    return {
      ok: false,
      error: `التسمية لازم بين ${kLabel.min} و${kLabel.max} حرف`,
    };
  }

  const searchName = filterLabel.trim();
  if (searchName && searchName.length > kLabel.max) {
    return { ok: false, error: `تسمية البحث طويلة — أقصى ${kLabel.max} حرف` };
  }

  if (!(priceUnit in kPriceUnits)) {
    return { ok: false, error: "وحدة السعر ماشي صحيحة" };
  }

  const taxonomy = await getTaxonomy();
  if (clean in taxonomy.transactionTypes) {
    return { ok: false, error: "العملية موجودة من قبل" };
  }

  const ref = adminDb().doc(kFilterSettingsPath);
  const snap = await ref.get();
  const existing = (snap.data()?.customTransactionTypes ??
    []) as CustomTransactionType[];

  await ref.set(
    {
      customTransactionTypes: [
        ...existing,
        {
          slug: clean,
          label: name,
          filterLabel: searchName || name,
          priceUnit: priceUnit as PriceUnit,
        },
      ],
      updatedAt: Date.now(),
      updatedBy: user.uid,
    },
    { merge: true },
  );

  await audit(user.uid, "filter.deal-add", `${clean}:${priceUnit}`);
  refresh();
  return { ok: true };
}

/** Remove a deal the admin added, on the same terms as a property type. */
export async function deleteTransactionType(
  slug: string,
): Promise<FilterSettingsResult> {
  const user = await actorWith("taxonomy.edit");
  if (!user) return { ok: false, error: kForbidden };

  if (slug in kTransactionTypes) {
    return { ok: false, error: "العمليات الأساسية تتخبّى برك، ما تتمسحش" };
  }

  const taxonomy = await getTaxonomy();
  if (!taxonomy.customTransactionSlugs.includes(slug)) return { ok: true };

  let used: number;
  try {
    const snap = await adminDb()
      .collection("listings")
      .where("transactionType", "==", slug)
      .count()
      .get();
    used = snap.data().count;
  } catch (error) {
    console.error("[filter] deal usage count failed:", error);
    return { ok: false, error: "ما قدرناش نعدّو الإعلانات، عاود من بعد" };
  }

  if (used > 0) {
    return {
      ok: false,
      error: `فيه ${used} إعلان في هذي العملية — خبّيها بدل ما تمسحها`,
    };
  }

  const ref = adminDb().doc(kFilterSettingsPath);
  const snap = await ref.get();
  const existing = (snap.data()?.customTransactionTypes ??
    []) as CustomTransactionType[];

  await ref.set(
    {
      customTransactionTypes: existing.filter((c) => c.slug !== slug),
      updatedAt: Date.now(),
      updatedBy: user.uid,
    },
    { merge: true },
  );

  await audit(user.uid, "filter.deal-delete", slug);
  refresh();
  return { ok: true };
}

/**
 * Remove a category the admin added — but only while nothing is filed under it.
 *
 * A listing whose `propertyType` no longer resolves has no label, drops out of
 * the filter and keeps a URL that now 404s. Counting first is one aggregation
 * query; the alternative is discovering the problem from a seller whose paid ad
 * stopped working.
 */
export async function deletePropertyType(
  slug: string,
): Promise<FilterSettingsResult> {
  const user = await actorWith("taxonomy.edit");
  if (!user) return { ok: false, error: kForbidden };

  if (slug in kPropertyTypes) {
    return { ok: false, error: "الفئات الأساسية تتخبّى برك، ما تتمسحش" };
  }

  const taxonomy = await getTaxonomy();
  if (!taxonomy.customSlugs.includes(slug)) return { ok: true };

  let used: number;
  try {
    const snap = await adminDb()
      .collection("listings")
      .where("propertyType", "==", slug)
      .count()
      .get();
    used = snap.data().count;
  } catch (error) {
    console.error("[filter] usage count failed:", error);
    return { ok: false, error: "ما قدرناش نعدّو الإعلانات، عاود من بعد" };
  }

  if (used > 0) {
    return {
      ok: false,
      error: `فيه ${used} إعلان في هذي الفئة — خبّيها بدل ما تمسحها`,
    };
  }

  const ref = adminDb().doc(kFilterSettingsPath);
  const snap = await ref.get();
  const existing = (snap.data()?.customPropertyTypes ??
    []) as CustomPropertyType[];

  await ref.set(
    {
      customPropertyTypes: existing.filter((c) => c.slug !== slug),
      updatedAt: Date.now(),
      updatedBy: user.uid,
    },
    { merge: true },
  );

  await audit(user.uid, "filter.type-delete", slug);
  refresh();
  return { ok: true };
}

/** Back to the code defaults: every option visible, in its original order. */
export async function resetFilterSettings(): Promise<FilterSettingsResult> {
  const user = await actorWith("taxonomy.edit");
  if (!user) return { ok: false, error: kForbidden };

  const taxonomy = await getTaxonomy();
  if (taxonomy.customSlugs.length > 0) {
    // Reset is "undo my presentation changes", not "delete my categories". The
    // second one has its own button, per category, with a usage check behind it.
    return {
      ok: false,
      error: "امسح الفئات المخصّصة الأوّل، من بعد رجّع الافتراضي",
    };
  }

  // Deleted rather than blanked: absent is exactly what "never configured"
  // means, and the reader already falls back to the enums for it.
  await adminDb().doc(kFilterSettingsPath).delete();

  refresh();
  return { ok: true };
}

async function audit(actorUid: string, action: string, note: string) {
  await adminDb()
    .collection("adminAudit")
    .add({
      actorUid,
      action,
      targetType: "settings",
      targetId: "filter",
      note,
      at: Date.now(),
    })
    .catch(() => {});
}

/**
 * The home page is the only cached route that renders the filter — the browse
 * and search routes are dynamic and pick this up on their next request. The
 * sitemap is regenerated because a new category adds routes to it.
 */
function refresh() {
  revalidatePath("/");
  revalidatePath("/admin/filtre");
  revalidatePath("/sitemap.xml");
}
