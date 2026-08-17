"use client";

// ── THE ADMIN SIDE OF THE PROGRAMME ──────────────────────────────────────────
// Three things in one screen because they are one decision: what a referral is
// worth, what points buy, and which race is running. Splitting them across
// pages would hide the fact that raising `perReferral` while a campaign is live
// changes the campaign.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, Trophy, X } from "lucide-react";
import {
  disqualify,
  saveAffiliateSettings,
  saveCampaign,
  settlePayout,
} from "@/server/actions/affiliate";
import type {
  AffiliateSettings,
  Campaign,
  Entrant,
  Payout,
} from "@/types/affiliate";

const kField =
  "rounded-input border-border focus:border-primary ltr-nums mt-1 w-full border bg-white px-3 py-2.5 text-sm outline-none";

/**
 * Algeria is UTC+1 all year and has observed no daylight saving since 1981.
 *
 * The two conversions below are pinned to that rather than to the browser's
 * zone, for one reason: this component server-renders. `getTimezoneOffset()`
 * answers UTC on the server and +60 on an Algerian phone, so a field derived
 * from it would hydrate with a different string than it rendered with — and the
 * value it showed until the admin first touched it would be an hour out.
 */
const kAlgeriaOffsetMs = 60 * 60 * 1000;

/** A timestamp as the wall-clock string `<input type="datetime-local">` wants. */
function localDateTime(at: number): string {
  return new Date(at + kAlgeriaOffsetMs).toISOString().slice(0, 16);
}

/** And back. `Date.parse` on a bare datetime-local string reads it as local. */
function fromLocalDateTime(value: string): number {
  const at = Date.parse(`${value}:00+01:00`);
  return Number.isNaN(at) ? Date.now() : at;
}

export function AffiliatePanel({
  settings,
  payouts,
  campaigns,
  live,
  board,
  defaults,
}: {
  settings: AffiliateSettings;
  payouts: Payout[];
  campaigns: Campaign[];
  live: Campaign | null;
  board: Entrant[];
  /** Proposed dates for a campaign that does not exist yet, read on the server:
   *  a clock read is not a render-time value. */
  defaults: { startsAt: number; endsAt: number };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState(settings);

  const [campaign, setCampaign] = useState({
    id: live?.id ?? "",
    name: live?.name ?? "",
    prize: live?.prize ?? "",
    startsAt: live?.startsAt ?? defaults.startsAt,
    endsAt: live?.endsAt ?? defaults.endsAt,
    winners: live?.winners ?? 1,
    status: (live?.status ?? "draft") as Campaign["status"],
  });

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(res.error ?? "ما نجحش");
      }
    });
  }

  const num =
    (key: keyof AffiliateSettings) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [key]: Number(e.target.value) });

  const channel = (key: keyof AffiliateSettings["channels"]) => (on: boolean) =>
    setForm({ ...form, channels: { ...form.channels, [key]: on } });

  return (
    <div className="grid gap-5">
      {error && (
        <p className="rounded-input bg-danger/10 text-danger px-4 py-3 text-sm font-bold">
          {error}
        </p>
      )}
      {saved && (
        <p className="rounded-input bg-success/10 text-success px-4 py-3 text-sm font-bold">
          تسجّل ✅
        </p>
      )}

      {/* ── VALUES ───────────────────────────────────────────────────────── */}
      <section className="rounded-card border-border bg-surface border p-4">
        <p className="text-sm font-extrabold">قيمة الدعوة والأسعار</p>
        <p className="text-dim mt-1 text-xs leading-relaxed">
          الدعوة تتحسب كي ينشر المدعوّ إعلان ولا طلب ويتقبل — ماشي كي يسجّل. هذا
          هو اللي يمنع المزارع.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-bold">
            نقاط لكل دعوة
            <input
              type="number"
              min={0}
              value={form.perReferral}
              onChange={num("perReferral")}
              className={kField}
            />
          </label>
          <label className="text-xs font-bold">
            مكافأة كل كم دعوة
            <input
              type="number"
              min={0}
              value={form.bonusEvery}
              onChange={num("bonusEvery")}
              className={kField}
            />
          </label>
          <label className="text-xs font-bold">
            نقاط المكافأة
            <input
              type="number"
              min={0}
              value={form.bonusPoints}
              onChange={num("bonusPoints")}
              className={kField}
            />
          </label>
          <label className="text-xs font-bold">
            حد يومي للدعوات
            <input
              type="number"
              min={1}
              value={form.dailyQualifyCap}
              onChange={num("dailyQualifyCap")}
              className={kField}
            />
          </label>
          <label className="text-xs font-bold">
            سعر إعلان زيادة
            <input
              type="number"
              min={1}
              value={form.pointsPerListingSlot}
              onChange={num("pointsPerListingSlot")}
              className={kField}
            />
          </label>
          <label className="text-xs font-bold">
            سعر تمييز أسبوع
            <input
              type="number"
              min={1}
              value={form.pointsPerFeaturedWeek}
              onChange={num("pointsPerFeaturedWeek")}
              className={kField}
            />
          </label>
          <label className="text-xs font-bold">
            دينار لكل نقطة
            <input
              type="number"
              min={0}
              step="0.1"
              value={form.dinarsPerPoint}
              onChange={num("dinarsPerPoint")}
              className={kField}
            />
          </label>
          <label className="text-xs font-bold">
            أقل سحب (نقاط)
            <input
              type="number"
              min={1}
              value={form.minPayoutPoints}
              onChange={num("minPayoutPoints")}
              className={kField}
            />
          </label>
        </div>

        <p className="mt-5 text-sm font-extrabold">طرق الاستبدال</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(
            [
              ["listingSlot", "إعلان زيادة"],
              ["featured", "تمييز إعلان"],
              ["redotpay", "RedotPay (فلوس)"],
              ["ccp", "CCP / RIP (فلوس)"],
            ] as Array<[keyof AffiliateSettings["channels"], string]>
          ).map(([key, label]) => (
            <label
              key={key}
              className="rounded-input border-border flex items-center gap-2 border px-3 py-2.5 text-sm font-bold"
            >
              <input
                type="checkbox"
                checked={form.channels[key]}
                onChange={(e) => channel(key)(e.target.checked)}
                className="accent-primary size-4"
              />
              {label}
            </label>
          ))}
        </div>
        <p className="text-dim mt-2 text-xs leading-relaxed">
          الفلوس تبدا مسكّرة. حلّها كي تكون واثق من المراقبة — ترتيب عام وفلوس
          في آخرو هو أقوى مغناطيس للغش في هاد التصميم.
        </p>

        <label className="rounded-input border-border mt-4 flex items-center gap-2 border px-3 py-3 text-sm font-extrabold">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            className="accent-primary size-4"
          />
          فعّل برنامج الدعوة
        </label>

        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => saveAffiliateSettings(form))}
          className="bg-accent rounded-input mt-3 w-full py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "راه يسجّل…" : "سجّل"}
        </button>
      </section>

      {/* ── CAMPAIGN ─────────────────────────────────────────────────────── */}
      <section className="rounded-card border-border bg-surface border p-4">
        <p className="flex items-center gap-2 text-sm font-extrabold">
          <Trophy className="size-4" />
          المسابقة
        </p>
        <p className="text-dim mt-1 text-xs leading-relaxed">
          وحدة شغّالة في وقت واحد. زوج ترتيبات في نفس الوقت يفرّقو نفس الانتباه
          اللي المسابقة كاينة باش تجمعو.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold">
            اسم الحملة
            <input
              value={campaign.name}
              onChange={(e) =>
                setCampaign({ ...campaign, name: e.target.value })
              }
              maxLength={60}
              placeholder="سباق الصيف"
              className={kField}
            />
          </label>
          <label className="text-xs font-bold">
            الجائزة
            <input
              value={campaign.prize}
              onChange={(e) =>
                setCampaign({ ...campaign, prize: e.target.value })
              }
              maxLength={80}
              placeholder="هاتف ذكي"
              className={kField}
            />
          </label>
          <label className="text-xs font-bold">
            من
            <input
              type="datetime-local"
              value={localDateTime(campaign.startsAt)}
              onChange={(e) =>
                setCampaign({
                  ...campaign,
                  startsAt: fromLocalDateTime(e.target.value),
                })
              }
              className={kField}
            />
          </label>
          <label className="text-xs font-bold">
            حتى
            <input
              type="datetime-local"
              value={localDateTime(campaign.endsAt)}
              onChange={(e) =>
                setCampaign({
                  ...campaign,
                  endsAt: fromLocalDateTime(e.target.value),
                })
              }
              className={kField}
            />
          </label>
          <label className="text-xs font-bold">
            عدد الفائزين
            <input
              type="number"
              min={1}
              max={50}
              value={campaign.winners}
              onChange={(e) =>
                setCampaign({ ...campaign, winners: Number(e.target.value) })
              }
              className={kField}
            />
          </label>
          <label className="text-xs font-bold">
            الحالة
            <select
              value={campaign.status}
              onChange={(e) =>
                setCampaign({
                  ...campaign,
                  status: e.target.value as Campaign["status"],
                })
              }
              className={kField}
            >
              <option value="draft">مسوّدة</option>
              <option value="live">شغّالة</option>
              <option value="ended">سالات</option>
            </select>
          </label>
        </div>

        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => saveCampaign(campaign))}
          className="bg-accent rounded-input mt-3 w-full py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {campaign.id ? "عدّل الحملة" : "أنشئ الحملة"}
        </button>

        {campaigns.length > 0 && (
          <ul className="mt-4 divide-y divide-[var(--color-border)]">
            {campaigns.map((c) => (
              <li key={c.id} className="flex items-center gap-2 py-2 text-sm">
                <button
                  type="button"
                  onClick={() =>
                    setCampaign({
                      id: c.id,
                      name: c.name,
                      prize: c.prize,
                      startsAt: c.startsAt,
                      endsAt: c.endsAt,
                      winners: c.winners,
                      status: c.status,
                    })
                  }
                  className="hover:text-primary truncate font-bold transition-colors"
                >
                  {c.name}
                </button>
                <span className="text-dim ms-auto shrink-0 text-xs font-semibold">
                  {c.status === "live"
                    ? "شغّالة"
                    : c.status === "ended"
                      ? "سالات"
                      : "مسوّدة"}
                </span>
              </li>
            ))}
          </ul>
        )}

        {live && board.length > 0 && (
          <ol className="border-border mt-4 divide-y divide-[var(--color-border)] border-t pt-2">
            {board.map((e, i) => (
              <li key={e.uid} className="flex items-center gap-3 py-2 text-sm">
                <span className="ltr-nums text-dim w-5 shrink-0 font-black">
                  {i + 1}
                </span>
                <span className="truncate font-bold">{e.displayName}</span>
                <span className="text-primary ltr-nums ms-auto shrink-0 font-black">
                  {e.count}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => disqualify(live.id, e.uid))}
                  aria-label={`اشطب ${e.displayName}`}
                  className="text-dim hover:text-danger shrink-0 transition-colors disabled:opacity-40"
                >
                  <Ban className="size-4" />
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* ── PAYOUT REQUESTS ──────────────────────────────────────────────── */}
      <section className="rounded-card border-border bg-surface border p-4">
        <p className="text-sm font-extrabold">طلبات السحب</p>
        {payouts.length === 0 ? (
          <p className="text-dim mt-2 text-xs font-semibold">ما كاش طلبات.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--color-border)]">
            {payouts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">
                    {p.ownerName}
                  </span>
                  <span
                    dir="ltr"
                    className="text-dim ltr-nums block truncate text-xs font-semibold"
                  >
                    {p.channel} — {p.destination ?? "—"}
                  </span>
                </span>
                <span className="text-primary ltr-nums ms-auto shrink-0 text-sm font-black">
                  {p.amountDzd ?? 0} دج
                </span>
                <span className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => settlePayout(p.id, true))}
                    className="bg-accent rounded-input px-3 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    <Check className="size-4" />
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => settlePayout(p.id, false))}
                    className="rounded-input border-danger text-danger hover:bg-danger/10 border px-3 py-2 text-xs font-bold transition-colors disabled:opacity-40"
                  >
                    <X className="size-4" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
