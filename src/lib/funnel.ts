// ── THE FUNNEL ───────────────────────────────────────────────────────────────
// Four buttons, four destinations. This file is the only place that knows which
// is which.
//
// It exists because the previous version encoded the answer in the href alone
// (`/publier?deal=vente`) and nothing on the other end read it back — the
// visitor's choice was thrown away between the click and the form. Naming the
// parameters here, next to the buttons that set them and exported to the pages
// that read them, is what stops that drifting apart again.

import { Home, KeyRound, Search, Tag, type LucideIcon } from "lucide-react";

/** Where an answer is filed: an ad on the board, or a demand in the feed. */
export type FunnelTarget = "listing" | "request";

export type FunnelIntent = {
  id: string;
  label: string;
  /**
   * One line inside the button.
   *
   * "نكري" and "نكري عقاري" are one word apart in Algerian derja and mean
   * opposite sides of the same deal. Someone who picks the wrong one lands in
   * the wrong queue and finds out days later. This line is not decoration on an
   * otherwise bare page — it is the difference between the two buttons.
   */
  note: string;
  Icon: LucideIcon;
  target: FunnelTarget;
  /** The deal slug, from `kTransactionTypes` / `kRequestIntents`. */
  deal: "vente" | "location";
};

/** The funnel's own address. `/` redirects here while the site is held. */
export const kFunnelHome = "/bienvenue";

/** Query parameter names, exported so the readers cannot misspell them. */
export const kDealParam = "deal";
export const kIntentParam = "intent";

export const kFunnelIntents: FunnelIntent[] = [
  {
    id: "louer",
    label: "حاب نكري",
    note: "نحوّس على دار ولا شقة نكريها",
    Icon: KeyRound,
    target: "request",
    deal: "location",
  },
  {
    id: "acheter",
    label: "حاب نشري دار",
    note: "نحوّس على عقار نشريه",
    Icon: Search,
    target: "request",
    deal: "vente",
  },
  {
    id: "mettre-en-location",
    label: "حاب نكري عقاري",
    note: "عندي عقار نحبّ نكريه",
    Icon: Home,
    target: "listing",
    deal: "location",
  },
  {
    id: "vendre",
    label: "حاب نبيع",
    note: "عندي عقار نحبّ نبيعو",
    Icon: Tag,
    target: "listing",
    deal: "vente",
  },
];

/** Where this answer goes, with its choice carried in the query string. */
export function funnelHref(intent: FunnelIntent): string {
  return intent.target === "listing"
    ? `/publier?${kDealParam}=${intent.deal}`
    : `/demandes/nouvelle?${kIntentParam}=${intent.deal}`;
}

/**
 * The sign-up hand-off.
 *
 * `/inscription` rather than `/connexion`: everyone arriving through the funnel
 * is new by definition, and the sign-in page's own "ما عندكش حساب؟" link keeps
 * the other direction open. `next` is encoded whole, query string included, so
 * the choice survives the round trip through Firebase.
 */
export function funnelSignupHref(intent: FunnelIntent): string {
  return `/inscription?next=${encodeURIComponent(funnelHref(intent))}`;
}

/** A `?deal=` value from the URL, or null when it is missing or unknown. */
export function readDeal(
  value: string | undefined,
): "vente" | "location" | null {
  return value === "vente" || value === "location" ? value : null;
}
