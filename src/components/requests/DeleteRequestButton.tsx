"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteRequest } from "@/server/actions/requests";

/**
 * Two-step, because deleting a request takes its whole thread with it — the
 * replies are the part other people wrote, and there is no undo.
 */
export function DeleteRequestButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    startTransition(async () => {
      const res = await deleteRequest(id);
      if (res.ok) router.push("/demandes");
      else setError(res.error);
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-dim hover:text-danger inline-flex items-center gap-1.5 text-sm font-bold transition-colors"
      >
        <Trash2 className="size-4" />
        امسح الطلب
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {error && (
        <span role="alert" className="text-danger text-sm font-bold">
          {error}
        </span>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={onDelete}
        className="bg-danger rounded-input px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        {pending ? "…" : "أكّد المسح"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-muted px-3 py-2 text-sm font-bold"
      >
        إلغاء
      </button>
    </span>
  );
}
