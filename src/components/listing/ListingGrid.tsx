import { ListingCard } from "./ListingCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ListingSummary } from "@/types/listing";

export function ListingGrid({
  listings,
  emptyTitle = "ما كاش إعلانات هنا حالياً",
  emptyBody = "جرّب توسّع البحث لولاية قريبة، ولا رجع بعد شوية — الإعلانات تتزاد كل يوم.",
}: {
  listings: ListingSummary[];
  emptyTitle?: string;
  emptyBody?: string;
}) {
  if (listings.length === 0) {
    return <EmptyState title={emptyTitle} body={emptyBody} />;
  }

  return (
    // auto-fill rather than a fixed column count: the sibling catalogev app
    // hard-coded two columns at every width, which is unreadable on a phone and
    // absurd on a desktop.
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </ul>
  );
}
