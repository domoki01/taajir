"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";
import { resetBranding, saveBranding } from "@/server/actions/branding";
import { contrastRatio, kAaNormal } from "@/lib/contrast";
import { kBrandColors, type BrandColor } from "@/types/branding";
import type { Branding } from "@/types/branding";

/**
 * What each colour has to stay readable against, and why.
 *
 * The pairs are not decoration — they are the actual combinations the site
 * renders. `accent` is only ever a filled button with white text on it, so the
 * question for `accent` is "is white readable on this", and nothing else.
 */
const kChecks: Record<BrandColor, { against: string; note: string } | null> = {
  primary: { against: "#ffffff", note: "نص على خلفية بيضاء" },
  primaryStrong: { against: "#ffffff", note: "نص على خلفية بيضاء" },
  primarySoft: null, // Checked against `primary` below — it is that text's background.
  accent: { against: "#ffffff", note: "نص أبيض فوق الزرّ" },
  accentStrong: { against: "#ffffff", note: "نص أبيض فوق الزرّ" },
  accentSoft: null,
};

const kDefaults: Record<BrandColor, string> = {
  primary: "#1e293b",
  primaryStrong: "#0f172a",
  primarySoft: "#dde5f0",
  accent: "#059669",
  accentStrong: "#047857",
  accentSoft: "#d1fae5",
};

const kKeys = Object.keys(kBrandColors) as BrandColor[];

export function BrandingEditor({ branding }: { branding: Branding }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [siteName, setSiteName] = useState(branding.siteName);
  const [tagline, setTagline] = useState(branding.tagline);
  const [logoUrl, setLogoUrl] = useState(branding.logoUrl ?? "");
  const [colors, setColors] = useState<Record<BrandColor, string>>(
    () =>
      Object.fromEntries(
        kKeys.map((k) => [k, branding.colors[k] ?? kDefaults[k]]),
      ) as Record<BrandColor, string>,
  );

  function setColor(key: BrandColor, value: string) {
    setSaved(false);
    setColors((prev) => ({ ...prev, [key]: value }));
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

  // Warnings, not blocks. Contrast is a judgement about readability, and an
  // admin who has decided their brand navy is worth 4.3:1 is allowed to be
  // wrong about it — what they are not allowed to be is uninformed.
  const warnings: string[] = [];
  for (const key of kKeys) {
    const check = kChecks[key];
    if (!check) continue;
    const ratio = contrastRatio(colors[key], check.against);
    if (ratio !== null && ratio < kAaNormal) {
      warnings.push(
        `${kBrandColors[key]}: ${ratio.toFixed(1)}:1 (${check.note}) — تحت ${kAaNormal}:1`,
      );
    }
  }
  const badgeRatio = contrastRatio(colors.primary, colors.primarySoft);
  if (badgeRatio !== null && badgeRatio < kAaNormal) {
    warnings.push(
      `الشارات: ${badgeRatio.toFixed(1)}:1 — اللون الأساسي فوق الأساسي الفاتح`,
    );
  }

  const field =
    "rounded-input border-border focus:border-primary w-full border bg-white px-3 py-2 text-sm outline-none";

  return (
    <div className="mt-6 space-y-8">
      <section className="space-y-4">
        <h2 className="font-extrabold">الاسم والشعار</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-bold">
            اسم الموقع
            <input
              value={siteName}
              onChange={(e) => {
                setSiteName(e.target.value);
                setSaved(false);
              }}
              className={`${field} mt-1`}
            />
          </label>
          <label className="block text-xs font-bold">
            الوصف القصير
            <input
              value={tagline}
              onChange={(e) => {
                setTagline(e.target.value);
                setSaved(false);
              }}
              className={`${field} mt-1`}
            />
          </label>
        </div>
        <label className="block text-xs font-bold">
          رابط الشعار (اختياري)
          <input
            value={logoUrl}
            onChange={(e) => {
              setLogoUrl(e.target.value);
              setSaved(false);
            }}
            dir="ltr"
            placeholder="https://…"
            className={`${field} mt-1 text-start`}
          />
        </label>
        <p className="text-dim text-xs leading-relaxed">
          الاسم يبان في الترويسة، في تذييل الصفحة، في عنوان التبويب وفي اسم
          التطبيق كي يزيدوه للشاشة الرئيسية.
        </p>
      </section>

      <section>
        <h2 className="font-extrabold">الألوان</h2>
        <p className="text-dim mt-1 text-xs leading-relaxed">
          لونين برك، والفرق بيناتهم مقصود: الأساسي للبنية والمعلومة (عناوين،
          روابط، أسعار، شارات)، ولون الأزرار للأفعال وحدها. كي يولّي السعر بلون
          الزرّ، الأزرار تحبس تبان كأزرار.
        </p>

        <ul className="mt-4 space-y-3">
          {kKeys.map((key) => (
            <li key={key} className="flex flex-wrap items-center gap-3">
              <input
                type="color"
                value={
                  /^#[0-9a-f]{6}$/i.test(colors[key])
                    ? colors[key]
                    : kDefaults[key]
                }
                onChange={(e) => setColor(key, e.target.value)}
                aria-label={kBrandColors[key]}
                className="border-border size-10 shrink-0 cursor-pointer rounded-lg border bg-white"
              />
              <input
                value={colors[key]}
                onChange={(e) => setColor(key, e.target.value)}
                dir="ltr"
                aria-label={`${kBrandColors[key]} — hex`}
                className={`${field} ltr-nums w-28 shrink-0 text-start`}
              />
              <span className="text-muted min-w-0 flex-1 text-xs font-semibold">
                {kBrandColors[key]}
              </span>
              {colors[key].toLowerCase() !== kDefaults[key] && (
                <button
                  type="button"
                  onClick={() => setColor(key, kDefaults[key])}
                  className="text-dim hover:text-primary text-xs font-bold"
                >
                  رجّع الافتراضي
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {warnings.length > 0 && (
        <div
          role="alert"
          className="rounded-card bg-warning/10 text-warning border-warning/30 border p-4"
        >
          <p className="flex items-center gap-2 text-sm font-extrabold">
            <AlertTriangle className="size-5 shrink-0" />
            تحذير قراءة
          </p>
          <ul className="mt-2 space-y-1 text-xs font-semibold">
            {warnings.map((w) => (
              <li key={w} className="ltr-nums">
                {w}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs leading-relaxed">
            المعيار العالمي (WCAG AA) يطلب {kAaNormal}:1 على الأقل. تقدر تسجّل
            برك، لكن الناس اللي تقرا في الشمس ولا على شاشة رخيصة ما تبقاش تشوف
            المكتوب.
          </p>
        </div>
      )}

      <section>
        <h2 className="font-extrabold">معاينة</h2>
        <div
          className="rounded-card border-border mt-3 border bg-white p-5"
          style={
            {
              "--preview-primary": colors.primary,
              "--preview-primary-soft": colors.primarySoft,
              "--preview-accent": colors.accent,
            } as React.CSSProperties
          }
        >
          <p
            className="text-xl font-black"
            style={{ color: "var(--preview-primary)" }}
          >
            {siteName || "اسم الموقع"}
          </p>
          <p className="text-dim mt-1 text-sm">{tagline || "الوصف القصير"}</p>
          <p
            className="ltr-nums mt-3 text-2xl font-black"
            style={{ color: "var(--preview-primary)" }}
          >
            12 500 000 دج
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-3 py-1 text-xs font-bold"
              style={{
                background: "var(--preview-primary-soft)",
                color: "var(--preview-primary)",
              }}
            >
              منشورة
            </span>
            <button
              type="button"
              className="rounded-input px-5 py-2.5 text-sm font-bold text-white"
              style={{ background: "var(--preview-accent)" }}
            >
              اتصل بالمالك
            </button>
          </div>
        </div>
      </section>

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
          تسجّل. الموقع كامل تبدّل.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() => saveBranding({ siteName, tagline, logoUrl, colors }))
          }
          className="bg-accent rounded-input px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pending ? "…" : "سجّل"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => resetBranding())}
          className="rounded-input border-border text-muted hover:border-primary inline-flex items-center gap-1.5 border bg-white px-4 py-3 text-sm font-bold transition-colors disabled:opacity-40"
        >
          <RotateCcw className="size-4" />
          رجّع كلش للافتراضي
        </button>
      </div>
    </div>
  );
}
