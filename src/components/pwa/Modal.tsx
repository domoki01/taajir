"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * The shell both first-run dialogs share.
 *
 * A centred modal rather than a banner, because both of these ask a question
 * and a banner is easy to scroll past without ever deciding. The cost is that a
 * modal interrupts, so each one is shown at most once and remembers the answer.
 */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="إغلاق"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/50"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="rounded-t-sheet bg-surface shadow-lifted relative w-full max-w-sm p-5 outline-none sm:rounded-2xl"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="سكّر"
          className="text-dim hover:text-primary absolute end-3 top-3 grid size-8 place-items-center rounded-full transition-colors"
        >
          <X className="size-4" />
        </button>
        {children}
      </div>
    </div>
  );
}
