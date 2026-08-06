import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ImageOff, MapPin, MessageCircle, Phone } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/layout/Container";
import { ListingGrid } from "@/components/listing/ListingGrid";
import { getListing, getSimilarListings } from "@/server/listings";
import { getComments } from "@/server/comments";
import { Comments } from "@/components/listing/Comments";
import { formatDateTime } from "@/lib/datetime";
import { getCommune, getWilaya, placeLabel } from "@/lib/geo";
import { formatPrice, formatPriceExact } from "@/lib/price";
import {
  kAmenities,
  kConditions,
  kPaperwork,
  kPropertyTypes,
  kTransactionTypes,
} from "@/lib/enums";
import { kSiteUrl } from "@/lib/constants";

export const revalidate = 300;

type Params = Promise<{ id: string; slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) return { title: "الإعلان غير موجود" };

  const wilaya = getWilaya(listing.wilayaSlug);
  const price = listing.priceOnRequest
    ? "السعر بالاتفاق"
    : formatPrice(listing.price);

  return {
    title: `${listing.title} — ${price}`,
    description: listing.description.slice(0, 155).replace(/\s+/g, " "),
    alternates: { canonical: `/annonce/${listing.id}/${listing.slug}` },
    openGraph: {
      type: "article",
      title: `${listing.title} — ${price}${wilaya ? ` | ${wilaya.nameAr}` : ""}`,
      description: listing.description.slice(0, 200).replace(/\s+/g, " "),
      // The first photo is what shows in a WhatsApp preview, which is the main
      // sharing channel here — worth more than a generated card.
      images: listing.coverUrl ? [listing.coverUrl] : undefined,
    },
  };
}

export default async function ListingPage({ params }: { params: Params }) {
  const { id, slug } = await params;
  const listing = await getListing(id);
  if (!listing) notFound();

  // The id is the identity; the slug is decoration. Editing a title changes the
  // slug, and every link already shared keeps working through this redirect.
  if (slug !== listing.slug) {
    permanentRedirect(`/annonce/${listing.id}/${listing.slug}`);
  }

  const wilaya = getWilaya(listing.wilayaSlug);
  // No getUser() here on purpose: reading cookies would opt this route out of
  // ISR, and this is the page search engines actually land on. Comments render
  // from the cache (good — they are indexable content); who is *viewing* is
  // resolved on the client instead.
  const [similar, comments] = await Promise.all([
    getSimilarListings(listing),
    getComments(listing.id),
  ]);
  const area = listing.areaBuilt ?? listing.areaLand;

  const specs = [
    listing.roomsCode && { label: "عدد الغرف", value: listing.roomsCode },
    area != null && { label: "المساحة", value: `${area} م²` },
    listing.floor != null && { label: "الطابق", value: String(listing.floor) },
    listing.bathrooms != null && {
      label: "الحمّامات",
      value: String(listing.bathrooms),
    },
    listing.condition && {
      label: "الحالة",
      value: kConditions[listing.condition],
    },
    listing.paperwork && {
      label: "الوثائق",
      value: kPaperwork[listing.paperwork],
    },
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: listing.title,
    description: listing.description,
    url: `${kSiteUrl}/annonce/${listing.id}/${listing.slug}`,
    datePosted: listing.publishedAt
      ? new Date(listing.publishedAt).toISOString()
      : undefined,
    image: listing.images.map((i) => i.url),
    address: {
      "@type": "PostalAddress",
      addressLocality:
        getCommune(wilaya?.code ?? 0, listing.communeSlug)?.nameAr ??
        listing.communeSlug.replace(/-/g, " "),
      addressRegion: wilaya?.nameAr,
      addressCountry: "DZ",
    },
    offers: listing.priceOnRequest
      ? undefined
      : {
          "@type": "Offer",
          price: listing.price,
          priceCurrency: "DZD",
          availability: "https://schema.org/InStock",
        },
  };

  return (
    <>
      <Header />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Extra bottom padding so the sticky contact bar never covers content. */}
      <main className="flex-1 py-6 pb-28 lg:pb-6">
        <Container>
          <nav
            aria-label="مسار التصفّح"
            className="text-dim mb-3 text-xs font-semibold"
          >
            <Link href="/" className="hover:text-primary">
              الرئيسية
            </Link>
            <span className="mx-1.5">/</span>
            <Link
              href={`/${listing.transactionType}/${listing.propertyType}/${listing.wilayaSlug}`}
              className="hover:text-primary"
            >
              {kPropertyTypes[listing.propertyType]}{" "}
              {wilaya ? `في ${wilaya.nameAr}` : ""}
            </Link>
          </nav>

          <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
            <div>
              <div className="rounded-card bg-surface-soft relative aspect-4/3 overflow-hidden">
                {listing.coverUrl ? (
                  <Image
                    src={listing.coverUrl}
                    alt={listing.title}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 640px"
                    className="object-cover"
                  />
                ) : (
                  <div className="text-dim grid h-full place-items-center">
                    <ImageOff className="size-10" />
                  </div>
                )}
              </div>

              {listing.images.length > 1 && (
                <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {listing.images.slice(1).map((img) => (
                    <li key={img.url} className="shrink-0">
                      <div className="rounded-input bg-surface-soft relative size-20 overflow-hidden">
                        <Image
                          src={img.url}
                          alt=""
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <h1 className="mt-6 text-2xl font-black md:text-3xl">
                {listing.title}
              </h1>

              <p className="text-muted mt-2 flex items-center gap-1.5 text-sm">
                <MapPin className="size-4 shrink-0" />
                {placeLabel(listing.wilayaSlug, listing.communeSlug)}
              </p>

              {specs.length > 0 && (
                <dl className="rounded-card border-border bg-surface mt-6 grid grid-cols-2 gap-4 border p-5 sm:grid-cols-3">
                  {specs.map((spec) => (
                    <div key={spec.label}>
                      <dt className="text-dim text-xs font-semibold">
                        {spec.label}
                      </dt>
                      <dd className="ltr-nums mt-0.5 text-sm font-bold">
                        {spec.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              <section className="mt-6">
                <h2 className="text-base font-extrabold">الوصف</h2>
                <p className="text-muted mt-2 leading-loose whitespace-pre-line">
                  {listing.description}
                </p>
              </section>

              {listing.amenities.length > 0 && (
                <section className="mt-6">
                  <h2 className="text-base font-extrabold">المرافق</h2>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {listing.amenities.map((a) => (
                      <li
                        key={a}
                        className="bg-primary-soft text-primary rounded-input px-3 py-1.5 text-xs font-bold"
                      >
                        {kAmenities[a]}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* Desktop: the contact card rides along the page. Mobile: it
                becomes the fixed bar below, which is the conversion surface. */}
            <aside className="hidden lg:block">
              <div className="rounded-card border-border bg-surface shadow-soft sticky top-24 border p-5">
                <p className="text-primary ltr-nums text-2xl font-black">
                  {listing.priceOnRequest
                    ? "السعر بالاتفاق"
                    : formatPriceExact(listing.price)}
                </p>
                <p className="text-dim mt-1 text-xs font-semibold">
                  {kTransactionTypes[listing.transactionType]} ·{" "}
                  {kPropertyTypes[listing.propertyType]}
                </p>
                <ContactButtons listing={listing} className="mt-4 flex-col" />
              </div>
            </aside>
          </div>

          <Comments
            listingId={listing.id}
            listingPath={`/annonce/${listing.id}/${listing.slug}`}
            comments={comments.map((c) => ({
              ...c,
              createdAtLabel: formatDateTime(c.createdAt),
            }))}
          />

          {similar.length > 0 && (
            <section className="mt-12">
              <h2 className="text-lg font-extrabold">إعلانات مشابهة</h2>
              <div className="mt-4">
                <ListingGrid listings={similar} />
              </div>
            </section>
          )}
        </Container>
      </main>

      <div className="bg-surface border-border fixed inset-x-0 bottom-0 z-30 border-t p-3 lg:hidden">
        <Container className="flex items-center gap-3 px-0">
          <p className="text-primary ltr-nums shrink-0 text-lg font-black">
            {listing.priceOnRequest ? "بالاتفاق" : formatPrice(listing.price)}
          </p>
          <ContactButtons listing={listing} className="ms-auto" />
        </Container>
      </div>

      <Footer />
    </>
  );
}

function ContactButtons({
  listing,
  className = "",
}: {
  listing: Awaited<ReturnType<typeof getListing>>;
  className?: string;
}) {
  if (!listing?.showPhone || !listing.contactPhone) return null;

  return (
    <div className={`flex gap-2 ${className}`}>
      <a
        href={`tel:${listing.contactPhone}`}
        className="bg-accent rounded-input inline-flex flex-1 items-center justify-center gap-1.5 px-4 py-3 text-sm font-bold text-white"
      >
        <Phone className="size-4" />
        اتصال
      </a>
      {listing.allowWhatsapp && (
        <a
          href={`https://wa.me/${listing.contactPhone.replace(/[^0-9]/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          // WhatsApp's own green, not the palette's. It sits directly beside
          // the emerald call button, and two greens a shade apart would read as
          // one control split in half — the WhatsApp button is only useful if
          // it is recognisable before it is read.
          className="bg-whatsapp rounded-input inline-flex flex-1 items-center justify-center gap-1.5 px-4 py-3 text-sm font-bold text-white"
        >
          <MessageCircle className="size-4" />
          واتساب
        </a>
      )}
    </div>
  );
}
