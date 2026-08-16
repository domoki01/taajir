"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Check, MapPin, X } from "lucide-react";
import { approveRequest, rejectRequest } from "@/server/actions/requests";
import { getWilaya, placeLabel } from "@/lib/geo";
import { kRequestIntents } from "@/lib/enums";
import { kPolicyFlags, kPolicyReasons } from "@/lib/policy";
import type { PropertyRequest } from "@/types/request";

/**
 * One demand awaiting a human, with the reason it got here.
 *
 * The flag is shown first because it is the moderator's shortcut: the automatic
 * check already read the post and said what bothered it, and re-reading a
 * paragraph hunting for the problem is the slow way to do this a hundred times.
 */
export function RequestModerationCard({
  request,
  createdAtLabel,
}: {
  request: PropertyRequest;
  createdAtLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const where = request.communeSlug
    ? placeLabel(request.wilayaSlug, request.communeSlug)
    : (getWilaya(request.wilayaSlug)?.nameAr ?? request.wilayaSlug);

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await work();
      if (res.ok) {
        setRejecting(false);
        router.refresh();
      } else {
        setError(res.error ?? "وقع مشكل");
      }
    });
  }

  const flag = request.policyRule ? kPolicyFlags[request.policyRule] : null;

  return (
    <li className="rounded-card border-border bg-surface border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="bg-primary-soft text-primary rounded-full px-2.5 py-0.5 text-[11px] font-extrabold">
          {kRequestIntents[request.intent]}
        </span>
        <span className="text-dim text-xs font-bold">{request.ownerName}</span>
        <span className="text-dim ltr-nums text-xs">{createdAtLabel}</span>
      </div>

      {flag && (
        <p className="rounded-input bg-warning/10 text-warning mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold">
          <AlertTriangle className="size-3.5 shrink-0" />
          {flag}
        </p>
      )}

      <h3 className="mt-2 font-extrabold">{request.title}</h3>
      <p className="text-muted mt-1 text-sm leading-relaxed whitespace-pre-line">
        {request.description}
      </p>

      <p className="text-dim mt-2 inline-flex items-center gap-1 text-xs font-bold">
        <MapPin className="size-3.5" />
        {where}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => approveRequest(request.id))}
          className="bg-accent rounded-input inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Check className="size-4" strokeWidth={3} />
          وافق
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setRejecting((v) => !v)}
          className="rounded-input border-border text-danger hover:border-danger inline-flex items-center gap-1.5 border bg-white px-4 py-2 text-sm font-bold transition-colors disabled:opacity-40"
        >
          <X className="size-4" strokeWidth={3} />
          ارفض
        </button>
        <Link
          href={`/demandes/${request.id}`}
          className="text-dim hover:text-primary ms-auto text-xs font-bold"
        >
          شوفو كامل
        </Link>
      </div>

      {rejecting && (
        <div className="mt-3">
          <label
            htmlFor={`why-${request.id}`}
            className="text-dim mb-1.5 block text-xs font-bold"
          >
            سبب الرفض — يوصل لصاحب الطلب كيما هو
          </label>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(kPolicyReasons).map(([key, text]) => (
              <button
                key={key}
                type="button"
                onClick={() => setReason(text)}
                className="rounded-input border-border text-muted hover:border-primary border bg-white px-2.5 py-1 text-[11px] font-bold transition-colors"
              >
                {key}
              </button>
            ))}
          </div>
          <textarea
            id={`why-${request.id}`}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="اشرح السبب باش يفهم ويصلّح."
            className="rounded-input border-border focus:border-primary mt-2 w-full resize-none border bg-white px-3 py-2 text-sm outline-none"
          />
          <button
            type="button"
            disabled={pending || reason.trim().length < 5}
            onClick={() => run(() => rejectRequest(request.id, reason))}
            className="bg-danger rounded-input mt-2 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            أكّد الرفض
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-danger mt-2 text-sm font-bold">
          {error}
        </p>
      )}
    </li>
  );
}
