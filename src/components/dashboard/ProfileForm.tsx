"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { updateMyProfile } from "@/server/actions/profile";
import { kWilayas } from "@/lib/geo";
import type { AppUser } from "@/types/user";

export function ProfileForm({ profile }: { profile: AppUser }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [wilayaSlug, setWilayaSlug] = useState(
    kWilayas.find((w) => w.code === profile.wilayaCode)?.slug ?? "",
  );
  const [notifyOnMessage, setNotifyOnMessage] = useState(
    profile.notifyOnMessage ?? true,
  );
  const [notifyOnSavedSearch, setNotifyOnSavedSearch] = useState(
    profile.notifyOnSavedSearch ?? true,
  );

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const res = await updateMyProfile({
        displayName,
        phone,
        wilayaSlug,
        notifyOnMessage,
        notifyOnSavedSearch,
      });
      if (res.ok) {
        setSaved(true);
        // The dashboard header shows the name, so it has to re-render too.
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  const field =
    "rounded-input border-border focus:border-primary w-full border bg-white px-4 py-3 text-base outline-none";

  return (
    <form onSubmit={onSubmit} className="mt-6 max-w-lg space-y-4">
      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-bold">
          الاسم
        </label>
        <input
          id="name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={60}
          className={field}
          placeholder="اسمك ولا اسم الوكالة"
        />
        <p className="text-dim mt-1 text-xs">
          هذا الاسم اللي يبان على إعلاناتك وتعليقاتك.
        </p>
      </div>

      <div>
        <label htmlFor="phone" className="mb-1.5 block text-sm font-bold">
          رقم الهاتف
        </label>
        <input
          id="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          dir="ltr"
          inputMode="tel"
          className={`${field} text-start`}
          placeholder="0555 12 34 56"
        />
        <p className="text-dim mt-1 text-xs">
          ما يبانش تلقائياً — كل إعلان يقرّر واش يوري رقمه ولا لا.
        </p>
      </div>

      <div>
        <label htmlFor="wilaya" className="mb-1.5 block text-sm font-bold">
          الولاية
        </label>
        <select
          id="wilaya"
          value={wilayaSlug}
          onChange={(e) => setWilayaSlug(e.target.value)}
          className={`${field} appearance-none font-semibold`}
        >
          <option value="">ما حدّدتش</option>
          {kWilayas.map((w) => (
            <option key={w.slug} value={w.slug}>
              {String(w.code).padStart(2, "0")} — {w.nameAr}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="rounded-card border-border bg-surface border p-4">
        <legend className="px-1 text-sm font-extrabold">التنبيهات</legend>
        <label className="mt-2 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={notifyOnMessage}
            onChange={(e) => setNotifyOnMessage(e.target.checked)}
            className="accent-accent mt-0.5 size-4 shrink-0"
          />
          <span>
            <span className="font-bold">نبّهني كي يراسلني حد</span>
            <span className="text-dim block text-xs">
              على إعلاناتك المنشورة.
            </span>
          </span>
        </label>
        <label className="mt-3 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={notifyOnSavedSearch}
            onChange={(e) => setNotifyOnSavedSearch(e.target.checked)}
            className="accent-accent mt-0.5 size-4 shrink-0"
          />
          <span>
            <span className="font-bold">نبّهني بالإعلانات الجديدة</span>
            <span className="text-dim block text-xs">
              اللي تشبه بحثك المحفوظ.
            </span>
          </span>
        </label>
      </fieldset>

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
          تسجّلت معلوماتك.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-accent rounded-input px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {pending ? "…" : "سجّل"}
      </button>
    </form>
  );
}
