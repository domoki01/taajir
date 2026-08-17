"use client";

// ── THE RACE, FROM THE ENTRANT'S SIDE ────────────────────────────────────────
// Three states, in the order somebody meets them: choose a prize, collect
// points, claim. Each screen shows exactly one thing to do next — a page that
// offers a leaderboard, four missions and a prize shelf at once to somebody who
// has not entered yet is a page nobody enters from.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle2,
  ExternalLink,
  Gift,
  Lock,
  PartyPopper,
  Timer,
} from "lucide-react";
import {
  claimMission,
  claimPrize,
  joinCampaign,
  startMission,
} from "@/server/actions/affiliate";
import { PrizeArt } from "@/components/affiliate/PrizeArt";
import type { CampaignPrize, Entrant } from "@/types/affiliate";

/**
 * A mission as the browser is allowed to see it.
 *
 * `answer` is deliberately absent. The whole value of the question is that it
 * can only be read on the destination page, and a props object is public: it
 * ships inside the RSC payload, where "view source" is enough to read it.
 */
export type PublicMission = {
  id: string;
  label: string;
  points: number;
  dwellSeconds: number;
  hasAnswer: boolean;
  done: boolean;
};

function clock(ms: number): string {
  if (ms <= 0) return "سالات";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (days > 0) return `${days} يوم و${hours} سا`;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** The card face: an uploaded photo when there is one, the drawn card otherwise. */
function PrizeFace({ prize }: { prize: CampaignPrize }) {
  if (prize.imageUrl) {
    return (
      <Image
        src={prize.imageUrl}
        alt={prize.label}
        width={320}
        height={200}
        className="h-full w-full object-cover"
        unoptimized
      />
    );
  }
  return <PrizeArt kind={prize.kind} className="h-full w-full" />;
}

export function ContestBoard({
  campaignName,
  endsAt,
  serverNow,
  threshold,
  winners,
  prizes,
  missions,
  entry,
  publishCount,
  signedIn,
}: {
  campaignName: string;
  endsAt: number;
  /** Read on the server; the countdown takes over from here on the client. */
  serverNow: number;
  threshold: number;
  winners: number;
  prizes: CampaignPrize[];
  missions: PublicMission[];
  entry: Entrant | null;
  publishCount: number;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(entry?.prizeId ?? null);

  // Mission in progress: the id, and when its dwell is satisfied.
  const [open, setOpen] = useState<{ id: string; readyAt: number } | null>(
    null,
  );
  const [answer, setAnswer] = useState("");
  const [tick, setTick] = useState(serverNow);
  const [destination, setDestination] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const points = entry?.points ?? 0;
  const unlocked = points >= threshold;
  const claimed = !!entry?.claimedAt;
  const left = Math.max(0, endsAt - tick);
  const claimedTotal = prizes.reduce((sum, p) => sum + p.claimed, 0);
  const seatsLeft = Math.max(0, winners - claimedTotal);

  function run(
    work: () => Promise<{ ok: boolean; error?: string; message?: string }>,
  ) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await work();
      if (res.ok) {
        setMessage(res.message ?? "تمّ");
        router.refresh();
      } else {
        setError(res.error ?? "ما نجحش");
      }
    });
  }

  function begin(missionId: string) {
    setError(null);
    setMessage(null);
    // The tab is opened before awaiting anything. A window.open() that happens
    // after a round trip has lost its user-gesture and every phone browser
    // blocks it as a pop-up — which looks, from the outside, exactly like a
    // mission button that does nothing.
    const tab = window.open("", "_blank", "noopener,noreferrer");
    startTransition(async () => {
      const res = await startMission(missionId);
      if (!res.ok) {
        tab?.close();
        setError(res.error);
        return;
      }
      if (tab) tab.location.href = res.url;
      else window.location.href = res.url;
      setOpen({ id: missionId, readyAt: Date.now() + res.seconds * 1000 });
      setAnswer("");
    });
  }

  // ── NOT SIGNED IN ─────────────────────────────────────────────────────────
  if (!signedIn) {
    return (
      <Link
        href="/connexion?next=%2Fconcours"
        className="bg-accent rounded-input mt-6 block py-3.5 text-center text-sm font-bold text-white transition-opacity hover:opacity-90"
      >
        سجّل دخولك وادخل السباق
      </Link>
    );
  }

  return (
    <div className="mt-6">
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

      {/* ── THE CLOCK ────────────────────────────────────────────────────── */}
      <div className="rounded-card border-border bg-surface flex items-center gap-3 border p-3.5">
        <Timer className="text-primary size-5 shrink-0" />
        <span className="text-sm font-bold">باقي على النهاية</span>
        <span className="text-primary ltr-nums ms-auto text-lg font-black">
          {clock(left)}
        </span>
      </div>

      {/* ── PICK A PRIZE ─────────────────────────────────────────────────── */}
      {!entry && (
        <div className="mt-4">
          <p className="text-sm font-extrabold">اختار الجائزة اللي تحبها</p>
          <p className="text-dim mt-1 text-xs leading-relaxed">
            اختيارك يبان في صفحتك، وتقدر تبدّلو حتى توصل للهدف. باقي{" "}
            <span className="ltr-nums">{seatsLeft}</span> جائزة في هذه المسابقة.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {prizes.map((prize) => {
              const out = prize.claimed >= prize.stock;
              const on = picked === prize.id;
              return (
                <button
                  key={prize.id}
                  type="button"
                  disabled={out || pending}
                  onClick={() => setPicked(prize.id)}
                  className={`rounded-card overflow-hidden border text-start transition-all disabled:opacity-40 ${
                    on
                      ? "border-primary shadow-lifted scale-[1.01]"
                      : "border-border hover:border-primary"
                  }`}
                >
                  <span className="bg-surface-soft block h-32 w-full overflow-hidden">
                    <PrizeFace prize={prize} />
                  </span>
                  <span className="bg-surface block p-3">
                    <span className="block text-sm font-bold">
                      {prize.label}
                    </span>
                    {prize.detail && (
                      <span className="text-dim block text-xs">
                        {prize.detail}
                      </span>
                    )}
                    <span
                      className={`ltr-nums mt-1 block text-xs font-bold ${
                        out ? "text-danger" : "text-primary"
                      }`}
                    >
                      {out
                        ? "كملت"
                        : `باقي ${prize.stock - prize.claimed} من ${prize.stock}`}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={!picked || pending}
            onClick={() => run(() => joinCampaign(picked!))}
            className="bg-accent rounded-input mt-4 w-full py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending ? "راه يدخّلك…" : "ادخل السباق"}
          </button>
        </div>
      )}

      {/* ── THE BAR ──────────────────────────────────────────────────────── */}
      {entry && (
        <div className="rounded-card border-primary bg-primary-soft mt-4 border p-4">
          <div className="flex items-center gap-3">
            <span className="bg-surface size-16 shrink-0 overflow-hidden rounded-[12px]">
              {prizes.find((p) => p.id === entry.prizeId) ? (
                <PrizeFace
                  prize={prizes.find((p) => p.id === entry.prizeId)!}
                />
              ) : (
                <PrizeArt kind="custom" className="h-full w-full" />
              )}
            </span>
            <span className="min-w-0">
              <span className="text-dim block text-xs font-bold">
                راك تجري على
              </span>
              <span className="block truncate text-sm font-extrabold">
                {prizes.find((p) => p.id === entry.prizeId)?.label ?? "جائزة"}
              </span>
            </span>
            <span className="ms-auto text-end">
              <span className="text-primary ltr-nums block text-2xl font-black">
                {points}
              </span>
              <span className="text-dim ltr-nums block text-xs font-bold">
                / {threshold}
              </span>
            </span>
          </div>

          <div className="bg-surface mt-3 h-2.5 w-full overflow-hidden rounded-full">
            <div
              className={`h-full rounded-full transition-all ${
                unlocked ? "bg-success" : "bg-primary"
              }`}
              style={{
                width: `${Math.min(100, (points / Math.max(1, threshold)) * 100)}%`,
              }}
            />
          </div>

          {claimed ? (
            <p className="text-success mt-3 flex items-center gap-2 text-sm font-bold">
              <PartyPopper className="size-4" />
              طلبت جائزتك. المشرف يراجع ويبعثلك.
            </p>
          ) : unlocked ? (
            <div className="mt-3">
              <p className="text-success flex items-center gap-2 text-sm font-extrabold">
                <Gift className="size-4" />
                وصلت للهدف! افتح جائزتك دروك.
              </p>
              <label className="mt-2 block text-xs font-bold">
                وين نبعثولك؟ (معرّف Binance، حساب Google، ولا رقم BaridiMob)
                <input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  maxLength={60}
                  dir="ltr"
                  className="rounded-input border-border focus:border-primary ltr-nums mt-1 w-full border bg-white px-3 py-2.5 text-sm outline-none"
                />
              </label>
              <button
                type="button"
                disabled={pending || seatsLeft === 0}
                onClick={() => run(() => claimPrize(destination))}
                className="bg-accent rounded-input mt-2 w-full py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {seatsLeft === 0 ? "الجوائز كملو" : "افتح الجائزة 🎁"}
              </button>
            </div>
          ) : (
            <p className="text-muted mt-3 text-xs leading-relaxed font-semibold">
              باقي <span className="ltr-nums">{threshold - points}</span> نقطة
              باش تفتح{" "}
              <b>{prizes.find((p) => p.id === entry.prizeId)?.label}</b>. انشر
              إعلان، ادعُ أصحابك، ولا كمّل المهامّ تحت.
            </p>
          )}
        </div>
      )}

      {/* ── MISSIONS ─────────────────────────────────────────────────────── */}
      {entry && missions.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-extrabold">مهامّ سريعة</p>

          {publishCount < 1 ? (
            <p className="rounded-input bg-warning/10 text-warning mt-2 px-4 py-3 text-xs leading-relaxed font-bold">
              <Lock className="me-1 inline size-3.5" />
              المهامّ تتحلّ بعد ما تنشر إعلان ولا طلب ويتقبل. هكذا نضمنو أنّ
              النقاط تروح للناس اللي يخدمو مع الموقع بصح.
            </p>
          ) : (
            <p className="text-dim mt-1 text-xs leading-relaxed">
              حلّ الرابط، أقعد فيه شوية، وارجع اطلب نقاطك. كل مهمّة تتحسب مرّة
              وحدة برك.
            </p>
          )}

          <div className="mt-3 grid gap-2">
            {missions.map((mission) => {
              const active = open?.id === mission.id;
              const waitLeft = active ? Math.max(0, open!.readyAt - tick) : 0;
              const ready = active && waitLeft === 0;
              return (
                <div
                  key={mission.id}
                  className="rounded-card border-border bg-surface border p-3.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">
                        {mission.label}
                      </span>
                      <span className="text-dim ltr-nums block text-xs font-semibold">
                        +{mission.points} نقطة · {mission.dwellSeconds} ثانية
                        {mission.hasAnswer ? " · فيها سؤال" : ""}
                      </span>
                    </span>

                    {mission.done ? (
                      <span className="text-success ms-auto flex shrink-0 items-center gap-1 text-xs font-bold">
                        <CheckCircle2 className="size-4" />
                        كمّلتها
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={pending || publishCount < 1}
                        onClick={() => begin(mission.id)}
                        className="rounded-input border-primary text-primary hover:bg-primary-soft ms-auto flex shrink-0 items-center gap-1.5 border px-3 py-2 text-xs font-bold transition-colors disabled:opacity-40"
                      >
                        <ExternalLink className="size-3.5" />
                        {active ? "عاود حلّو" : "حلّ الرابط"}
                      </button>
                    )}
                  </div>

                  {active && !mission.done && (
                    <div className="border-border mt-3 border-t pt-3">
                      {!ready ? (
                        <p className="text-muted ltr-nums text-center text-sm font-bold">
                          استنّى {Math.ceil(waitLeft / 1000)} ثانية…
                        </p>
                      ) : (
                        <>
                          {mission.hasAnswer && (
                            <label className="block text-xs font-bold">
                              اكتب الكلمة اللي لقيتها في الصفحة
                              <input
                                value={answer}
                                onChange={(e) => setAnswer(e.target.value)}
                                maxLength={40}
                                className="rounded-input border-border focus:border-primary mt-1 w-full border bg-white px-3 py-2.5 text-sm outline-none"
                              />
                            </label>
                          )}
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              run(() => claimMission(mission.id, answer))
                            }
                            className="bg-accent rounded-input mt-2 w-full py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            خوذ +{mission.points} نقطة
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Shown to an entrant so the shelf stays visible after joining — the
          prize is the reason to come back, and hiding it behind the entry
          would make the page after joining feel emptier than the one before. */}
      {entry && !claimed && (
        <p className="text-dim mt-4 text-center text-xs font-semibold">
          هذه المسابقة: {campaignName} · باقي{" "}
          <span className="ltr-nums">{seatsLeft}</span> جائزة
        </p>
      )}
    </div>
  );
}
