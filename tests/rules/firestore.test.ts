// ── FIRESTORE RULES ──────────────────────────────────────────────────────────
// Run against the emulator:
//
//   npm run test:rules
//
// These are the highest-value tests in the project. The rules are what stand
// between a paid promotion tier and anyone who can open a browser console, and
// catalogev shipped with no rules in version control at all — so every claim
// made in firestore.rules is asserted here rather than assumed.

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  where,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let env: RulesTestEnvironment;

const kOwner = "owner-uid";
const kOther = "other-uid";

const authed = (uid: string, claims: Record<string, unknown> = {}) =>
  env.authenticatedContext(uid, claims).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const admin = () => authed("admin-uid", { role: "admin" });

const publishedListing = {
  ownerUid: kOwner,
  status: "published",
  title: "شقة F3 في باب الزوار",
  price: 8_000_000,
  isFeatured: false,
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-taajir",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});

afterAll(async () => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  // Seed through a context that bypasses rules, the way a Server Action would.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "listings/pub-1"), publishedListing);
    await setDoc(doc(db, "listings/draft-1"), {
      ...publishedListing,
      status: "draft",
    });
    await setDoc(doc(db, "users/" + kOwner), {
      role: "user",
      displayName: "صاحب الإعلان",
      isBanned: false,
      activeListingCount: 1,
      listingQuota: 3,
    });
    await setDoc(doc(db, "payments/pay-1"), {
      subjectId: kOwner,
      status: "awaitingReview",
      amountDzd: 5000,
      provider: "manual_ccp",
    });
    await setDoc(doc(db, "plans/basic"), { isActive: true, priceDzd: 5000 });
    await setDoc(doc(db, "catalog/prod-1"), { code: "b36" });
  });
});

describe("listings", () => {
  it("lets anyone read a published listing", async () => {
    await assertSucceeds(getDoc(doc(anon(), "listings/pub-1")));
  });

  it("hides an unpublished listing from the public", async () => {
    await assertFails(getDoc(doc(anon(), "listings/draft-1")));
    await assertFails(getDoc(doc(authed(kOther), "listings/draft-1")));
  });

  // `get` and `list` are separate operations with different failure modes. The
  // browse pages query the collection, and an early version of these rules read
  // resource.data.status without a default — every `get` test passed while every
  // query on the site returned permission-denied.
  it("lets anyone query published listings", async () => {
    const q = query(
      collection(anon(), "listings"),
      where("status", "==", "published"),
    );
    const snap = await assertSucceeds(getDocs(q));
    expect(snap.size).toBe(1);
  });

  it("survives a document that is missing the fields the rule inspects", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      // A half-written ad, or one from an older schema.
      await setDoc(doc(ctx.firestore(), "listings/broken-1"), {
        title: "ناقص",
      });
    });
    const q = query(
      collection(anon(), "listings"),
      where("status", "==", "published"),
    );
    await assertSucceeds(getDocs(q));
  });

  it("refuses an unconstrained query over the whole collection", async () => {
    await assertFails(getDocs(collection(anon(), "listings")));
  });

  it("lets the owner and an admin read their own draft", async () => {
    await assertSucceeds(getDoc(doc(authed(kOwner), "listings/draft-1")));
    await assertSucceeds(getDoc(doc(admin(), "listings/draft-1")));
  });

  // The central claim of the whole design: listings are server-written only.
  it("refuses every client write, including the owner's", async () => {
    await assertFails(
      setDoc(doc(authed(kOwner), "listings/new-1"), publishedListing),
    );
    await assertFails(
      updateDoc(doc(authed(kOwner), "listings/pub-1"), { price: 1 }),
    );
    await assertFails(deleteDoc(doc(authed(kOwner), "listings/pub-1")));
  });

  it("refuses a client granting itself paid promotion", async () => {
    await assertFails(
      updateDoc(doc(authed(kOwner), "listings/pub-1"), { isFeatured: true }),
    );
    await assertFails(
      updateDoc(doc(authed(kOwner), "listings/draft-1"), {
        status: "published",
      }),
    );
  });

  it("refuses writes even from an admin, who must go through the server", async () => {
    await assertFails(
      updateDoc(doc(admin(), "listings/pub-1"), { isFeatured: true }),
    );
  });
});

describe("users", () => {
  it("lets a user edit their own profile fields", async () => {
    await assertSucceeds(
      updateDoc(doc(authed(kOwner), "users/" + kOwner), {
        displayName: "اسم جديد",
        phone: "+213555000000",
      }),
    );
  });

  it("refuses a user raising their own quota, role or ban state", async () => {
    await assertFails(
      updateDoc(doc(authed(kOwner), "users/" + kOwner), { listingQuota: 999 }),
    );
    await assertFails(
      updateDoc(doc(authed(kOwner), "users/" + kOwner), { role: "admin" }),
    );
    // The value must actually differ from what is stored: writing a field back
    // unchanged produces no diff, so `onlyChanged` sees an empty key set and
    // correctly allows the no-op.
    await assertFails(
      updateDoc(doc(authed(kOwner), "users/" + kOwner), { isBanned: true }),
    );
  });

  it("keeps one user out of another's document", async () => {
    await assertFails(getDoc(doc(authed(kOther), "users/" + kOwner)));
    await assertFails(
      updateDoc(doc(authed(kOther), "users/" + kOwner), {
        displayName: "hacked",
      }),
    );
  });

  it("refuses a self-registration that claims a role", async () => {
    await assertFails(
      setDoc(doc(authed(kOther), "users/" + kOther), {
        role: "admin",
        isBanned: false,
        activeListingCount: 0,
      }),
    );
    await assertSucceeds(
      setDoc(doc(authed(kOther), "users/" + kOther), {
        role: "user",
        isBanned: false,
        activeListingCount: 0,
      }),
    );
  });
});

describe("payments", () => {
  it("lets a payer submit a transfer receipt for review", async () => {
    await assertSucceeds(
      setDoc(doc(authed(kOther), "payments/pay-2"), {
        subjectId: kOther,
        status: "awaitingReview",
        provider: "manual_baridimob",
        amountDzd: 5000,
        createdAt: serverTimestamp(),
      }),
    );
  });

  it("refuses a payment that declares itself already paid", async () => {
    await assertFails(
      setDoc(doc(authed(kOther), "payments/pay-3"), {
        subjectId: kOther,
        status: "paid",
        provider: "manual_ccp",
        amountDzd: 5000,
        createdAt: serverTimestamp(),
      }),
    );
  });

  it("refuses a payer marking their own payment paid", async () => {
    await assertFails(
      updateDoc(doc(authed(kOwner), "payments/pay-1"), { status: "paid" }),
    );
  });

  it("refuses a payment submitted on someone else's behalf", async () => {
    await assertFails(
      setDoc(doc(authed(kOther), "payments/pay-4"), {
        subjectId: kOwner,
        status: "awaitingReview",
        provider: "manual_ccp",
        amountDzd: 5000,
        createdAt: serverTimestamp(),
      }),
    );
  });

  it("keeps a receipt private to its payer and admins", async () => {
    await assertSucceeds(getDoc(doc(authed(kOwner), "payments/pay-1")));
    await assertSucceeds(getDoc(doc(admin(), "payments/pay-1")));
    await assertFails(getDoc(doc(authed(kOther), "payments/pay-1")));
  });
});

describe("plans", () => {
  it("is publicly readable but never client-writable", async () => {
    await assertSucceeds(getDoc(doc(anon(), "plans/basic")));
    await assertFails(
      updateDoc(doc(authed(kOwner), "plans/basic"), { priceDzd: 1 }),
    );
    await assertFails(updateDoc(doc(admin(), "plans/basic"), { priceDzd: 1 }));
  });
});

describe("catalogev coexistence", () => {
  // This Firebase project is shared with a live product. Deploying these rules
  // must not take it down.
  it("preserves the catalog collection's own access rules", async () => {
    await assertSucceeds(getDoc(doc(anon(), "catalog/prod-1")));
    await assertSucceeds(
      updateDoc(doc(authed(kOther), "catalog/prod-1"), { code: "b37" }),
    );
    await assertFails(
      updateDoc(doc(anon(), "catalog/prod-1"), { code: "b38" }),
    );
  });
});

describe("default deny", () => {
  it("refuses collections the rules do not mention", async () => {
    await assertFails(getDoc(doc(anon(), "whatever/doc-1")));
    await assertFails(setDoc(doc(admin(), "whatever/doc-1"), { a: 1 }));
  });
});
