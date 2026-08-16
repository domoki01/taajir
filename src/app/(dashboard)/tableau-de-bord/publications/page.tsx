import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Clock, Eye, MapPin, Pencil } from "lucide-react";
import { requireUser } from "@/server/auth";
import { listMyRequests } from "@/server/requests";
import { listMyListings } from "@/server/listings";
import { EmptyState } from "@/components/ui/EmptyState";
import { getTaxonomy, labelOf } from "@/server/filterSettings";
import { getWilaya, placeLabel } from "@/lib/geo";
import { kRequestIntents } from "@/lib/enums";
import { formatRelative } from "@/lib/datetime";

export const metadata: Metadata = {
  title: "منشوراتي",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** How each state reads to the person who wrote the post. */
const kStates = {
  live: { label: "منشور", className: "bg-success/15 text-success" },
  waiting: { label: "قيد المراجعة", className: "bg-warning/15 text-warning" },
  refused: { label: "مرفوض", className: "bg-danger/15 text-danger" },
  held: { label: "محجوز للإطلاق", className: "bg-primary-soft text-primary" },
  closed: { label: "مغلق", className: "bg-surface-soft text-dim" },
} as const;

type State = keyof typeof kStates;

function listingState(status: string): State {
  if (status === "published") return "live";
  if (status === "pending" || status === "draft") return "waiting";
  if (status === "rejected") return "refused";
  if (status === "pendingLaunch") return "held";
  return "closed";
}

function requestState(status: string): State {
  if (status === "visible") return "live";
  if (status === "pending") return "waiting";
  if (status === "rejected" || status === "hidden") return "refused";
  if (status === "pendingLaunch") return "held";
  return "closed";
}

/**
 * Everything one person has posted, and where each of it stands.
 *
 * This exists because the moderation decisions are otherwise invisible. An ad
 * that was refused simply never appeared, and a demand held for review looked
 * identical to one that was published and ignored. The reason lives here, next
 * to the post it is about, so a push notification has somewhere to point.
 */
export default async function MyPublicationsPage() {
  const user = await requireUser("/tableau-de-bord/publications");

  const [listings, requests, taxonomy] = await Promise.all([
    listMyListings(user.uid),
    listMyRequests(user.uid),
    getTaxonomy(),
  ]);

  const nothing =
    (listings?.length ?? 0) === 0 && (requests?.length ?? 0) === 0;

  return (
    <div>
      <h1 className="text-2xl font-black">منشوراتي</h1>
      <p className="text-muted mt-1 text-sm">
        إعلاناتك وطلباتك، وحالة كل واحد منهم.
      </p>

      {nothing ? (
        <div className="mt-5">
          <EmptyState
            title="ما نشرت والو للدرك"
            body="انشر إعلان ولا طلب، ويبان هنا مع حالتو."
          />
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {listings !== null && listings.length > 0 && (
            <section>
              <h2 className="font-extrabold">
                إعلاناتي{" "}
                <span className="text-dim ltr-nums text-sm">
                  {listings.length}
                </span>
              </h2>
              <ul className="mt-3 space-y-2.5">
                {listings.map((l) => {
                  const state = listingState(l.status);
                  return (
                    <li
                      key={l.id}
                      className="rounded-card border-border bg-surface border p-3.5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${kStates[state].className}`}
                        >
                          {kStates[state].label}
                        </span>
                        <span className="text-dim ltr-nums text-xs font-semibold">
                          {formatRelative(l.createdAt)}
                        </span>
                      </div>

                      <p className="mt-1.5 text-[15px] leading-snug font-extrabold">
                        {l.title}
                      </p>
                      <p className="text-dim mt-1 flex items-center gap-1 text-xs font-bold">
                        <MapPin className="size-3.5 shrink-0" />
                        {labelOf(taxonomy.propertyTypes, l.propertyType)} ·{" "}
                        {placeLabel(l.wilayaSlug, l.communeSlug)}
                      </p>

                      {state === "refused" && l.rejectionReason && (
                        <p className="rounded-input bg-danger/10 text-danger mt-2.5 flex items-start gap-1.5 px-3 py-2 text-xs leading-relaxed font-semibold">
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                          <span>
                            {l.rejectionReason}
                            <span className="mt-1 block font-normal">
                              صلّح وعاود انشر — التعديل يرجّعو للمراجعة.
                            </span>
                          </span>
                        </p>
                      )}

                      {state === "waiting" && (
                        <p className="text-muted mt-2.5 flex items-center gap-1.5 text-xs font-semibold">
                          <Clock className="size-3.5 shrink-0" />
                          راه عند المراجعة — يوصلك تنبيه كي يتقرّر.
                        </p>
                      )}

                      <div className="mt-2.5 flex flex-wrap items-center gap-3">
                        <Link
                          href={`/tableau-de-bord/annonces/${l.id}/modifier`}
                          className="text-primary inline-flex items-center gap-1 text-xs font-bold"
                        >
                          <Pencil className="size-3.5" />
                          تعديل
                        </Link>
                        {state === "live" && (
                          <Link
                            href={`/annonce/${l.id}/${l.slug}`}
                            className="text-dim hover:text-primary inline-flex items-center gap-1 text-xs font-bold"
                          >
                            <Eye className="size-3.5" />
                            شوفو
                          </Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {requests !== null && requests.length > 0 && (
            <section>
              <h2 className="font-extrabold">
                طلباتي{" "}
                <span className="text-dim ltr-nums text-sm">
                  {requests.length}
                </span>
              </h2>
              <ul className="mt-3 space-y-2.5">
                {requests.map((r) => {
                  const state = requestState(r.status);
                  const where = r.communeSlug
                    ? placeLabel(r.wilayaSlug, r.communeSlug)
                    : (getWilaya(r.wilayaSlug)?.nameAr ?? r.wilayaSlug);
                  return (
                    <li
                      key={r.id}
                      className="rounded-card border-border bg-surface border p-3.5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${kStates[state].className}`}
                        >
                          {kStates[state].label}
                        </span>
                        <span className="bg-primary-soft text-primary rounded-full px-2.5 py-0.5 text-[11px] font-extrabold">
                          {kRequestIntents[r.intent]}
                        </span>
                        <span className="text-dim ltr-nums text-xs font-semibold">
                          {formatRelative(r.createdAt)}
                        </span>
                      </div>

                      <p className="mt-1.5 text-[15px] leading-snug font-extrabold">
                        {r.title}
                      </p>
                      <p className="text-dim mt-1 flex items-center gap-1 text-xs font-bold">
                        <MapPin className="size-3.5 shrink-0" />
                        {where}
                      </p>

                      {state === "refused" &&
                        (r.rejectionReason || r.hiddenReason) && (
                          <p className="rounded-input bg-danger/10 text-danger mt-2.5 flex items-start gap-1.5 px-3 py-2 text-xs leading-relaxed font-semibold">
                            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                            <span>{r.rejectionReason ?? r.hiddenReason}</span>
                          </p>
                        )}

                      {state === "waiting" && (
                        <p className="text-muted mt-2.5 flex items-center gap-1.5 text-xs font-semibold">
                          <Clock className="size-3.5 shrink-0" />
                          راه عند المراجعة — يوصلك تنبيه كي يتقرّر.
                        </p>
                      )}

                      {state === "live" && (
                        <Link
                          href={`/demandes/${r.id}`}
                          className="text-dim hover:text-primary mt-2.5 inline-flex items-center gap-1 text-xs font-bold"
                        >
                          <Eye className="size-3.5" />
                          شوفو
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
