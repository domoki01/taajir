// ── THE ADMIN'S SWITCHES, WRITTEN AND READ BACK ──────────────────────────────
// `saveAffiliateSettings` replaces the settings document outright rather than
// merging into it, which is the right call — a switch turned off has to
// actually disappear — but it means every field the form owns must be named in
// the write. A field left out is not "unchanged": it is gone, and the reader
// then serves the default in its place. That failure is silent, so it gets a
// test that saves a full form and reads every switch back.

import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-taajir";
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";

/** Flipped by the test that checks a non-admin is refused. */
let permitted = true;

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/server/auth", () => ({
  requireUser: async () => ({
    uid: "admin-uid",
    email: null,
    name: "مشرف",
    role: "admin",
    permissions: ["affiliate.manage"],
  }),
  getUser: async () => null,
  actorWith: async () => (permitted ? { uid: "admin-uid" } : null),
  kForbidden: "ماشي من صلاحياتك",
}));

const { adminDb } = await import("@/lib/firebase/admin");
const { kAffiliateSettingsPath, getAffiliateSettings } =
  await import("@/server/affiliate");
const { saveAffiliateSettings } = await import("@/server/actions/affiliate");
const { kDefaultAffiliateSettings } = await import("@/types/affiliate");

const db = adminDb();

/** Everything the admin form sends, with every boolean flipped off its default. */
const kForm = {
  ...kDefaultAffiliateSettings,
  perReferral: 111,
  contestPopup: false,
  enabled: true,
  channels: {
    listingSlot: false,
    featured: false,
    redotpay: true,
    ccp: true,
  },
};

beforeEach(async () => {
  permitted = true;
  await db.doc(kAffiliateSettingsPath).delete();
});

describe("saveAffiliateSettings", () => {
  it("keeps every switch the form sent, including the sign-up popup", async () => {
    expect(await saveAffiliateSettings(kForm)).toMatchObject({ ok: true });

    const saved = await getAffiliateSettings();
    expect(saved.contestPopup).toBe(false);
    expect(saved.enabled).toBe(true);
    expect(saved.perReferral).toBe(111);
    expect(saved.channels).toEqual(kForm.channels);
  });

  it("turns the popup back on", async () => {
    await saveAffiliateSettings({ ...kForm, contestPopup: true });

    expect((await getAffiliateSettings()).contestPopup).toBe(true);
  });

  it("defaults the popup on for a form that predates the field", async () => {
    // An older client posting a body with no `contestPopup` must not be read as
    // a request to switch it off.
    const legacy: Record<string, unknown> = { ...kForm };
    delete legacy.contestPopup;

    await saveAffiliateSettings(legacy);

    expect((await getAffiliateSettings()).contestPopup).toBe(true);
  });

  it("refuses somebody without the permission, and writes nothing", async () => {
    permitted = false;

    expect(await saveAffiliateSettings(kForm)).toMatchObject({ ok: false });
    expect((await db.doc(kAffiliateSettingsPath).get()).exists).toBe(false);
  });
});
