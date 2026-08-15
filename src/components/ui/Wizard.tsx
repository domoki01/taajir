"use client";

import { ArrowRight } from "lucide-react";

/**
 * One question per screen, with the button under the thumb.
 *
 * The shape both the listing and the demand forms wear. It exists because the
 * publish form used to be seven sections and eighteen fields on a single
 * scroll: on a phone that is a wall, and the submit button — the only thing the
 * screen is for — sits below all of it.
 *
 * The button is `sticky bottom-0` with the safe-area inset added, matching
 * BottomNav. Both never show at once: `isImmersiveRoute` stands the nav down on
 * these routes, so there is only ever one bar competing for the bottom of the
 * viewport.
 */
export function Wizard({
  step,
  total,
  title,
  hint,
  canGoNext,
  nextLabel = "التالي",
  busy = false,
  onBack,
  onNext,
  onSkip,
  children,
}: {
  /** 1-based, for the counter and the progress bar. */
  step: number;
  total: number;
  title: string;
  hint?: string;
  canGoNext: boolean;
  nextLabel?: string;
  busy?: boolean;
  /** Absent on the first step, where there is nothing to go back to. */
  onBack?: () => void;
  onNext: () => void;
  /** Present only on steps that are entirely optional. */
  onSkip?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100dvh-1rem)] flex-col">
      <div className="mb-5">
        <div className="mb-3 flex items-center gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              disabled={busy}
              aria-label="رجوع"
              className="text-muted hover:text-primary -ms-2 grid size-9 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-40"
            >
              <ArrowRight className="size-5" strokeWidth={2.6} />
            </button>
          ) : (
            <span className="size-9 shrink-0" aria-hidden />
          )}
          <span className="text-dim ltr-nums ms-auto text-xs font-bold">
            {step} / {total}
          </span>
        </div>

        <div
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-label="تقدّم"
          className="bg-surface-soft h-1.5 overflow-hidden rounded-full"
        >
          <div
            className="bg-primary h-full rounded-full transition-[width] duration-300"
            style={{ width: `${(step / total) * 100}%` }}
          />
        </div>

        <h1 className="mt-5 text-xl font-black">{title}</h1>
        {hint && (
          <p className="text-dim mt-1.5 text-sm leading-relaxed">{hint}</p>
        )}
      </div>

      <div className="flex-1 pb-4">{children}</div>

      <div className="bg-bg sticky bottom-0 -mx-4 flex items-center gap-3 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:mx-0 sm:px-0">
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            disabled={busy}
            className="text-muted hover:text-primary shrink-0 px-3 py-4 text-sm font-bold transition-colors disabled:opacity-40"
          >
            تخطّى
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={busy || !canGoNext}
          className="bg-accent rounded-input flex-1 py-4 text-base font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "…" : nextLabel}
        </button>
      </div>
    </div>
  );
}

/** Big tappable choices — what a `<select>` should be on a phone. */
export function ChoiceGrid<T extends string>({
  options,
  value,
  onChange,
  columns = 2,
}: {
  options: Array<{ value: T; label: string }>;
  value: T | "";
  onChange: (value: T) => void;
  columns?: 1 | 2;
}) {
  return (
    <div
      className={`grid gap-2 ${columns === 1 ? "grid-cols-1" : "grid-cols-2"}`}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-card min-h-14 border px-4 py-3.5 text-sm font-bold transition-colors ${
            value === o.value
              ? "border-primary bg-primary-soft text-primary"
              : "border-border text-muted hover:border-primary bg-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
