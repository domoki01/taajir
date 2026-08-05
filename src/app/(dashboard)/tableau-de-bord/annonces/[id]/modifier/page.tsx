import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser } from "@/server/auth";
import { EditForm } from "@/components/listing/EditForm";
import type { Listing } from "@/types/listing";

export const metadata: Metadata = {
  title: "تعديل الإعلان",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/tableau-de-bord/annonces/${id}/modifier`);

  const snap = await adminDb().collection("listings").doc(id).get();
  if (!snap.exists) notFound();
  const listing = { id: snap.id, ...snap.data() } as Listing;

  // 404 rather than 403 for someone else's ad: a "forbidden" reply confirms the
  // id exists, which is a free enumeration oracle over every listing.
  const isStaff = user.role === "admin" || user.role === "moderator";
  if (listing.ownerUid !== user.uid && !isStaff) notFound();

  return (
    <div className="rounded-card border-border bg-surface mx-auto max-w-3xl border p-4 sm:p-6">
      <h1 className="mb-6 text-2xl font-black">تعديل الإعلان</h1>
      <EditForm listing={listing} />
    </div>
  );
}
