"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, MapPin } from "lucide-react";
import { kWilayas } from "@/lib/geo";

/**
 * Narrow the feed to one wilaya.
 *
 * A demand feed is only useful locally — someone in Oran has no use for forty
 * people looking for flats in Alger — so this is not a refinement on top of the
 * feed, it is how the feed becomes readable at all. Kept in the URL rather than
 * in state so a filtered feed can be shared and the back button works.
 */
export function RequestFilter({ wilayaSlug }: { wilayaSlug: string }) {
  const router = useRouter();

  return (
    <div className="relative">
      <label htmlFor="feed-wilaya" className="sr-only">
        الولاية
      </label>
      <MapPin className="text-dim pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
      <select
        id="feed-wilaya"
        value={wilayaSlug}
        onChange={(e) =>
          router.push(
            e.target.value ? `/demandes?wilaya=${e.target.value}` : "/demandes",
          )
        }
        className="rounded-input border-border focus:border-primary w-full appearance-none border bg-white py-2.5 ps-9 pe-9 text-sm font-bold outline-none sm:w-64"
      >
        <option value="">كل الولايات</option>
        {kWilayas.map((w) => (
          <option key={w.slug} value={w.slug}>
            {String(w.code).padStart(2, "0")} — {w.nameAr}
          </option>
        ))}
      </select>
      <ChevronDown className="text-dim pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2" />
    </div>
  );
}
