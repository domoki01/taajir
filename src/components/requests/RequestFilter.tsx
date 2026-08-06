"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { MapPin, X } from "lucide-react";
import { getCommunes, kWilayas } from "@/lib/geo";

/**
 * Narrow the feed to a wilaya, then to a commune inside it.
 *
 * A demand feed is only useful locally — someone in Oran has no use for forty
 * people looking for flats in Alger — so this is not a refinement on top of the
 * feed, it is how the feed becomes readable at all. The commune is the level
 * people actually think in: "شقة في باب الزوار", not "شقة في الجزائر".
 *
 * The selection lives in the URL rather than in state, so a filtered feed can
 * be shared on WhatsApp and the back button undoes a choice.
 */
export function RequestFilter({
  wilayaSlug,
  communeSlug,
}: {
  wilayaSlug: string;
  communeSlug: string;
}) {
  const router = useRouter();

  const communes = useMemo(() => {
    const wilaya = kWilayas.find((w) => w.slug === wilayaSlug);
    return wilaya ? getCommunes(wilaya.code) : [];
  }, [wilayaSlug]);

  function apply(next: { wilaya?: string; commune?: string }) {
    const wilaya = next.wilaya ?? wilayaSlug;
    // A commune from the previous wilaya would match nothing; changing the
    // wilaya clears it, which is the only sane reading of the change.
    const commune =
      next.wilaya !== undefined ? "" : (next.commune ?? communeSlug);

    const params = new URLSearchParams();
    if (wilaya) params.set("wilaya", wilaya);
    if (wilaya && commune) params.set("commune", commune);
    router.push(`/demandes${params.size ? `?${params}` : ""}`);
  }

  const field =
    "rounded-input border-border focus:border-primary w-full appearance-none border bg-white py-2.5 text-sm font-bold outline-none";

  return (
    <div className="rounded-card border-border bg-surface flex flex-wrap items-center gap-2 border p-3">
      <span className="text-dim inline-flex shrink-0 items-center gap-1.5 text-xs font-bold">
        <MapPin className="size-4" />
        وين؟
      </span>

      <div className="min-w-36 flex-1">
        <label htmlFor="feed-wilaya" className="sr-only">
          الولاية
        </label>
        <select
          id="feed-wilaya"
          value={wilayaSlug}
          onChange={(e) => apply({ wilaya: e.target.value })}
          className={`${field} px-3`}
        >
          <option value="">كل الولايات</option>
          {kWilayas.map((w) => (
            <option key={w.slug} value={w.slug}>
              {String(w.code).padStart(2, "0")} — {w.nameAr}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-36 flex-1">
        <label htmlFor="feed-commune" className="sr-only">
          البلدية
        </label>
        <select
          id="feed-commune"
          value={communeSlug}
          onChange={(e) => apply({ commune: e.target.value })}
          disabled={!wilayaSlug}
          className={`${field} px-3 disabled:opacity-50`}
        >
          <option value="">كل البلديات</option>
          {communes.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.nameAr}
            </option>
          ))}
        </select>
      </div>

      {wilayaSlug && (
        <button
          type="button"
          onClick={() => router.push("/demandes")}
          className="text-dim hover:text-danger inline-flex shrink-0 items-center gap-1 px-2 py-2 text-xs font-bold transition-colors"
        >
          <X className="size-4" />
          امسح
        </button>
      )}
    </div>
  );
}
