"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock } from "lucide-react";
import { approveForLaunch } from "@/server/actions/launch";

/**
 * Approve a held ad without publishing it.
 *
 * The ordinary "وافق" button publishes on the spot, which is exactly wrong
 * while the site is closed: it would put the ad on a site nobody can see and
 * take it out of the launch batch. This marks it for the batch instead, and the
 * ad stays invisible until the switch.
 */
export function HoldApproval({
  id,
  approved,
}: {
  id: string;
  approved: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const res = await approveForLaunch(id, !approved);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="bg-warning/10 text-warning inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold">
        <Clock className="size-3.5" strokeWidth={3} />
        محجوز للإطلاق
      </span>

      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={approved}
        className={`rounded-input inline-flex items-center gap-1.5 border px-4 py-2 text-sm font-bold transition-colors disabled:opacity-40 ${
          approved
            ? "border-success bg-success/10 text-success"
            : "border-border text-muted bg-white"
        }`}
      >
        <Check className="size-4" strokeWidth={3} />
        {pending ? "…" : approved ? "معتمد للإطلاق" : "اعتمدو للإطلاق"}
      </button>

      {error && (
        <span role="alert" className="text-danger text-xs font-bold">
          {error}
        </span>
      )}
    </div>
  );
}
