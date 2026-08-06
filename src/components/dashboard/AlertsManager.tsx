"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, BellRing, Plus, Trash2 } from "lucide-react";
import {
  createSavedSearch,
  deleteSavedSearch,
  setSavedSearchNotify,
} from "@/server/actions/savedSearches";
import { disablePush, enablePush, pushState } from "@/lib/firebase/messaging";
import { getCommunes, kWilayas } from "@/lib/geo";
import { kPropertyTypes, kTransactionFilterLabels } from "@/lib/enums";

export type AlertRow = {
  id: string;
  label: string;
  notify: boolean;
  matchCount: number;
  createdAtLabel: string;
  lastNotifiedLabel: string | null;
  /** Deep link to the same results the alert watches. */
  href: string;
};

export function AlertsManager({
  alerts,
  deviceCount,
  max,
}: {
  alerts: AlertRow[];
  deviceCount: number;
  max: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // ── PUSH PERMISSION ────────────────────────────────────────────────────────
  // null until the first effect runs: the answer depends on browser APIs that
  // do not exist during SSR, so rendering a guess would be a hydration mismatch
  // and, worse, would flash the wrong button.
  const [push, setPush] = useState<Awaited<
    ReturnType<typeof pushState>
  > | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [devices, setDevices] = useState(deviceCount);

  useEffect(() => {
    pushState().then(setPush);
  }, []);

  async function onEnablePush() {
    setPushBusy(true);
    setPushError(null);
    const res = await enablePush();
    if (res.ok) {
      setDevices((n) => n + 1);
      setPush("granted");
    } else {
      setPushError(res.error);
      setPush(await pushState());
    }
    setPushBusy(false);
  }

  async function onDisablePush() {
    setPushBusy(true);
    setPushError(null);
    const res = await disablePush();
    if (res.ok) setDevices(0);
    else setPushError(res.error);
    setPushBusy(false);
  }

  // ── NEW ALERT ──────────────────────────────────────────────────────────────
  const [transactionType, setTransactionType] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [wilayaSlug, setWilayaSlug] = useState("");
  const [communeSlug, setCommuneSlug] = useState("");

  const communes = useMemo(() => {
    const wilaya = kWilayas.find((w) => w.slug === wilayaSlug);
    return wilaya ? getCommunes(wilaya.code) : [];
  }, [wilayaSlug]);

  function onCreate(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(null);

    startTransition(async () => {
      const res = await createSavedSearch({
        transactionType,
        propertyType,
        wilayaSlug,
        communeSlug,
      });
      if (res.ok) {
        setTransactionType("");
        setPropertyType("");
        setWilayaSlug("");
        setCommuneSlug("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function onToggle(id: string, notify: boolean) {
    startTransition(async () => {
      const res = await setSavedSearchNotify(id, notify);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const res = await deleteSavedSearch(id);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  const field =
    "rounded-input border-border focus:border-primary w-full border bg-white px-4 py-3 text-base outline-none appearance-none font-semibold";
  const full = alerts.length >= max;

  return (
    <div className="mt-6 space-y-8">
      {/* ── PUSH ─────────────────────────────────────────────────────────── */}
      <section className="rounded-card border-border bg-surface border p-5">
        <div className="flex flex-wrap items-start gap-3">
          <BellRing className="text-primary mt-0.5 size-5 shrink-0" />
          <div className="me-auto">
            <h2 className="font-extrabold">التنبيهات على الهاتف</h2>
            <p className="text-dim mt-1 text-sm">
              {push === null
                ? "…"
                : push === "unsupported"
                  ? "المتصفّح تاعك ما يدعمش التنبيهات. إذا راك على آيفون، زيد الموقع لشاشة البداية باش تخدم."
                  : push === "unconfigured"
                    ? "التنبيهات ما زالت ما تفعّلتش على الموقع. تنبيهاتك محفوظة وتخدم كي تتفعّل."
                    : push === "denied"
                      ? "منعت التنبيهات فهذا المتصفّح. رجّعها من إعدادات الموقع فالمتصفّح."
                      : devices > 0
                        ? "هذا المتصفّح يستقبل التنبيهات."
                        : "فعّل التنبيهات باش توصلك الإعلانات الجديدة وقت ما تُنشر."}
            </p>
          </div>

          {push !== null &&
            push !== "unsupported" &&
            push !== "unconfigured" && (
              <button
                type="button"
                onClick={devices > 0 ? onDisablePush : onEnablePush}
                disabled={pushBusy || push === "denied"}
                className={
                  devices > 0
                    ? "rounded-input border-border hover:border-primary border bg-white px-4 py-2 text-sm font-bold transition-colors disabled:opacity-40"
                    : "bg-accent rounded-input px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                }
              >
                {pushBusy
                  ? "…"
                  : devices > 0
                    ? "وقّف التنبيهات"
                    : "فعّل التنبيهات"}
              </button>
            )}
        </div>

        {pushError && (
          <p role="alert" className="text-danger mt-3 text-sm font-bold">
            {pushError}
          </p>
        )}
      </section>

      {/* ── NEW ALERT ────────────────────────────────────────────────────── */}
      <section>
        <h2 className="font-extrabold">تنبيه جديد</h2>
        <p className="text-dim mt-1 text-sm">
          اختر الولاية — والبلدية إذا حبّيت — ونبّهوك كي يُنشر إعلان يشبهها.
        </p>

        <form onSubmit={onCreate} className="mt-4 max-w-2xl space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="alert-transaction"
                className="mb-1.5 block text-sm font-bold"
              >
                نوع العملية
              </label>
              <select
                id="alert-transaction"
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value)}
                className={field}
              >
                <option value="">بيع ولا كراء</option>
                {Object.entries(kTransactionFilterLabels).map(
                  ([slug, label]) => (
                    <option key={slug} value={slug}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div>
              <label
                htmlFor="alert-type"
                className="mb-1.5 block text-sm font-bold"
              >
                نوع العقار
              </label>
              <select
                id="alert-type"
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                className={field}
              >
                <option value="">كل أنواع العقار</option>
                {Object.entries(kPropertyTypes).map(([slug, label]) => (
                  <option key={slug} value={slug}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="alert-wilaya"
                className="mb-1.5 block text-sm font-bold"
              >
                الولاية
              </label>
              <select
                id="alert-wilaya"
                value={wilayaSlug}
                onChange={(e) => {
                  setWilayaSlug(e.target.value);
                  // A commune from the previous wilaya would be rejected by the
                  // server; clearing it is the only sane reading of the change.
                  setCommuneSlug("");
                }}
                className={field}
              >
                <option value="">اختر الولاية</option>
                {kWilayas.map((w) => (
                  <option key={w.slug} value={w.slug}>
                    {String(w.code).padStart(2, "0")} — {w.nameAr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="alert-commune"
                className="mb-1.5 block text-sm font-bold"
              >
                البلدية <span className="text-dim font-normal">(اختياري)</span>
              </label>
              <select
                id="alert-commune"
                value={communeSlug}
                onChange={(e) => setCommuneSlug(e.target.value)}
                disabled={!wilayaSlug}
                className={`${field} disabled:opacity-50`}
              >
                <option value="">كل بلديات الولاية</option>
                {communes.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.nameAr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-danger text-sm font-bold">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || full}
            className="bg-accent rounded-input inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Plus className="size-4" strokeWidth={3} />
            {pending ? "…" : "زيد التنبيه"}
          </button>
          {full && (
            <p className="text-warning text-xs font-bold">
              وصلت لأقصى عدد تنبيهات (<span className="ltr-nums">{max}</span>).
              امسح واحد باش تزيد آخر.
            </p>
          )}
        </form>
      </section>

      {/* ── LIST ─────────────────────────────────────────────────────────── */}
      <section>
        <h2 className="font-extrabold">
          تنبيهاتي{" "}
          <span className="text-dim ltr-nums text-sm font-bold">
            {alerts.length}/{max}
          </span>
        </h2>

        {alerts.length === 0 ? (
          <p className="rounded-card border-border text-dim mt-4 border border-dashed px-5 py-8 text-center text-sm">
            ما عندك حتى تنبيه. زيد واحد من فوق.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {alerts.map((a) => (
              <li
                key={a.id}
                className="rounded-card border-border bg-surface flex flex-wrap items-center gap-3 border p-4"
              >
                <div className="me-auto min-w-0">
                  <a
                    href={a.href}
                    className="text-primary font-bold hover:underline"
                  >
                    {a.label}
                  </a>
                  <p className="text-dim mt-1 text-xs">
                    <span className="ltr-nums">{a.createdAtLabel}</span>
                    {a.matchCount > 0 && (
                      <>
                        {" · "}
                        <span className="ltr-nums">{a.matchCount}</span> إعلان
                      </>
                    )}
                    {a.lastNotifiedLabel && (
                      <>
                        {" · آخر تنبيه "}
                        <span className="ltr-nums">{a.lastNotifiedLabel}</span>
                      </>
                    )}
                  </p>
                </div>

                {/* The two controls wrap as a unit: on a narrow screen the
                    label takes the first line and the buttons stay together on
                    the second, rather than the delete button dropping onto a
                    third line of its own. */}
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onToggle(a.id, !a.notify)}
                    disabled={pending}
                    aria-pressed={a.notify}
                    className={`rounded-input inline-flex items-center gap-1.5 border px-3 py-2 text-xs font-bold transition-colors disabled:opacity-40 ${
                      a.notify
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border text-dim bg-white"
                    }`}
                  >
                    {a.notify ? (
                      <Bell className="size-3.5" strokeWidth={3} />
                    ) : (
                      <BellOff className="size-3.5" strokeWidth={3} />
                    )}
                    {a.notify ? "يخدم" : "واقف"}
                  </button>

                  <button
                    type="button"
                    onClick={() => onDelete(a.id)}
                    disabled={pending}
                    aria-label={`امسح ${a.label}`}
                    className="rounded-input border-border text-danger hover:border-danger border bg-white p-2 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
