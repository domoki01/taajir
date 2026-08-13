"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldQuestion } from "lucide-react";
import { setRequireApproval } from "@/server/actions/users";

/**
 * The registration-approval switch, with the one warning that matters.
 *
 * Switching on is not destructive — the action approves every existing account
 * in the same call — and the copy says so, because an admin who thinks it might
 * lock out their whole user base will never touch it, and an admin who thinks
 * it silently applies to everyone will be surprised twice.
 */
export function ApprovalSwitch({
  on,
  pendingCount,
}: {
  on: boolean;
  pendingCount: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const res = await setRequireApproval(!on);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <section className="rounded-card border-border bg-surface mt-5 border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <ShieldQuestion className="text-primary size-5 shrink-0" />
        <div className="me-auto min-w-0">
          <h2 className="font-extrabold">تأكيد التسجيلات</h2>
          <p className="text-muted mt-1 text-xs leading-relaxed">
            {on ? (
              <>
                مشعول. الحساب الجديد يتصفّح ويدخل عادي، لكن ما ينشرش إعلان ولا
                طلب ولا تعليق حتى تأكّدو من هنا.
                {pendingCount !== null && pendingCount > 0 && (
                  <>
                    {" "}
                    <span className="text-warning ltr-nums font-bold">
                      {pendingCount} حساب يستنّى.
                    </span>
                  </>
                )}
              </>
            ) : (
              "مطفي. كل حساب جديد ينشر مباشرة. كي تشعلو، كل الحسابات الموجودة تتأكّد تلقائياً في نفس اللحظة — ما يتوقّف حتى واحد كان يخدم."
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-pressed={on}
          className={`rounded-input shrink-0 px-5 py-2.5 text-sm font-bold transition-colors disabled:opacity-40 ${
            on
              ? "border-border text-muted hover:border-primary border bg-white"
              : "bg-accent text-white hover:opacity-90"
          }`}
        >
          {pending ? "…" : on ? "طفّيه" : "شعّلو"}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-danger mt-3 text-sm font-bold">
          {error}
        </p>
      )}
    </section>
  );
}
