"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Send } from "lucide-react";
import { broadcastToEveryone } from "@/server/actions/broadcast";

/**
 * Writing one notification to every phone the site has.
 *
 * The send is behind a second, explicit confirmation, which is unusual on this
 * site — nothing else asks twice. It earns it: this is the only action here
 * with no undo of any kind. A published ad can be unpublished and a role can be
 * taken back, but a notification is on someone's lock screen the instant it is
 * sent, and there is no recalling it from thirty thousand phones.
 */
export function BroadcastPanel({
  users,
  devices,
}: {
  users: number;
  devices: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ sent: number; users: number } | null>(
    null,
  );

  const ready = title.trim().length >= 4 && body.trim().length >= 4;

  function send() {
    setError(null);
    startTransition(async () => {
      const res = await broadcastToEveryone(title, body, url);
      if (res.ok) {
        setDone({ sent: res.sent, users: res.users });
        setConfirming(false);
        setTitle("");
        setBody("");
        setUrl("/");
        router.refresh();
      } else {
        setError(res.error);
        setConfirming(false);
      }
    });
  }

  const field =
    "rounded-input border-border focus:border-primary mt-1 w-full border bg-white px-3 py-2.5 text-sm outline-none";

  return (
    <section className="rounded-card border-border bg-surface mt-5 border p-4">
      <p className="text-dim text-xs font-semibold">
        يوصل لـ <span className="text-primary ltr-nums">{devices}</span> جهاز،
        عند <span className="text-primary ltr-nums">{users}</span> حساب فعّلو
        التنبيهات.
      </p>
      {devices === 0 && (
        <p className="rounded-input bg-warning/10 text-warning mt-3 px-3 py-2 text-xs leading-relaxed font-semibold">
          حتى واحد ما فعّل التنبيهات للدرك. الناس لازم يزيدو الموقع في هواتفهم
          ويسمحو بالتنبيهات باش توصلهم.
        </p>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-xs font-bold">
          العنوان
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
            placeholder="عقارات جديدة في وهران"
            className={field}
          />
        </label>
        <label className="text-xs font-bold">
          الرابط
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            dir="ltr"
            placeholder="/vente/appartement/oran"
            className={field}
          />
        </label>
      </div>

      <label className="mt-3 block text-xs font-bold">
        النصّ
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={160}
          rows={2}
          placeholder="زيد من 40 إعلان جديد هذا الأسبوع. شوفهم قبل ما يروحو."
          className={`${field} resize-none`}
        />
        <span className="text-dim ltr-nums mt-1 block text-[11px] font-normal">
          {body.trim().length}/160 — الهاتف يقصّ اللي يفوت سطرين
        </span>
      </label>

      {error && (
        <p role="alert" className="text-danger mt-3 text-sm font-bold">
          {error}
        </p>
      )}

      {done && (
        <p
          role="status"
          className="rounded-input bg-success/10 text-success mt-3 flex items-center gap-2 px-4 py-3 text-sm font-bold"
        >
          <CheckCircle2 className="size-5 shrink-0" />
          تبعث لـ {done.sent} جهاز، عند {done.users} حساب.
        </p>
      )}

      {confirming ? (
        <div className="rounded-input bg-danger/10 mt-4 p-3.5">
          <p className="text-danger flex items-start gap-2 text-sm leading-relaxed font-bold">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            هذا يوصل لـ {devices} جهاز دروك، وما يتراجعش. متأكّد؟
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={send}
              className="bg-danger rounded-input px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
            >
              {pending ? "راه يبعث…" : "إي، ابعث"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="rounded-input border-border text-muted border bg-white px-4 py-2.5 text-sm font-bold"
            >
              رجّع
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={!ready || pending || devices === 0}
          onClick={() => {
            setDone(null);
            setConfirming(true);
          }}
          className="bg-accent rounded-input mt-4 inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Send className="size-4" strokeWidth={2.6} />
          ابعث للكل
        </button>
      )}
    </section>
  );
}
