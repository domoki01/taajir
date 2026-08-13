import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { hasPermission, requireUser } from "@/server/auth";
import { getRoles } from "@/server/permissions";
import { getAccessSettings } from "@/server/access";
import { listPendingUsers, listUsers } from "@/server/users";
import { UserRow } from "@/components/admin/UserRow";
import { ApprovalSwitch } from "@/components/admin/ApprovalSwitch";
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
  // Two permissions reach this screen. `users.manage` edits roles, bans and
  // quotas; `users.approve` works the registration queue. A role holding only
  // the second one gets the queue and nothing else, which is exactly what a
  // "front desk" role should be able to do.
  const viewer = await requireUser("/admin/utilisateurs");
  const canManage = hasPermission(viewer, "users.manage");
  const canApprove = hasPermission(viewer, "users.approve");
  if (!canManage && !canApprove) redirect("/admin");

  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "";

  const [users, roles, access, pending] = await Promise.all([
    listUsers(q),
    getRoles(),
    getAccessSettings(),
    listPendingUsers(),
  ]);

  const roleLabels = Object.fromEntries(
    Object.entries(roles).map(([id, r]) => [id, r.label]),
  );

  const rowProps = {
    canManage,
    canApprove,
    requireApproval: access.requireApproval,
    roleLabels,
  };

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

      {canApprove && (
        <ApprovalSwitch
          on={access.requireApproval}
          pendingCount={pending === null ? null : pending.length}
        />
      )}

      {!canManage && (
        <p className="rounded-input bg-warning/10 text-warning mt-4 px-4 py-3 text-sm font-bold">
          الأدوار والتوقيف والحصص من صلاحية «إدارة الحسابات». عندك تأكيد
          التسجيلات برك.
        </p>
      )}

      {access.requireApproval && pending !== null && pending.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-extrabold">
            يستنّاو التأكيد
            <span className="text-dim ltr-nums ms-2 text-sm font-bold">
              {pending.length}
            </span>
          </h2>
          <p className="text-dim mt-1 text-xs">
            الأقدم الأوّل — اللي راه يستنّى من بكري هو اللي يقرب يقلع.
          </p>
          <ul className="mt-3 space-y-3">
            {pending.map((user) => (
              <UserRow
                key={user.uid}
                user={user}
                isSelf={user.uid === viewer.uid}
                {...rowProps}
              />
            ))}
          </ul>
        </section>
      )}

      <form
        action="/admin/utilisateurs"
        className="rounded-card shadow-soft border-border mt-6 flex items-center gap-2 border bg-white p-2"
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
                {...rowProps}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
