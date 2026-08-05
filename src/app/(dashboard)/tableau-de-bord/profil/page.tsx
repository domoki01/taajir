import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import { getUserDoc } from "@/server/users";
import { ProfileForm } from "@/components/dashboard/ProfileForm";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = {
  title: "معلوماتي",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser("/tableau-de-bord/profil");
  const profile = await getUserDoc(user.uid);

  return (
    <div>
      <h1 className="text-2xl font-black">معلوماتي</h1>
      <p className="text-muted mt-1 text-sm font-semibold">{user.email}</p>

      {profile ? (
        <ProfileForm profile={profile} />
      ) : (
        <div className="mt-6">
          <EmptyState
            title="ما قدرناش نجيبو معلوماتك"
            body="وقع مشكل مؤقت. عاود تحميل الصفحة بعد شوية — حسابك ما راهش متأثّر."
          />
        </div>
      )}
    </div>
  );
}
