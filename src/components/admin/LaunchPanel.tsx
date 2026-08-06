"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Lock,
  Rocket,
  Unlock,
} from "lucide-react";
import {
  executeLaunch,
  setLaunchAt,
  setLaunchState,
} from "@/server/actions/launch";
import type { LaunchStatus, OutboxChannel } from "@/types/launch";

export type LaunchCounts = {
  heldListings: number;
  approvedListings: number;
  heldRequests: number;
  users: number;
};

export function LaunchPanel({
  status,
  counts,
  outbox,
  channelsReady,
  launchAtLabel,
}: {
  status: LaunchStatus;
  counts: LaunchCounts;
  outbox: Record<OutboxChannel, number> & { total: number };
  channelsReady: Record<OutboxChannel, boolean>;
  /** Formatted server-side, in Africa/Algiers. */
  launchAtLabel: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // datetime-local wants "YYYY-MM-DDTHH:mm" in the *browser's* zone, which is
  // what the admin is reading their own clock in.
  const [when, setWhen] = useState(() =>
    status.launchAt
      ? new Date(status.launchAt - new Date().getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16)
      : "",
  );

  function run(
    work: () => Promise<{ ok: boolean; error?: string; summary?: string }>,
  ) {
    setError(null);
    setNote(null);
    startTransition(async () => {
      const res = await work();
      if (res.ok) {
        setNote(res.summary ?? "تسجّل.");
        setConfirming(false);
        router.refresh();
      } else {
        setError(res.error ?? "ما نجّمناش.");
      }
    });
  }

  const held = status.state === "prelaunch";
  const btn =
    "rounded-input px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-40";
  const ghost = `${btn} border-border text-muted hover:border-primary border bg-white`;

  return (
    <div className="mt-6 space-y-8">
      {/* ── STATE ─────────────────────────────────────────────────────────── */}
      <section className="rounded-card border-border bg-surface border p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`grid size-10 shrink-0 place-items-center rounded-full ${
              held ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
            }`}
          >
            {held ? <Lock className="size-5" /> : <Unlock className="size-5" />}
          </span>
          <div className="me-auto">
            <h2 className="font-extrabold">
              {held ? "الموقع مغلق للعموم" : "الموقع مفتوح"}
            </h2>
            <p className="text-dim mt-0.5 text-xs">
              {held
                ? "الزوّار يشوفو القمع والعدّاد برك. الإدارة تشوف الموقع كامل."
                : "كلّ واحد يشوف الموقع عادي."}
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(() => setLaunchState(held ? "active" : "prelaunch"))
            }
            className={held ? `${btn} bg-accent text-white` : ghost}
          >
            {held ? "افتح الموقع" : "غلق الموقع"}
          </button>
        </div>
      </section>

      {/* ── TIMER ─────────────────────────────────────────────────────────── */}
      <section className="rounded-card border-border bg-surface border p-5">
        <h2 className="flex items-center gap-2 font-extrabold">
          <Clock className="text-primary size-5" />
          العدّاد التنازلي
        </h2>
        <p className="text-dim mt-1 text-xs">
          {launchAtLabel ? (
            <>
              محدّد على <span className="ltr-nums">{launchAtLabel}</span>
              {status.timerElapsed && " — الوقت كمل"}
            </>
          ) : (
            "ما كاش تاريخ محدّد. الصفحة تقول «قريباً» بلا رقم."
          )}
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div>
            <label
              htmlFor="launch-at"
              className="mb-1.5 block text-xs font-bold"
            >
              التاريخ والساعة
            </label>
            <input
              id="launch-at"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="rounded-input border-border focus:border-primary ltr-nums border bg-white px-3 py-2.5 text-sm font-semibold outline-none"
            />
          </div>
          <button
            type="button"
            disabled={pending || !when}
            onClick={() => run(() => setLaunchAt(new Date(when).getTime()))}
            className={`${btn} bg-accent text-white`}
          >
            حدّد
          </button>
          {[
            ["+ ساعة", 3_600_000],
            ["+ 24 ساعة", 86_400_000],
          ].map(([label, ms]) => (
            <button
              key={label as string}
              type="button"
              disabled={pending}
              onClick={() =>
                run(() =>
                  setLaunchAt((status.launchAt ?? Date.now()) + (ms as number)),
                )
              }
              className={ghost}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setLaunchAt(Date.now()))}
            className={ghost}
          >
            صفّرو توّا
          </button>
          {status.launchAt != null && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setLaunchAt(null))}
              className={ghost}
            >
              امسح التاريخ
            </button>
          )}
        </div>

        <p className="text-dim mt-3 text-xs leading-relaxed">
          تصفير العدّاد يوري «الوقت كمل» برك — ما ينشرش. النشر فعل منفصل بقصد:
          عدّاد يوصل للصفر وحد ما راه شايف ما يلزمش يكون هو اللي يخرّج ألف إعلان
          ماشي مراجَع للعموم.
        </p>
      </section>

      {/* ── COUNTS ────────────────────────────────────────────────────────── */}
      <section>
        <h2 className="font-extrabold">واش راه محجوز</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["إعلانات محجوزة", counts.heldListings],
              ["منها معتمدة", counts.approvedListings],
              ["طلبات محجوزة", counts.heldRequests],
              ["مسجّلون", counts.users],
            ] as const
          ).map(([label, value]) => (
            <div
              key={label}
              className="rounded-card border-border bg-surface border p-4"
            >
              <dt className="text-dim text-xs font-bold">{label}</dt>
              <dd className="ltr-nums mt-1 text-2xl font-black">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-dim mt-2 text-xs">
          <Link
            href="/admin/moderation"
            className="hover:text-primary underline"
          >
            راجع المحجوز واعتمدو
          </Link>{" "}
          — غير المعتمد يروح لطابور المراجعة العادي بعد الإطلاق، ما يتنشرش وما
          يضيعش.
        </p>
      </section>

      {/* ── NOTIFICATION CHANNELS ─────────────────────────────────────────── */}
      <section>
        <h2 className="font-extrabold">قنوات الإشعار</h2>
        <ul className="rounded-card border-border bg-surface mt-3 divide-y border">
          {(
            [
              ["push", "إشعار الهاتف (FCM)"],
              ["email", "بريد إلكتروني"],
              ["sms", "رسالة نصية (SMS)"],
            ] as const
          ).map(([channel, label]) => (
            <li key={channel} className="flex items-center gap-3 px-4 py-3">
              <span className="me-auto text-sm font-bold">{label}</span>
              {outbox[channel] > 0 && (
                <span className="text-dim ltr-nums text-xs font-bold">
                  {outbox[channel]} في الطابور
                </span>
              )}
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  channelsReady[channel]
                    ? "bg-success/10 text-success"
                    : "bg-warning/10 text-warning"
                }`}
              >
                {channelsReady[channel] ? "مربوط" : "ما كاش مزوّد"}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-dim mt-2 text-xs leading-relaxed">
          كل رسالة تتكتب في الطابور قبل ما تتبعث. القناة اللي ما عندهاش مزوّد
          تقعد رسايلها محفوظة — كي تربط المزوّد تتبعث، وما تضيع حتى وحدة.
        </p>
      </section>

      {/* ── THE SWITCH ────────────────────────────────────────────────────── */}
      <section className="rounded-card border-accent/30 bg-accent-soft/40 border p-5">
        <h2 className="flex items-center gap-2 font-extrabold">
          <Rocket className="text-accent size-5" />
          نفّذ الإطلاق
        </h2>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          ينشر <span className="ltr-nums">{counts.approvedListings}</span> إعلان
          معتمد و<span className="ltr-nums">{counts.heldRequests}</span> طلب،
          يحوّل{" "}
          <span className="ltr-nums">
            {counts.heldListings - counts.approvedListings}
          </span>{" "}
          إعلان غير معتمد لطابور المراجعة، يفتح الموقع، ويطلق الإشعارات لـ
          <span className="ltr-nums"> {counts.users}</span> مستعمل.
        </p>

        {error && (
          <p role="alert" className="text-danger mt-3 text-sm font-bold">
            {error}
          </p>
        )}
        {note && (
          <p
            role="status"
            className="rounded-input bg-success/10 text-success mt-3 flex items-start gap-2 px-4 py-3 text-sm font-bold"
          >
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
            {note}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {confirming ? (
            <>
              <span className="text-warning inline-flex items-center gap-1.5 text-sm font-bold">
                <AlertTriangle className="size-4" />
                متأكّد؟ ما كاش رجعة للمحتوى المنشور.
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(executeLaunch)}
                className={`${btn} bg-accent text-white`}
              >
                {pending ? "…" : "أكّد الإطلاق"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-muted px-3 py-2 text-sm font-bold"
              >
                إلغاء
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(true)}
              className={`${btn} bg-accent text-white`}
            >
              نفّذ الإطلاق
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
