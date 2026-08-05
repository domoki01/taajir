import { describe, expect, it } from "vitest";
import { buildListingSlug } from "@/lib/slug";

describe("listing slugs", () => {
  it("reads like the search that should find it", () => {
    expect(
      buildListingSlug({
        transactionType: "vente",
        propertyType: "appartement",
        roomsCode: "F3",
        communeSlug: "akbou",
        wilayaSlug: "bejaia",
      }),
    ).toBe("vente-appartement-f3-akbou");
  });

  it("omits rooms when they do not apply", () => {
    expect(
      buildListingSlug({
        transactionType: "vente",
        propertyType: "terrain",
        roomsCode: null,
        communeSlug: "el-eulma",
        wilayaSlug: "setif",
      }),
    ).toBe("vente-terrain-el-eulma");
  });

  it("falls back to the wilaya when no commune is given", () => {
    expect(
      buildListingSlug({
        transactionType: "location",
        propertyType: "villa",
        communeSlug: null,
        wilayaSlug: "oran",
      }),
    ).toBe("location-villa-oran");
  });

  it("keeps the F7+ code URL-safe", () => {
    expect(
      buildListingSlug({
        transactionType: "vente",
        propertyType: "maison",
        roomsCode: "F7+",
        communeSlug: "annaba",
        wilayaSlug: "annaba",
      }),
    ).toBe("vente-maison-f7-plus-annaba");
  });

  it("never emits a character that would be percent-encoded", () => {
    const slug = buildListingSlug({
      transactionType: "location-vacances" as never,
      propertyType: "niveau-villa",
      roomsCode: "F4",
      communeSlug: "sidi-bel-abbes",
      wilayaSlug: "sidi-bel-abbes",
    });
    expect(slug).toBe(encodeURIComponent(slug));
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  // Two ads of the same shape in the same commune collide on the slug. That is
  // fine and intended: the id in front of it is what resolves the page.
  it("is stable for identical listings", () => {
    const parts = {
      transactionType: "vente" as const,
      propertyType: "appartement" as const,
      roomsCode: "F3" as const,
      communeSlug: "bab-ezzouar",
      wilayaSlug: "alger",
    };
    expect(buildListingSlug(parts)).toBe(buildListingSlug(parts));
  });
});
