import type { Metadata } from "next";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Container } from "@/components/layout/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { getUser } from "@/server/auth";
import { liveCampaign, myStanding, standings } from "@/server/affiliate";

export const metadata: Metadata = {
  title: "المسابقة",
  description: "ترتيب أكثر واحد دعا ناس للمنصّة، والجائزة.",
};

// The leaderboard is the page people refresh, so it is never served stale.
export const dynamic = "force-dynamic";

function remaining(endsAt: number): string {
  const ms = endsAt - Date.now();
  if (ms <= 0) return "سالات";
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `باقي ${days} يوم`;
  const hours = Math.max(1, Math.floor(ms / 3600000));
  return `باقي ${hours} ساعة`;
}

/**
 * The race.
 *
 * Public and unauthenticated on purpose: the leaderboard is the advertisement.
 * Someone who lands on it from a WhatsApp forward should see the prize and the
 * names before being asked to sign in for anything.
 */
export default async function ContestPage() {
  const campaign = await liveCampaign();
  const user = await getUser();

  if (!campaign) {
    return (
      <>
        <Header />
        <main className="flex-1 py-10">
          <Container className="max-w-lg">
            <EmptyState
              title="ما كاش مسابقة دروك"
              body="كي نطلقو وحدة جديدة تلقاها هنا. في الأثناء، رابط الدعوة تاعك يخدم ويجمعلك نقاط."
            />
            <Link
              href="/tableau-de-bord/parrainage"
              className="bg-accent rounded-input mt-4 block py-3.5 text-center text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              ادعُ أصحابك
            </Link>
          </Container>
        </main>
      </>
    );
  }

  const board = await standings(campaign.id);
  const mine = user ? await myStanding(campaign.id, user.uid) : null;
  // Shown only when the visitor is not already on the visible board — repeating
  // their row under a list they are in reads as a bug, not as encouragement.
  const onBoard = board.some((e) => e.uid === user?.uid);

  return (
    <>
      <Header />
      <main className="flex-1 py-8">
        <Container className="max-w-xl">
          <div className="rounded-card border-primary bg-primary-soft border p-5 text-center">
            <span className="text-primary mx-auto grid size-14 place-items-center rounded-full bg-white">
              <Trophy className="size-7" strokeWidth={2.2} />
            </span>
            <h1 className="mt-3 text-2xl font-black">{campaign.name}</h1>
            <p className="text-primary mt-2 text-lg font-extrabold">
              {campaign.prize}
            </p>
            <p className="text-muted ltr-nums mt-1 text-sm font-semibold">
              {remaining(campaign.endsAt)} —{" "}
              {campaign.winners === 1
                ? "الأوّل يربح"
                : `الأوائل ${campaign.winners} يربحو`}
            </p>
          </div>

          <p className="text-muted mt-4 text-center text-sm leading-relaxed font-semibold">
            الدعوة تتحسب كي يسجّل صاحبك برابطك وينشر إعلان ولا طلب ويتقبل. كي
            يتعادلو زوج، الأسبق يفوز.
          </p>

          {board.length === 0 ? (
            <p className="rounded-card border-border bg-surface text-muted mt-5 border p-6 text-center text-sm leading-relaxed font-semibold">
              ما زال حتى واحد ما بدا. أوّل دعوة تحطّك في راس القائمة.
            </p>
          ) : (
            <ol className="rounded-card border-border bg-surface mt-5 divide-y divide-[var(--color-border)] border">
              {board.map((entrant, index) => (
                <li
                  key={entrant.uid}
                  className={`flex items-center gap-3 p-3.5 ${
                    entrant.uid === user?.uid ? "bg-primary-soft" : ""
                  }`}
                >
                  <span
                    className={`ltr-nums grid size-8 shrink-0 place-items-center rounded-full text-sm font-black ${
                      index < campaign.winners
                        ? "bg-primary text-white"
                        : "bg-surface-soft text-dim"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="truncate text-sm font-bold">
                    {entrant.displayName}
                  </span>
                  <span className="text-primary ltr-nums ms-auto shrink-0 text-sm font-black">
                    {entrant.count}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {mine && mine.rank !== null && !onBoard && (
            <p className="rounded-card border-primary bg-surface ltr-nums mt-3 border p-3.5 text-center text-sm font-black">
              ترتيبك {mine.rank} بـ{mine.count} دعوة
            </p>
          )}

          <Link
            href="/tableau-de-bord/parrainage"
            className="bg-accent rounded-input mt-5 block py-3.5 text-center text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            جيب رابط الدعوة تاعك
          </Link>
        </Container>
      </main>
    </>
  );
}
