"use client";

// ── THE INVITATION, AT THE ONE MOMENT IT LANDS ───────────────────────────────
// Somebody has just finished creating an account. They are on an empty
// dashboard with nothing published and no reason to come back tomorrow, and the
// site happens to be running a race with real prizes in it. That gap — between
// "I signed up" and "and now what" — is the whole reason this dialog exists.
//
// Two things keep it from being a nuisance. It is shown only on the page load
// that follows a sign-up, and only when a campaign is actually live: between
// campaigns the admin's switch can stay on and nobody ever sees anything. And
// entering happens here, in one tap, rather than being a link to a page the
// person would have to be sold on twice.

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Gift, Trophy } from "lucide-react";
import {
  claimFirstRunDialog,
  justSignedUpPending,
  kFirstRunReleased,
  releaseFirstRunDialog,
  takeJustSignedUp,
} from "@/lib/firstRun";
import { Modal } from "@/components/pwa/Modal";
import { PrizeArt } from "@/components/affiliate/PrizeArt";
import { contestInvite, joinCampaign } from "@/server/actions/affiliate";
import type { ContestInvite } from "@/types/affiliate";

/** How long is left, said the way somebody would say it out loud. */
function remaining(endsAt: number, now: number): string {
  const ms = endsAt - now;
  if (ms <= 0) return "";
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `باقي ${days} يوم`;
  const hours = Math.max(1, Math.floor(ms / 3600000));
  return `باقي ${hours} سا`;
}

export function ContestPrompt() {
  const [invite, setInvite] = useState<ContestInvite | null>(null);
  const [left, setLeft] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    let alive = true;
    // Asked at most once per mount. Releasing the claim is itself the signal
    // that re-arms these timers, so without this the "no campaign" answer would
    // release, re-arm, ask again, and turn a single question into a poll.
    let asked = false;

    // Earlier than the notification dialog's timer on purpose: this one has a
    // round trip to make before it knows whether it has anything to say, and
    // the claim it takes below is what keeps the other dialogs waiting while it
    // finds out.
    async function offer() {
      if (asked || !justSignedUpPending()) return;
      if (!claimFirstRunDialog()) return;
      asked = true;

      // Any failure here — offline, an action that throws — is a dialog that
      // does not appear, which is the correct outcome for something optional.
      // What must not happen is the claim staying held after a "no".
      let race: ContestInvite | null = null;
      try {
        race = await contestInvite();
      } catch {
        race = null;
      }

      if (!race || !alive) {
        releaseFirstRunDialog();
        return;
      }

      // Consumed only now that this dialog is certain it is the one showing.
      takeJustSignedUp();
      setLeft(remaining(race.endsAt, Date.now()));
      setPicked(race.prizes.find((p) => !p.soldOut)?.id ?? null);
      setInvite(race);
    }

    let timer = window.setTimeout(offer, 500);

    // The sign-up that this dialog exists for happens *after* this component
    // has mounted and its first timer has already come and gone — the layout is
    // shared, so it is the same mount either side of the redirect. Marking the
    // sign-up releases the visit's dialog claim, and that is the signal to look
    // again.
    function rearm() {
      window.clearTimeout(timer);
      timer = window.setTimeout(offer, 500);
    }
    window.addEventListener(kFirstRunReleased, rearm);

    return () => {
      alive = false;
      window.clearTimeout(timer);
      window.removeEventListener(kFirstRunReleased, rearm);
    };
  }, []);

  async function enter() {
    if (!picked || busy) return;
    setBusy(true);
    setError(null);
    const res = await joinCampaign(picked);
    setBusy(false);
    if (res.ok) setJoined(true);
    else setError(res.error);
  }

  if (!invite) return null;

  return (
    <Modal title="ادخل للمسابقة" onClose={() => setInvite(null)}>
      <span
        className={`grid size-12 place-items-center rounded-full ${
          joined ? "bg-success/15 text-success" : "bg-primary-soft text-primary"
        }`}
      >
        {joined ? (
          <Check className="size-6" strokeWidth={3} />
        ) : (
          <Gift className="size-6" />
        )}
      </span>

      {joined ? (
        <>
          <h2 className="mt-3 text-lg font-black">دخلت السباق 🎉</h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            كل إعلان تنشرو وكل صاحب تجيبو يزيدك نقاط. كي توصل{" "}
            <b className="text-primary ltr-nums">{invite.threshold}</b> نقطة
            تفتح جائزتك.
          </p>
          <Link
            href="/concours"
            onClick={() => setInvite(null)}
            className="bg-accent rounded-input mt-4 flex w-full items-center justify-center gap-2 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            <Trophy className="size-4" strokeWidth={2.6} />
            شوف المسابقة
          </Link>
        </>
      ) : (
        <>
          <h2 className="mt-3 text-lg leading-snug font-black">
            مرحبا بيك! تحب تدخل {invite.name}؟
          </h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            {invite.prize} — اختر جائزتك، وجمّع{" "}
            <b className="text-primary ltr-nums">{invite.threshold}</b> نقطة
            بالنشر ولا بجلب أصحابك.
            {left && <span className="text-dim"> ({left})</span>}
          </p>

          {/* The shelf, in miniature. Choosing here rather than on the contest
              page is the difference between an invitation and an errand. */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {invite.prizes.slice(0, 3).map((prize) => {
              const active = picked === prize.id;
              return (
                <button
                  key={prize.id}
                  type="button"
                  disabled={prize.soldOut || busy}
                  onClick={() => setPicked(prize.id)}
                  aria-pressed={active}
                  className={`rounded-card overflow-hidden border-2 text-start transition-colors disabled:opacity-40 ${
                    active ? "border-primary" : "border-border"
                  }`}
                >
                  <span className="bg-primary-soft block aspect-[8/5] w-full">
                    {prize.imageUrl ? (
                      <Image
                        src={prize.imageUrl}
                        alt={prize.label}
                        width={320}
                        height={200}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <PrizeArt kind={prize.kind} className="h-full w-full" />
                    )}
                  </span>
                  <span className="block px-1.5 py-1.5 text-[11px] leading-tight font-bold">
                    {prize.soldOut ? "كملت" : prize.label}
                  </span>
                </button>
              );
            })}
          </div>

          {error && (
            <p role="alert" className="text-danger mt-3 text-sm font-bold">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={busy || !picked}
            onClick={enter}
            className="bg-accent rounded-input mt-4 flex w-full items-center justify-center gap-2 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Trophy className="size-4" strokeWidth={2.6} />
            {busy ? "…" : "ندخل السباق"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setInvite(null)}
            className="text-dim hover:text-primary mt-2 w-full py-2 text-sm font-bold transition-colors"
          >
            ماشي دروك
          </button>
        </>
      )}
    </Modal>
  );
}
