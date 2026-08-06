"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, RotateCcw, ShieldCheck } from "lucide-react";
import {
  setUserBanned,
  setUserQuota,
  setUserRole,
  type Role,
} from "@/server/actions/users";
import { getWilaya } from "@/lib/geo";
import type { AppUser } from "@/types/user";

const roleLabels: Record<Role, string> = {
  user: "مستخدم",
  agency: "وكالة",
  moderator: "مشرف مساعد",
  admin: "مدير",
};

export function UserRow({
  user,
  isSelf,
  canManage,
}: {
  user: AppUser;
  /** You cannot change your own role or ban yourself; the server refuses too. */
  isSelf: boolean;
  /** False for moderators — only a full admin may hand out access. */
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [banReason, setBanReason] = useState("");
  const [asking, setAsking] = useState(false);
  const [quotaOpen, setQuotaOpen] = useState(false);
  const [listingQuota, setListingQuota] = useState(
    String(user.listingQuota ?? 3),
  );
  const [featuredQuota, setFeaturedQuota] = useState(
    String(user.featuredQuota ?? 0),
  );

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      setError(null);
      const res = await work();
      if (res.ok) {
        setAsking(false);
        setQuotaOpen(false);
        router.refresh();
      } else {
        setError(res.error ?? "وقع مشكل");
      }
    });
  }

  const wilaya = user.wilayaCode ? getWilaya(user.wilayaCode) : null;
  const control =
    "rounded-input border-border focus:border-primary border bg-white px-3 py-2 text-sm outline-none disabled:opacity-40";

  return (
    <li
      className={`rounded-card border-border bg-surface border p-4 ${
        user.isBanned ? "opacity-70" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-bold">
            {user.displayName || "بلا اسم"}
            {user.role !== "user" && (
              <span className="bg-primary-soft text-primary rounded-full px-2 py-0.5 text-[11px] font-bold">
                {roleLabels[user.role] ?? user.role}
              </span>
            )}
            {user.isBanned && (
              <span className="bg-danger/15 text-danger rounded-full px-2 py-0.5 text-[11px] font-bold">
                موقّف
              </span>
            )}
            {isSelf && (
              <span className="text-dim text-[11px] font-bold">(أنت)</span>
            )}
          </p>
          <p dir="ltr" className="text-dim truncate text-start text-xs">
            {user.email ?? user.uid}
          </p>
          <p className="text-muted ltr-nums mt-1 text-xs">
            {user.activeListingCount ?? 0}/{user.listingQuota ?? 0} إعلان
            {wilaya ? ` · ${wilaya.nameAr}` : ""}
          </p>
          {user.isBanned && user.banReason && (
            <p className="text-danger mt-1 text-xs font-semibold">
              سبب التوقيف: {user.banReason}
            </p>
          )}
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`role-${user.uid}`}>
              دور {user.displayName}
            </label>
            <select
              id={`role-${user.uid}`}
              value={user.role}
              disabled={pending || isSelf}
              onChange={(e) =>
                run(() => setUserRole(user.uid, e.target.value as Role))
              }
              className={`${control} font-semibold`}
            >
              {(Object.keys(roleLabels) as Role[]).map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={pending}
              onClick={() => setQuotaOpen((v) => !v)}
              className={`${control} font-bold`}
            >
              الحصّة
            </button>

            {user.isBanned ? (
              <button
                type="button"
                disabled={pending || isSelf}
                onClick={() => run(() => setUserBanned(user.uid, false))}
                className={`${control} text-success inline-flex items-center gap-1.5 font-bold`}
              >
                <RotateCcw className="size-4" />
                رجّعه
              </button>
            ) : (
              <button
                type="button"
                disabled={pending || isSelf}
                onClick={() => setAsking((v) => !v)}
                className={`${control} text-danger inline-flex items-center gap-1.5 font-bold`}
              >
                <Ban className="size-4" />
                وقّفه
              </button>
            )}
          </div>
        )}
      </div>

      {quotaOpen && canManage && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label
              htmlFor={`lq-${user.uid}`}
              className="text-dim mb-1 block text-xs font-bold"
            >
              إعلانات مسموحة
            </label>
            <input
              id={`lq-${user.uid}`}
              value={listingQuota}
              onChange={(e) => setListingQuota(e.target.value)}
              inputMode="numeric"
              dir="ltr"
              className={`${control} w-24 text-start`}
            />
          </div>
          <div>
            <label
              htmlFor={`fq-${user.uid}`}
              className="text-dim mb-1 block text-xs font-bold"
            >
              إعلانات مميّزة
            </label>
            <input
              id={`fq-${user.uid}`}
              value={featuredQuota}
              onChange={(e) => setFeaturedQuota(e.target.value)}
              inputMode="numeric"
              dir="ltr"
              className={`${control} w-24 text-start`}
            />
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(() =>
                setUserQuota(
                  user.uid,
                  Number(listingQuota),
                  Number(featuredQuota),
                ),
              )
            }
            className="bg-accent rounded-input inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            <ShieldCheck className="size-4" />
            سجّل
          </button>
        </div>
      )}

      {asking && canManage && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-52 flex-1">
            <label
              htmlFor={`ban-${user.uid}`}
              className="text-dim mb-1 block text-xs font-bold"
            >
              سبب التوقيف
            </label>
            <input
              id={`ban-${user.uid}`}
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="إعلانات كاذبة، احتيال…"
              className={`${control} w-full`}
            />
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setUserBanned(user.uid, true, banReason))}
            className="bg-danger rounded-input px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            أكّد التوقيف
          </button>
          <button
            type="button"
            onClick={() => setAsking(false)}
            className={`${control} font-bold`}
          >
            إلغاء
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-danger mt-2 text-sm font-bold">
          {error}
        </p>
      )}
    </li>
  );
}
