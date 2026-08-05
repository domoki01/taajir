import type { Metadata } from "next";
import { Search } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { listUsers } from "@/server/users";
import { UserRow } from "@/components/admin/UserRow";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = {
  title: "الحسابات",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The layout already ran requireAdmin; this re-reads the session to find out
  // *which* admin, because a moderator sees the list read-only.
  const viewer = await requireAdmin();
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "";

  const users = await listUsers(q);
  const canManage = viewer.role === "admin";

  return (
    <div>
      <h1 className="text-2xl font-black">الحسابات</h1>
      <p className="text-muted mt-1 text-sm font-semibold">
        {users === null
          ? "—"
          : q
            ? `${users.length} نتيجة`
            : `${users.length} حساب`}
      </p>

      {!canManage && (
        <p className="rounded-input bg-warning/10 text-warning mt-4 px-4 py-3 text-sm font-bold">
          الأدوار والتوقيف والحصص من صلاحيات المدير وحده. تقدر تشوف القائمة فقط.
        </p>
      )}

      <form
        action="/admin/utilisateurs"
        className="rounded-card shadow-soft border-border mt-5 flex items-center gap-2 border bg-white p-2"
      >
        <Search className="text-dim ms-2 size-5 shrink-0" />
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="ابحث بالاسم، الإيميل ولا المعرّف"
          aria-label="البحث عن حساب"
          className="placeholder:text-dim min-w-0 flex-1 bg-transparent py-2 text-base outline-none"
        />
        <button
          type="submit"
          className="bg-accent rounded-input shrink-0 px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          بحث
        </button>
      </form>

      <div className="mt-5">
        {users === null ? (
          <EmptyState
            title="ما قدرناش نجيبو الحسابات"
            body="وقع مشكل مؤقت. عاود تحميل الصفحة."
          />
        ) : users.length === 0 ? (
          <EmptyState
            title={q ? "ما لقينا حتى حساب" : "ما كاش حسابات"}
            body={
              q
                ? "جرّب الإيميل كامل، ولا امسح البحث باش تشوف الكل."
                : "الحسابات تبان هنا كي يسجّل المستخدمون."
            }
          />
        ) : (
          <ul className="space-y-3">
            {users.map((user) => (
              <UserRow
                key={user.uid}
                user={user}
                isSelf={user.uid === viewer.uid}
                canManage={canManage}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
