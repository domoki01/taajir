"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Lock, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { createRole, deleteRole, saveRoles } from "@/server/actions/roles";
import {
  kAllPermissions,
  kPermissions,
  kSuperAdminRole,
  type Permission,
  type RoleDefinition,
} from "@/lib/permissions";

type Row = {
  id: string;
  label: string;
  permissions: string[];
  builtin: boolean;
};

/**
 * Roles × permissions, as a grid of checkboxes.
 *
 * The super-admin row is rendered locked rather than hidden: someone reading
 * this screen needs to see that a role holding everything exists — that is the
 * answer to "what happens if I switch my own permission off" — and a row they
 * cannot reach says it more plainly than its absence would.
 */
export function RolesEditor({
  roles,
  viewerRole,
  usage,
}: {
  roles: Record<string, RoleDefinition>;
  viewerRole: string;
  usage: Record<string, number>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [rows, setRows] = useState<Row[]>(() =>
    Object.entries(roles)
      .filter(([id]) => id !== kSuperAdminRole)
      .map(([id, r]) => ({
        id,
        label: r.label,
        permissions: [...r.permissions],
        builtin: r.builtin,
      })),
  );

  const [newId, setNewId] = useState("");
  const [newLabel, setNewLabel] = useState("");

  function toggle(id: string, permission: Permission) {
    setSaved(false);
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              permissions: r.permissions.includes(permission)
                ? r.permissions.filter((p) => p !== permission)
                : [...r.permissions, permission],
            }
          : r,
      ),
    );
  }

  function rename(id: string, label: string) {
    setSaved(false);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, label } : r)));
  }

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await work();
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(res.error ?? "وقع مشكل");
      }
    });
  }

  return (
    <div className="mt-6 space-y-8">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="border-border bg-surface sticky start-0 z-10 border-b p-3 text-start font-extrabold">
                الدور
              </th>
              {kAllPermissions.map((p) => (
                <th
                  key={p}
                  scope="col"
                  className="border-border border-b p-3 text-center text-xs font-bold whitespace-nowrap"
                >
                  {kPermissions[p]}
                </th>
              ))}
              <th className="border-border border-b p-3" />
            </tr>
          </thead>
          <tbody>
            <tr className="bg-primary-soft/40">
              <th
                scope="row"
                className="border-border bg-primary-soft/40 sticky start-0 z-10 border-b p-3 text-start"
              >
                <span className="flex items-center gap-1.5 font-extrabold">
                  <ShieldCheck className="text-primary size-4 shrink-0" />
                  {roles[kSuperAdminRole]?.label ?? "مشرف عام"}
                </span>
                <span className="text-dim ltr-nums block text-[11px] font-bold">
                  {kSuperAdminRole}
                </span>
              </th>
              {kAllPermissions.map((p) => (
                <td key={p} className="border-border border-b p-3 text-center">
                  <Lock className="text-primary mx-auto size-4" />
                </td>
              ))}
              <td className="border-border border-b p-3" />
            </tr>

            {rows.map((row) => (
              <tr key={row.id}>
                <th
                  scope="row"
                  className="border-border bg-surface sticky start-0 z-10 border-b p-3 text-start"
                >
                  <input
                    value={row.label}
                    onChange={(e) => rename(row.id, e.target.value)}
                    disabled={pending}
                    aria-label={`اسم الدور ${row.id}`}
                    className="rounded-input border-border focus:border-primary w-32 border bg-white px-2 py-1 text-sm font-bold outline-none"
                  />
                  <span className="text-dim ltr-nums mt-1 block text-[11px] font-bold">
                    {row.id}
                    {usage[row.id] ? ` · ${usage[row.id]} حساب` : ""}
                  </span>
                </th>

                {kAllPermissions.map((p) => {
                  // The server refuses this edit too. Locking the box as well
                  // means the answer arrives before the save rather than after,
                  // which is the difference between a rule and a trap.
                  const locked = p === "roles.manage" && row.id === viewerRole;
                  return (
                    <td
                      key={p}
                      className="border-border border-b p-3 text-center"
                    >
                      <input
                        type="checkbox"
                        checked={row.permissions.includes(p)}
                        onChange={() => toggle(row.id, p)}
                        disabled={pending || locked}
                        title={locked ? "دورك أنت — ما كاش رجوع" : undefined}
                        aria-label={`${kPermissions[p]} — ${row.label}`}
                        className="accent-primary size-4"
                      />
                    </td>
                  );
                })}

                <td className="border-border border-b p-3 text-center">
                  {row.builtin ? (
                    <span className="text-dim text-[11px] font-bold">
                      أساسي
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => deleteRole(row.id))}
                      aria-label={`امسح دور ${row.label}`}
                      className="text-danger hover:bg-danger/10 grid size-8 place-items-center rounded-full transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && (
        <p role="alert" className="text-danger text-sm font-bold">
          {error}
        </p>
      )}

      {saved && (
        <p
          role="status"
          className="rounded-input bg-success/10 text-success flex items-center gap-2 px-4 py-3 text-sm font-bold"
        >
          <CheckCircle2 className="size-5 shrink-0" />
          تسجّل. الصلاحيات تبدّلت.
        </p>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(() =>
            saveRoles(
              rows.map((r) => ({
                id: r.id,
                label: r.label,
                permissions: r.permissions,
              })),
            ),
          )
        }
        className="bg-accent rounded-input px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {pending ? "…" : "سجّل الصلاحيات"}
      </button>

      <section className="rounded-card border-border bg-surface border p-4">
        <h2 className="font-extrabold">دور جديد</h2>
        <p className="text-dim mt-1 text-xs leading-relaxed">
          المعرّف يدخل في التوكن وما يتبدّلش من بعد — حروف لاتينية صغيرة وشرطات.
          الدور الجديد يبدا بلا حتى صلاحية؛ عيّنها من الجدول فوق وسجّل.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs font-bold">
            المعرّف
            <input
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              placeholder="reviseur"
              dir="ltr"
              className="rounded-input border-border focus:border-primary mt-1 block w-40 border bg-white px-3 py-2 text-sm outline-none"
            />
          </label>
          <label className="text-xs font-bold">
            الاسم
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="مراجِع"
              className="rounded-input border-border focus:border-primary mt-1 block w-40 border bg-white px-3 py-2 text-sm outline-none"
            />
          </label>
          <button
            type="button"
            disabled={pending || !newId.trim() || !newLabel.trim()}
            onClick={() =>
              run(async () => {
                const res = await createRole(newId, newLabel);
                if (res.ok) {
                  setNewId("");
                  setNewLabel("");
                }
                return res;
              })
            }
            className="rounded-input border-primary text-primary hover:bg-primary-soft inline-flex items-center gap-1.5 border px-4 py-2 text-sm font-bold transition-colors disabled:opacity-40"
          >
            <Plus className="size-4" strokeWidth={3} />
            زيد الدور
          </button>
        </div>
      </section>

      <p className="text-dim rounded-card border-border border border-dashed p-4 text-xs leading-relaxed">
        دور «مشرف عام» عندو كل الصلاحيات دائماً وما يتعدّلش — هو باب الطوارئ إذا
        غلطت في التعيين. وما تقدرش تشيل صلاحية «الأدوار والصلاحيات» من دورك أنت،
        خاطر الشاشة اللي تصلّح الغلطة هي نفسها اللي راك تسكّرها. الأدوار
        المخصّصة تخدم على مستوى التطبيق: قواعد Firestore تقرا الدور من التوكن
        وما تقراش هذي الوثيقة، والإشراف كامل يمرّ من Server Actions.
      </p>
    </div>
  );
}
