import type { Metadata } from "next";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Container } from "@/components/layout/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { getUser } from "@/server/auth";
import { adminDb } from "@/lib/firebase/admin";
import {
  liveCampaign,
  myEntry,
  myStanding,
  myVisits,
  serverNow,
  standings,
} from "@/server/affiliate";
import {
  ContestBoard,
  type PublicMission,
} from "@/components/affiliate/ContestBoard";

export const metadata: Metadata = {
  title: "المسابقة",
  description: "اجمع النقاط، افتح جائزتك، وشوف ترتيبك بين المشاركين.",
};

// The leaderboard is the page people refresh, so it is never served stale.
export const dynamic = "force-dynamic";

/**
 * The race.
 *
 * Public and unauthenticated on purpose: the leaderboard and the prize shelf
 * are the advertisement. Someone who lands here from a WhatsApp forward should
 * see what is on offer and who is winning before being asked to sign in.
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

  const [board, entry, visits, mine] = await Promise.all([
    standings(campaign.id),
    user ? myEntry(campaign.id, user.uid) : null,
    user
      ? myVisits(campaign.id, user.uid)
      : ({} as Awaited<ReturnType<typeof myVisits>>),
    user ? myStanding(campaign.id, user.uid) : null,
  ]);

  // The publish gate on missions, read once here so the board can explain it
  // rather than only refusing.
  const account = user
    ? (await adminDb().collection("users").doc(user.uid).get()).data()
    : null;

  // `answer` never leaves the server. It is the only thing on the campaign
  // document that is a secret, and props ship inside the RSC payload where
  // "view source" reads them.
  const missions: PublicMission[] = (campaign.links ?? [])
    .filter((link) => link.active)
    .map((link) => ({
      id: link.id,
      label: link.label,
      points: link.points,
      dwellSeconds: link.dwellSeconds,
      hasAnswer: !!link.answer,
      done: !!visits[link.id]?.claimedAt,
    }));

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
              اجمع {campaign.prizeThreshold} نقطة وافتح جائزتك
            </p>
          </div>

          <ContestBoard
            campaignName={campaign.name}
            endsAt={campaign.endsAt}
            serverNow={serverNow()}
            threshold={campaign.prizeThreshold}
            winners={campaign.winners}
            prizes={campaign.prizes ?? []}
            missions={missions}
            entry={entry}
            publishCount={(account?.publishCount as number) ?? 0}
            signedIn={!!user}
          />

          {/* ── HOW POINTS ARRIVE ──────────────────────────────────────────── */}
          <div className="rounded-card border-border bg-surface mt-4 border p-4">
            <p className="text-sm font-extrabold">كيفاش تجمع النقاط</p>
            <ul className="text-muted mt-2 space-y-1.5 text-sm leading-relaxed font-semibold">
              <li>• انشر إعلان ولا طلب ويتقبل</li>
              <li>• ادعُ صاحبك برابطك، وكي ينشر تربح</li>
              <li>• كمّل المهامّ السريعة فوق</li>
            </ul>
            <p className="text-dim mt-3 text-xs leading-relaxed">
              كل نقطة عندها سبب مكتوب في «حركة النقاط» في صفحتك. الحسابات
              الوهمية تتشطب من السباق وترجع نقاطها.
            </p>
          </div>

          {/* ── THE BOARD ──────────────────────────────────────────────────── */}
          <p className="mt-6 text-sm font-extrabold">الترتيب</p>
          {board.length === 0 ? (
            <p className="rounded-card border-border bg-surface text-muted mt-2 border p-6 text-center text-sm leading-relaxed font-semibold">
              ما زال حتى واحد ما بدا. أوّل نقطة تحطّك في راس القائمة.
            </p>
          ) : (
            <ol className="rounded-card border-border bg-surface mt-2 divide-y divide-[var(--color-border)] border">
              {board.map((entrant, index) => (
                <li
                  key={entrant.uid}
                  className={`flex items-center gap-3 p-3.5 ${
                    entrant.uid === user?.uid ? "bg-primary-soft" : ""
                  }`}
                >
                  <span
                    className={`ltr-nums grid size-8 shrink-0 place-items-center rounded-full text-sm font-black ${
                      entrant.unlockedAt
                        ? "bg-success text-white"
                        : index < 3
                          ? "bg-primary text-white"
                          : "bg-surface-soft text-dim"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">
                      {entrant.displayName}
                    </span>
                    {entrant.unlockedAt && (
                      <span className="text-success block text-xs font-bold">
                        فتح جائزتو
                      </span>
                    )}
                  </span>
                  <span className="text-primary ltr-nums ms-auto shrink-0 text-sm font-black">
                    {entrant.points ?? 0}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {mine && mine.rank !== null && !onBoard && (
            <p className="rounded-card border-primary bg-surface ltr-nums mt-3 border p-3.5 text-center text-sm font-black">
              ترتيبك {mine.rank} بـ{mine.points} نقطة
            </p>
          )}

          <Link
            href="/tableau-de-bord/parrainage"
            className="rounded-input border-primary text-primary hover:bg-primary-soft mt-5 block border py-3.5 text-center text-sm font-bold transition-colors"
          >
            جيب رابط الدعوة تاعك
          </Link>
        </Container>
      </main>
    </>
  );
}
