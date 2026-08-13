import type { Metadata } from "next";
import { PostForm } from "@/components/listing/PostForm";
import { getTaxonomy, getVisibleFilterOptions } from "@/server/filterSettings";

export const metadata: Metadata = {
  title: "نشر إعلان",
  robots: { index: false, follow: false },
};

// Reads the site's categories on every visit: an admin can add or rename one,
// and a cached form would keep offering yesterday's list.
export const dynamic = "force-dynamic";

export default async function PostPage() {
  // The visible set, not every set. A category the admin switched off should
  // not be something new ads can still be filed under — hiding it in the filter
  // while the publish form keeps offering it is how a dropdown quietly fills
  // with listings nobody can browse to.
  const [options, taxonomy] = await Promise.all([
    getVisibleFilterOptions(),
    getTaxonomy(),
  ]);

  return (
    <div className="rounded-card border-border bg-surface mx-auto max-w-3xl border p-4 sm:p-6">
      <h1 className="mb-6 text-2xl font-black">نشر إعلان جديد</h1>
      <PostForm
        // Deal labels come from the posting vocabulary, not the filter's: the
        // filter says «للبيع / شراء» because a buyer searches for both words,
        // and a seller choosing what to post is only ever doing one of them.
        transactionOptions={options.transactionTypes.map((o) => ({
          value: o.slug,
          label: taxonomy.transactionTypes[o.slug] ?? o.label,
        }))}
        propertyOptions={options.propertyTypes.map((o) => ({
          value: o.slug,
          label: o.label,
        }))}
      />
    </div>
  );
}
