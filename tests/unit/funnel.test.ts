import { describe, expect, it } from "vitest";
import {
  funnelHref,
  funnelSignupHref,
  kFunnelIntents,
  readDeal,
} from "@/lib/funnel";
import { kRequestIntents, kTransactionTypes } from "@/lib/enums";

describe("the four buttons", () => {
  it("offers exactly the four answers the funnel asks for", () => {
    expect(kFunnelIntents.map((i) => i.label)).toEqual([
      "حاب نكري",
      "حاب نشري دار",
      "حاب نكري عقاري",
      "حاب نبيع",
    ]);
  });

  it("routes wanting to a demand and having to an ad", () => {
    // This is the mapping the whole funnel turns on: someone looking posts a
    // demand, someone holding a property posts a listing.
    const byLabel = Object.fromEntries(kFunnelIntents.map((i) => [i.label, i]));
    expect(byLabel["حاب نكري"].target).toBe("request");
    expect(byLabel["حاب نشري دار"].target).toBe("request");
    expect(byLabel["حاب نكري عقاري"].target).toBe("listing");
    expect(byLabel["حاب نبيع"].target).toBe("listing");
  });

  it("carries the choice in the URL, and to a route that reads it", () => {
    const hrefs = kFunnelIntents.map(funnelHref);
    expect(hrefs).toEqual([
      "/demandes/nouvelle?intent=location",
      "/demandes/nouvelle?intent=vente",
      "/publier?deal=location",
      "/publier?deal=vente",
    ]);
  });

  it("uses slugs the rest of the app already knows", () => {
    // A label typo here would silently file everything under one deal.
    for (const intent of kFunnelIntents) {
      expect(intent.deal in kTransactionTypes).toBe(true);
      if (intent.target === "request") {
        expect(intent.deal in kRequestIntents).toBe(true);
      }
    }
  });

  it("gives every button a distinct id and note", () => {
    expect(new Set(kFunnelIntents.map((i) => i.id)).size).toBe(4);
    // "نكري" and "نكري عقاري" are one word apart; the notes are what tell them
    // apart on a page with nothing else on it.
    expect(new Set(kFunnelIntents.map((i) => i.note)).size).toBe(4);
  });

  it("keeps the destination whole through sign-up", () => {
    const signup = funnelSignupHref(kFunnelIntents[0]);
    const next = new URL(signup, "https://x.dz").searchParams.get("next");
    expect(next).toBe("/demandes/nouvelle?intent=location");
  });
});

describe("readDeal", () => {
  it("passes the two real deals through", () => {
    expect(readDeal("vente")).toBe("vente");
    expect(readDeal("location")).toBe("location");
  });

  it("rejects anything else rather than trusting the query string", () => {
    for (const bad of [undefined, "", "vacances", "VENTE", "../admin"]) {
      expect(readDeal(bad)).toBeNull();
    }
  });
});
