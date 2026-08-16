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
    await setDoc(doc(db, "listings/pub-1/comments/c-1"), {
      listingId: "pub-1",
      authorUid: kOther,
      authorName: "زائر",
      isOwner: false,
      text: "الطابق الكم؟",
      status: "visible",
      createdAt: 1,
    });
    await setDoc(doc(db, "listings/pub-1/comments/c-hidden"), {
      listingId: "pub-1",
      authorUid: kOther,
      authorName: "زائر",
      isOwner: false,
      text: "سبام",
      status: "hidden",
      createdAt: 2,
    });
    await setDoc(doc(db, "promos/promo-1"), {
      title: "وكالة الأمل",
      imageUrl: "https://example.com/a.webp",
      storagePath: "promos/a.webp",
      linkUrl: "https://example.com",
      isActive: true,
      order: 0,
    });
    await setDoc(doc(db, "promos/promo-hidden"), {
      title: "منتهي",
      imageUrl: "https://example.com/b.webp",
      storagePath: "promos/b.webp",
      linkUrl: "https://example.com",
      isActive: false,
      order: 1,
    });
    await setDoc(doc(db, "savedSearches/alert-1"), {
      ownerUid: kOwner,
      transactionType: "location",
      propertyType: "appartement",
      wilayaSlug: "alger",
      communeSlug: "bab-ezzouar",
      label: "شقق للكراء في باب الزوار، الجزائر",
      notify: true,
      createdAt: 1,
      lastNotifiedAt: null,
      matchCount: 0,
    });
    await setDoc(doc(db, `users/${kOwner}/devices/dev-1`), {
      token: "fcm-token-value",
      userAgent: "Mozilla/5.0",
      updatedAt: 1,
    });
    await setDoc(doc(db, "requests/req-1"), {
      ownerUid: kOwner,
      ownerName: "طالب",
      intent: "vente",
      title: "نشري شقة F3 في باب الزوار",
      description: "ميزانية 800 مليون، الطابق ماشي مهم.",
      wilayaSlug: "alger",
      communeSlug: "bab-ezzouar",
      status: "visible",
      replyCount: 1,
      createdAt: 1,
    });
    await setDoc(doc(db, "requests/req-hidden"), {
      ownerUid: kOther,
      status: "hidden",
      title: "سبام",
      wilayaSlug: "alger",
      createdAt: 2,
    });
    await setDoc(doc(db, "requests/req-1/replies/rep-1"), {
      requestId: "req-1",
      authorUid: kOther,
      authorName: "بائع",
      isOwner: false,
      text: "عندي شقة تناسبك",
      listing: { id: "pub-1", slug: "chqa", title: "شقة F3", price: 8000000 },
      status: "visible",
      createdAt: 3,
    });
    await setDoc(doc(db, "settings/filter"), {
      hiddenPropertyTypes: ["hangar"],
      hiddenTransactionTypes: [],
      propertyTypeOrder: ["appartement", "villa"],
      transactionTypeOrder: [],
      updatedAt: 1,
      updatedBy: "admin-uid",
    });
    await setDoc(doc(db, "requests/req-pending"), {
      ownerUid: kOwner,
      ownerName: "صاحب الطلب",
      intent: "vente",
      title: "طلب عند المراجعة",
      description: "نحوّس على دار",
      wilayaSlug: "alger",
      communeSlug: null,
      status: "pending",
      hiddenReason: null,
      rejectionReason: null,
      policyRule: "offtopic",
      moderatedBy: null,
      moderatedAt: null,
      replyCount: 0,
      createdAt: 5,
    });
    await setDoc(doc(db, "requests/req-rejected"), {
      ownerUid: kOwner,
      ownerName: "صاحب الطلب",
      intent: "vente",
      title: "طلب مرفوض",
      description: "نحوّس على دار",
      wilayaSlug: "alger",
      communeSlug: null,
      status: "rejected",
      hiddenReason: null,
      rejectionReason: "المنشور فيه رابط.",
      policyRule: "links",
      moderatedBy: "admin-uid",
      moderatedAt: 6,
      replyCount: 0,
      createdAt: 6,
    });
    await setDoc(doc(db, "settings/branding"), {
      siteName: "تأجير",
      tagline: "عقارات الجزائر",
      colors: { primary: "#1e293b" },
      logoUrl: null,
      updatedAt: 1,
      updatedBy: "admin-uid",
    });
    await setDoc(doc(db, "settings/roles"), {
      roles: {
        moderator: {
          label: "مشرف",
          permissions: ["listings.moderate"],
          builtin: true,
        },
      },
      updatedAt: 1,
      updatedBy: "admin-uid",
    });
    await setDoc(doc(db, "settings/access"), {
      requireApproval: false,
      updatedAt: 1,
      updatedBy: "admin-uid",
    });
    await setDoc(doc(db, "settings/launch"), {
      state: "prelaunch",
      launchAt: 9_999_999_999_999,
      launchedAt: null,
      updatedAt: 1,
      updatedBy: "admin-uid",
    });
    await setDoc(doc(db, "launchOutbox/out-1"), {
      uid: kOwner,
      channel: "email",
      target: "someone@example.com",
      status: "queued",
      error: null,
      createdAt: 1,
      sentAt: null,
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

describe("comments", () => {
  const thread = (db: ReturnType<typeof anon>) =>
    collection(db, "listings/pub-1/comments");

  it("lets anyone read the visible thread", async () => {
    const snap = await assertSucceeds(
      getDocs(query(thread(anon()), where("status", "==", "visible"))),
    );
    expect(snap.size).toBe(1);
  });

  it("hides a hidden comment from the public but not from its author", async () => {
    await assertFails(getDoc(doc(anon(), "listings/pub-1/comments/c-hidden")));
    await assertSucceeds(
      getDoc(doc(authed(kOther), "listings/pub-1/comments/c-hidden")),
    );
    await assertSucceeds(
      getDoc(doc(admin(), "listings/pub-1/comments/c-hidden")),
    );
  });

  // Same failure mode the listings rules were bitten by: a `get` would pass
  // while every thread query on the site returned permission-denied.
  it("survives a comment missing the fields the rule inspects", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "listings/pub-1/comments/c-old"), {
        text: "من نسخة قديمة",
      });
    });
    await assertSucceeds(
      getDocs(query(thread(anon()), where("status", "==", "visible"))),
    );
  });

  // The point of the feature: the author name and the "صاحب الإعلان" badge are
  // denormalized from the session, so a client that could write here could
  // impersonate the owner of the ad it is commenting on.
  it("refuses every client write, signed in or not", async () => {
    const forged = {
      listingId: "pub-1",
      authorUid: kOwner,
      authorName: "وكالة موثّقة",
      isOwner: true,
      text: "تواصل معي على هذا الرقم",
      status: "visible",
      createdAt: 3,
    };
    await assertFails(
      setDoc(doc(authed(kOther), "listings/pub-1/comments/c-forged"), forged),
    );
    await assertFails(
      setDoc(doc(anon(), "listings/pub-1/comments/c-anon"), forged),
    );
    await assertFails(
      updateDoc(doc(authed(kOther), "listings/pub-1/comments/c-1"), {
        text: "معدّل",
      }),
    );
    // Even deleting your own goes through the Server Action, which is what
    // lets it revalidate the cached listing page.
    await assertFails(
      deleteDoc(doc(authed(kOther), "listings/pub-1/comments/c-1")),
    );
    await assertFails(
      updateDoc(doc(admin(), "listings/pub-1/comments/c-1"), {
        status: "hidden",
      }),
    );
  });

  it("does not expose the thread of an unpublished listing", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "listings/draft-1/comments/c-2"), {
        listingId: "draft-1",
        authorUid: kOther,
        text: "سؤال",
        status: "visible",
        createdAt: 1,
      });
    });
    // Documented gap, asserted so it is a decision rather than a surprise: the
    // subcollection rule stands alone, so a guessed listing id would expose a
    // draft's thread. It is not reachable in practice — comments are only ever
    // created on published ads — and closing it would cost a get() on the
    // parent for every comment read. Revisit if drafts ever gain comments.
    await assertSucceeds(getDoc(doc(anon(), "listings/draft-1/comments/c-2")));
  });
});

describe("promos", () => {
  it("lets anyone query the active banners", async () => {
    const snap = await assertSucceeds(
      getDocs(
        query(collection(anon(), "promos"), where("isActive", "==", true)),
      ),
    );
    expect(snap.size).toBe(1);
  });

  it("hides an inactive banner from the public", async () => {
    await assertFails(getDoc(doc(anon(), "promos/promo-hidden")));
    await assertSucceeds(getDoc(doc(admin(), "promos/promo-hidden")));
  });

  it("survives a banner missing the fields the rule inspects", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "promos/promo-old"), { title: "ناقص" });
    });
    await assertSucceeds(
      getDocs(
        query(collection(anon(), "promos"), where("isActive", "==", true)),
      ),
    );
  });

  // Write access to this collection is write access to the first image and the
  // first link on the front page, so it is denied to clients outright — staff
  // included, exactly as for listings.
  it("refuses every client write, admins included", async () => {
    const banner = {
      title: "إشهار مزوّر",
      imageUrl: "https://evil.example/a.webp",
      linkUrl: "https://evil.example",
      isActive: true,
      order: 0,
    };
    await assertFails(setDoc(doc(anon(), "promos/x"), banner));
    await assertFails(setDoc(doc(authed(kOther), "promos/x"), banner));
    await assertFails(setDoc(doc(admin(), "promos/x"), banner));
    await assertFails(
      updateDoc(doc(admin(), "promos/promo-1"), {
        linkUrl: "https://evil.example",
      }),
    );
    await assertFails(deleteDoc(doc(admin(), "promos/promo-1")));
  });
});

describe("saved searches", () => {
  it("lets someone read their own alerts and nobody else's", async () => {
    await assertSucceeds(getDoc(doc(authed(kOwner), "savedSearches/alert-1")));
    await assertFails(getDoc(doc(authed(kOther), "savedSearches/alert-1")));
    await assertFails(getDoc(doc(anon(), "savedSearches/alert-1")));
  });

  // A saved search decides who receives a push. A client that could write one
  // could point an alert at someone else's account and turn their phone into a
  // spam target, so creates go through a Server Action that derives the label,
  // caps the count and rejects duplicates.
  it("refuses every client write, owner included", async () => {
    const alert = {
      ownerUid: kOther,
      wilayaSlug: "alger",
      communeSlug: null,
      transactionType: null,
      propertyType: null,
      label: "كلش",
      notify: true,
      createdAt: 2,
      lastNotifiedAt: null,
      matchCount: 0,
    };
    await assertFails(setDoc(doc(anon(), "savedSearches/x"), alert));
    await assertFails(setDoc(doc(authed(kOther), "savedSearches/x"), alert));
    // Not even for oneself: the cap and the derived label only hold server-side.
    await assertFails(
      setDoc(doc(authed(kOwner), "savedSearches/y"), {
        ...alert,
        ownerUid: kOwner,
      }),
    );
    await assertFails(
      updateDoc(doc(authed(kOwner), "savedSearches/alert-1"), {
        notify: false,
      }),
    );
    await assertFails(deleteDoc(doc(authed(kOwner), "savedSearches/alert-1")));
  });

  it("survives an alert written before ownerUid existed", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "savedSearches/legacy"), {
        label: "ناقص",
      });
    });
    await assertFails(getDoc(doc(authed(kOwner), "savedSearches/legacy")));
  });
});

describe("push devices", () => {
  // The document holds an FCM registration token, which is a capability: anyone
  // who reads it can be sent to, and anyone who writes one can redirect another
  // account's notifications to their own browser.
  it("hides device tokens from every client, owner and admin alike", async () => {
    await assertFails(
      getDoc(doc(authed(kOwner), `users/${kOwner}/devices/dev-1`)),
    );
    await assertFails(getDoc(doc(admin(), `users/${kOwner}/devices/dev-1`)));
    await assertFails(
      setDoc(doc(authed(kOwner), `users/${kOwner}/devices/dev-2`), {
        token: "mine",
      }),
    );
    await assertFails(
      setDoc(doc(authed(kOther), `users/${kOwner}/devices/dev-2`), {
        token: "theirs",
      }),
    );
    await assertFails(
      deleteDoc(doc(authed(kOwner), `users/${kOwner}/devices/dev-1`)),
    );
  });
});

describe("property requests", () => {
  it("lets anyone query the visible demand feed", async () => {
    const snap = await assertSucceeds(
      getDocs(
        query(collection(anon(), "requests"), where("status", "==", "visible")),
      ),
    );
    expect(snap.size).toBe(1);
  });

  it("hides a hidden request from everyone but its author and staff", async () => {
    await assertFails(getDoc(doc(anon(), "requests/req-hidden")));
    await assertFails(getDoc(doc(authed(kOwner), "requests/req-hidden")));
    await assertSucceeds(getDoc(doc(authed(kOther), "requests/req-hidden")));
    await assertSucceeds(getDoc(doc(admin(), "requests/req-hidden")));
  });

  it("survives a request written before status existed", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "requests/req-old"), { title: "ناقص" });
    });
    await assertSucceeds(
      getDocs(
        query(collection(anon(), "requests"), where("status", "==", "visible")),
      ),
    );
  });

  it("refuses every client write, author included", async () => {
    const request = {
      ownerUid: kOwner,
      ownerName: "وكالة موثّقة",
      intent: "vente",
      title: "طلب مزوّر",
      description: "…",
      wilayaSlug: "alger",
      communeSlug: null,
      status: "visible",
      replyCount: 0,
      createdAt: 4,
    };
    await assertFails(setDoc(doc(anon(), "requests/x"), request));
    await assertFails(setDoc(doc(authed(kOwner), "requests/x"), request));
    await assertFails(setDoc(doc(admin(), "requests/x"), request));
    // replyCount decides what a feed card claims, and ownerName is the identity
    // the post is published under — neither is the client's to set.
    await assertFails(
      updateDoc(doc(authed(kOwner), "requests/req-1"), { replyCount: 999 }),
    );
    await assertFails(deleteDoc(doc(authed(kOwner), "requests/req-1")));
  });
});

describe("request replies", () => {
  it("lets anyone read a visible reply", async () => {
    await assertSucceeds(getDoc(doc(anon(), "requests/req-1/replies/rep-1")));
  });

  // The attached listing carries a title, a price and a link, all denormalized.
  // A writable reply is an advertisement that can wear any ad's name.
  it("refuses every client write, including the attachment", async () => {
    const reply = {
      requestId: "req-1",
      authorUid: kOther,
      authorName: "بائع",
      isOwner: false,
      text: "شوف هذا",
      listing: {
        id: "pub-1",
        slug: "evil",
        title: "فيلا بلاش",
        price: 1,
      },
      status: "visible",
      createdAt: 5,
    };
    await assertFails(setDoc(doc(anon(), "requests/req-1/replies/x"), reply));
    await assertFails(
      setDoc(doc(authed(kOther), "requests/req-1/replies/x"), reply),
    );
    await assertFails(
      updateDoc(doc(authed(kOther), "requests/req-1/replies/rep-1"), {
        listing: { id: "pub-1", slug: "evil", title: "مزوّر", price: 1 },
      }),
    );
    await assertFails(
      deleteDoc(doc(authed(kOther), "requests/req-1/replies/rep-1")),
    );
  });
});

describe("moderated demands", () => {
  // The whole point of the moderation notice is that the author can go and read
  // why. If the rules hid a rejected demand from its own author, the reason
  // would exist and be unreachable.
  it("lets an author read their own pending and rejected demands", async () => {
    await assertSucceeds(getDoc(doc(authed(kOwner), "requests/req-pending")));
    await assertSucceeds(getDoc(doc(authed(kOwner), "requests/req-rejected")));
  });

  it("hides them from everyone else", async () => {
    await assertFails(getDoc(doc(anon(), "requests/req-pending")));
    await assertFails(getDoc(doc(anon(), "requests/req-rejected")));
    await assertFails(getDoc(doc(authed(kOther), "requests/req-pending")));
    await assertFails(getDoc(doc(authed(kOther), "requests/req-rejected")));
  });

  it("lets staff read them", async () => {
    await assertSucceeds(getDoc(doc(admin(), "requests/req-pending")));
    await assertSucceeds(getDoc(doc(admin(), "requests/req-rejected")));
  });

  it("still refuses every client write, author included", async () => {
    // A client that could flip its own status to "visible" would make the whole
    // moderation system decorative.
    await assertFails(
      updateDoc(doc(authed(kOwner), "requests/req-rejected"), {
        status: "visible",
      }),
    );
    await assertFails(
      updateDoc(doc(admin(), "requests/req-pending"), { status: "visible" }),
    );
  });
});

describe("site settings", () => {
  it("is publicly readable — it decides what the filter shows", async () => {
    await assertSucceeds(getDoc(doc(anon(), "settings/filter")));
  });

  // Writing this reshapes the front page for every visitor, so it goes through
  // a Server Action that checks the admin role and validates every slug.
  it("refuses every client write, admins included", async () => {
    const settings = {
      hiddenPropertyTypes: [],
      hiddenTransactionTypes: [],
      propertyTypeOrder: [],
      transactionTypeOrder: [],
      updatedAt: 2,
      updatedBy: kOther,
    };
    await assertFails(setDoc(doc(anon(), "settings/filter"), settings));
    await assertFails(setDoc(doc(authed(kOther), "settings/filter"), settings));
    await assertFails(setDoc(doc(admin(), "settings/filter"), settings));
    await assertFails(
      updateDoc(doc(admin(), "settings/filter"), { hiddenPropertyTypes: [] }),
    );
    await assertFails(deleteDoc(doc(admin(), "settings/filter")));
  });

  it("keeps branding public — the whole site is painted from it", async () => {
    await assertSucceeds(getDoc(doc(anon(), "settings/branding")));
  });

  it("refuses every client write to branding, admins included", async () => {
    const branding = { siteName: "مخترق", tagline: "x", colors: {} };
    await assertFails(setDoc(doc(anon(), "settings/branding"), branding));
    await assertFails(setDoc(doc(admin(), "settings/branding"), branding));
  });

  // Roles decide what everyone else may do, and the approval flag decides who
  // may post. Neither says anything a visitor needs, so neither is readable.
  it("hides roles and access from clients, and lets staff read them", async () => {
    await assertFails(getDoc(doc(anon(), "settings/roles")));
    await assertFails(getDoc(doc(authed(kOther), "settings/roles")));
    await assertFails(getDoc(doc(anon(), "settings/access")));
    await assertSucceeds(getDoc(doc(admin(), "settings/roles")));
    await assertSucceeds(getDoc(doc(admin(), "settings/access")));
  });

  it("refuses every client write to roles — that is the whole point", async () => {
    // A client that could write this document could grant itself every
    // permission on the site in one call.
    const roles = {
      roles: {
        user: { label: "مستعمل", permissions: ["roles.manage"], builtin: true },
      },
    };
    await assertFails(setDoc(doc(anon(), "settings/roles"), roles));
    await assertFails(setDoc(doc(authed(kOther), "settings/roles"), roles));
    await assertFails(setDoc(doc(admin(), "settings/roles"), roles));
    await assertFails(
      updateDoc(doc(admin(), "settings/access"), { requireApproval: false }),
    );
  });
});

describe("launch", () => {
  // The countdown page and the poll both need it, and it says nothing the
  // closed page does not already tell every visitor.
  it("lets anyone read the launch state", async () => {
    await assertSucceeds(getDoc(doc(anon(), "settings/launch")));
  });

  it("refuses every client write to the launch state", async () => {
    const open = {
      state: "active",
      launchAt: null,
      launchedAt: 2,
      updatedAt: 2,
      updatedBy: kOther,
    };
    await assertFails(setDoc(doc(anon(), "settings/launch"), open));
    await assertFails(setDoc(doc(authed(kOther), "settings/launch"), open));
    await assertFails(setDoc(doc(admin(), "settings/launch"), open));
    await assertFails(
      updateDoc(doc(admin(), "settings/launch"), { state: "active" }),
    );
  });

  // One row per person per channel, each holding an email address or a phone
  // number: a mailing list of every registered user, which is the thing most
  // worth stealing from a classifieds site.
  it("hides the launch outbox from everyone, staff included", async () => {
    await assertFails(getDoc(doc(anon(), "launchOutbox/out-1")));
    await assertFails(getDoc(doc(authed(kOwner), "launchOutbox/out-1")));
    await assertFails(getDoc(doc(admin(), "launchOutbox/out-1")));
    await assertFails(getDocs(collection(admin(), "launchOutbox")));
    await assertFails(
      setDoc(doc(admin(), "launchOutbox/x"), { uid: kOther, channel: "sms" }),
    );
    await assertFails(deleteDoc(doc(admin(), "launchOutbox/out-1")));
  });

  // Held content is unpublished, so the listing rule already hides it — no new
  // rule, which is the point of reusing `status`.
  it("keeps a held listing out of the public query", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "listings/held-1"), {
        ...publishedListing,
        status: "pendingLaunch",
        approvedForLaunch: true,
      });
    });
    const snap = await assertSucceeds(
      getDocs(
        query(
          collection(anon(), "listings"),
          where("status", "==", "published"),
        ),
      ),
    );
    expect(snap.size).toBe(1);
    await assertFails(getDoc(doc(anon(), "listings/held-1")));
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

  it("refuses a self-registration, however well-shaped", async () => {
    // The profile document is created by the server during the session
    // exchange. A client can sign in with the JS SDK before it posts its token,
    // and the old rule accepted any document that pinned role, isBanned and
    // activeListingCount — leaving the two fields that actually matter free.
    await assertFails(
      setDoc(doc(authed(kOther), "users/" + kOther), {
        role: "admin",
        isBanned: false,
        activeListingCount: 0,
      }),
    );
    await assertFails(
      setDoc(doc(authed(kOther), "users/" + kOther), {
        role: "user",
        isBanned: false,
        activeListingCount: 0,
      }),
    );
  });

  it("refuses the quota and approval self-grant the old create rule allowed", async () => {
    await assertFails(
      setDoc(doc(authed(kOther), "users/" + kOther), {
        role: "user",
        isBanned: false,
        activeListingCount: 0,
        // Both would have passed: neither field was constrained, and
        // ensureUserDoc leaves an existing document's fields alone.
        listingQuota: 10000,
        approved: true,
      }),
    );
  });
});

describe("abuse surfaces", () => {
  it("takes the unauthenticated write endpoint off reports", async () => {
    // It accepted any shape, from anyone, at any rate — into a billed
    // collection. Nothing in the app writes here; the flag flow will arrive as
    // a Server Action like every other write.
    await assertFails(
      setDoc(doc(anon(), "reports/r-1"), {
        status: "open",
        createdAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(doc(authed(kOther), "reports/r-2"), {
        status: "open",
        createdAt: serverTimestamp(),
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
