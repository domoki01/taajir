"use client";

// ── SPENDING POINTS ──────────────────────────────────────────────────────────
// Four channels, but only the ones the admin has opened are drawn. A greyed-out
// "coming soon" row for a channel that may never open is a promise the site
// cannot keep; a channel that is closed simply is not offered.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Megaphone, Star, Wallet } from "lucide-react";
import { redeem } from "@/server/actions/affiliate";
import type { AffiliateSettings, PayoutChannel } from "@/types/affiliate";

type Choice = {
  channel: PayoutChannel;
  label: string;
  hint: string;
  Icon: typeof Star;
  /** RedotPay id or RIP number — the two channels that need somewhere to send. */
  asks?: string;
};

export function RedeemPanel({
  points,
  settings,
}: {
  points: number;
  settings: AffiliateSettings;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState<PayoutChannel | null>(null);
  const [destination, setDestination] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cash = Math.round(settings.minPayoutPoints * settings.dinarsPerPoint);

  const all: Choice[] = [
    {
      channel: "listingSlot",
      label: "إعلان زيادة",
      hint: `${settings.pointsPerListingSlot} نقطة — يزيد في حصّتك إعلان دائم`,
      Icon: Megaphone,
    },
    {
      channel: "featured",
      label: "تمييز إعلان أسبوع",
      hint: `${settings.pointsPerFeaturedWeek} نقطة — إعلانك يطلع فوق`,
      Icon: Star,
    },
    {
      channel: "redotpay",
      label: "RedotPay",
      hint: `${settings.minPayoutPoints} نقطة = ${cash} دج`,
      Icon: Wallet,
      asks: "معرّف RedotPay تاعك",
    },
    {
      channel: "ccp",
      label: "CCP / بريد الجزائر",
      hint: `${settings.minPayoutPoints} نقطة = ${cash} دج`,
      Icon: Banknote,
      asks: "رقم RIP (20 رقم)",
    },
  ];
  const choices = all.filter((c) => settings.channels[c.channel]);

  function priceOf(channel: PayoutChannel): number {
    if (channel === "listingSlot") return settings.pointsPerListingSlot;
    if (channel === "featured") return settings.pointsPerFeaturedWeek;
    return settings.minPayoutPoints;
  }

  function submit(channel: PayoutChannel) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await redeem(channel, destination);
      if (res.ok) {
        setMessage(res.message ?? "تمّ");
        setOpen(null);
        setDestination("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (choices.length === 0) {
    return (
      <p className="rounded-input bg-surface-soft text-muted px-4 py-3 text-sm leading-relaxed font-semibold">
        الاستبدال ما زال مسكّر. اجمع نقاطك دروك، والمشرف يحلّو قريب.
      </p>
    );
  }

  return (
    <div>
      {message && (
        <p className="rounded-input bg-success/10 text-success mb-3 px-4 py-3 text-sm font-bold">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-input bg-danger/10 text-danger mb-3 px-4 py-3 text-sm font-bold">
          {error}
        </p>
      )}

      <div className="grid gap-2">
        {choices.map(({ channel, label, hint, Icon, asks }) => {
          const price = priceOf(channel);
          const affordable = points >= price;
          return (
            <div
              key={channel}
              className="rounded-card border-border bg-surface border p-4"
            >
              <div className="flex items-center gap-3">
                <span className="bg-primary-soft text-primary grid size-10 shrink-0 place-items-center rounded-[12px]">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{label}</span>
                  <span className="text-dim ltr-nums block text-xs">
                    {hint}
                  </span>
                </span>

                <button
                  type="button"
                  disabled={!affordable || pending}
                  onClick={() =>
                    asks
                      ? setOpen(open === channel ? null : channel)
                      : submit(channel)
                  }
                  className="bg-accent rounded-input ms-auto shrink-0 px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {affordable ? "بدّل" : "ما يكفيش"}
                </button>
              </div>

              {open === channel && asks && (
                <div className="mt-3">
                  <label className="text-xs font-bold">
                    {asks}
                    <input
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      maxLength={40}
                      dir="ltr"
                      className="rounded-input border-border focus:border-primary ltr-nums mt-1 w-full border bg-white px-3 py-2.5 text-sm outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => submit(channel)}
                    className="bg-accent rounded-input mt-2 w-full py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {pending ? "راه يبعث…" : "ابعث الطلب"}
                  </button>
                  <p className="text-dim mt-2 text-xs leading-relaxed">
                    المشرف يراجع الطلب ويدفعلك. النقاط تتحجز من دروك باش ما
                    تتصرفش مرّتين — وإذا ترفض الطلب ترجعلك.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
