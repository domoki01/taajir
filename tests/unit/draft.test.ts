// ── THE DRAFT SURVIVES THE ROUND TRIP, OR IT IS NOT THERE ────────────────────
// The publish wizard is nine screens and asking for the account last means the
// answer to finishing it can be a navigation away. The draft is the half that
// makes that survivable, so what matters is not that it stores things — it is
// every case where it must decline to: a clock that moved, a week-old draft, a
// browser that refuses storage at all. Each of those has to read as "no draft"
// and never as a throw, because the thing throwing is the form somebody is
// typing into.

import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearDraft,
  kDraftMaxAgeMs,
  kListingDraftKey,
  readDraft,
  writeDraft,
} from "@/lib/draft";

type Store = Record<string, string>;

/** The smallest thing that behaves like localStorage. */
function install(initial: Store = {}) {
  const store: Store = { ...initial };
  const impl = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
    removeItem: (k: string) => void delete store[k],
  };
  vi.stubGlobal("localStorage", impl);
  return store;
}

/** One that refuses everything, the way private mode and some in-app browsers do. */
function installHostile() {
  vi.stubGlobal("localStorage", {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("quota");
    },
    removeItem() {
      throw new Error("denied");
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

const kValues = { title: "شقة f3 في وهران", priceAmount: "800" };

describe("keeping a draft", () => {
  it("reads back exactly what was written", () => {
    install();
    writeDraft(kListingDraftKey, kValues);
    expect(readDraft<typeof kValues>(kListingDraftKey)?.values).toEqual(
      kValues,
    );
  });

  it("is gone once cleared", () => {
    install();
    writeDraft(kListingDraftKey, kValues);
    clearDraft(kListingDraftKey);
    expect(readDraft(kListingDraftKey)).toBeNull();
  });

  it("has nothing to say on a device that never stored one", () => {
    install();
    expect(readDraft(kListingDraftKey)).toBeNull();
  });
});

describe("declining to restore", () => {
  it("lets go of one older than a week", () => {
    const savedAt = Date.now() - kDraftMaxAgeMs - 1;
    install({
      [kListingDraftKey]: JSON.stringify({ savedAt, values: kValues }),
    });
    expect(readDraft(kListingDraftKey)).toBeNull();
  });

  it("keeps one saved just inside the week", () => {
    const savedAt = Date.now() - kDraftMaxAgeMs + 60_000;
    install({
      [kListingDraftKey]: JSON.stringify({ savedAt, values: kValues }),
    });
    expect(readDraft(kListingDraftKey)).not.toBeNull();
  });

  it("treats a future timestamp as expired, not as fresh", () => {
    // A phone whose date is wrong would otherwise hold one draft forever.
    install({
      [kListingDraftKey]: JSON.stringify({
        savedAt: Date.now() + 60 * 60 * 1000,
        values: kValues,
      }),
    });
    expect(readDraft(kListingDraftKey)).toBeNull();
  });

  it("refuses anything that is not a draft", () => {
    for (const raw of [
      "not json",
      "null",
      '"a string"',
      "{}",
      JSON.stringify({ values: kValues }),
      JSON.stringify({ savedAt: Date.now() }),
      JSON.stringify({ savedAt: "yesterday", values: kValues }),
    ]) {
      install({ [kListingDraftKey]: raw });
      expect(readDraft(kListingDraftKey)).toBeNull();
    }
  });
});

describe("a browser that refuses storage", () => {
  it("never throws at the form", () => {
    installHostile();
    expect(() => writeDraft(kListingDraftKey, kValues)).not.toThrow();
    expect(() => clearDraft(kListingDraftKey)).not.toThrow();
    expect(readDraft(kListingDraftKey)).toBeNull();
  });

  it("says the same thing when there is no localStorage at all", () => {
    // The server render, and the reason the restore is an effect rather than a
    // useState initialiser.
    vi.stubGlobal("localStorage", undefined);
    expect(readDraft(kListingDraftKey)).toBeNull();
    expect(() => writeDraft(kListingDraftKey, kValues)).not.toThrow();
  });
});

describe("wired into the publish form", () => {
  const form = readFileSync("src/components/listing/PostForm.tsx", "utf8");

  it("clears the draft once the ad exists", () => {
    // Otherwise the next visit to /publier reopens on an ad already published,
    // and the draft becomes a way to post the same property twice.
    const ok = form.indexOf("if (result.ok) {");
    const push = form.indexOf("router.push(`/merci", ok);
    expect(ok).toBeGreaterThan(-1);
    expect(form.slice(ok, push)).toContain("clearDraft(kListingDraftKey)");
  });

  it("saves nothing until something has been said about a property", () => {
    // The first screens arrive pre-filled from the funnel and the profile, so
    // saving on any change would greet the next visitor with "we kept what you
    // wrote" over a form they never wrote in.
    expect(form).toContain("if (started) writeDraft(kListingDraftKey, values)");
  });

  it("tells the seller their form was refilled, and offers a way out", () => {
    expect(form).toContain("رجّعنالك الإعلان اللي كنت تكتب فيه");
    expect(form).toContain("startOver");
  });
});

describe("the price readout", () => {
  it("is on both forms that take a price", () => {
    // Same row, same 10 000x slip. A guard on one of them is a guard the other
    // silently does without.
    for (const file of [
      "src/components/listing/PostForm.tsx",
      "src/components/listing/EditForm.tsx",
    ]) {
      expect(readFileSync(file, "utf8")).toContain("<PriceReadout");
    }
  });
});
