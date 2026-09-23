import Link from "next/link";
import { kFunnelIntents, funnelHref } from "@/lib/funnel";

/**
 * The four answers. On the funnel page they are the entire page.
 *
 * Each one routes into a form the site already has rather than a parallel one
 * built for the funnel: /publier carries the validation, the quota, the slug
 * generation and the image upload, and a second copy of all that would be two
 * code paths to keep in step long after the launch is over.
 *
 * A signed-out visitor goes to the same place a signed-in one does. Routing
 * them through /inscription first meant the answer to "واش تحبّ دير؟" was a
 * registration screen — and, while phone sign-up is switched off, one with
 * fewer ways in than it looks like it has. Both forms now open for anybody and
 * ask for the account at the end, with what was typed still on screen.
 */
export function IntentPicker() {
  return (
    <ul className="mx-auto grid max-w-2xl gap-3 sm:grid-cols-2">
      {kFunnelIntents.map((intent) => (
        <li key={intent.id}>
          <Link
            href={funnelHref(intent)}
            className="rounded-card border-border bg-surface hover:border-primary active:border-primary shadow-soft flex w-full items-center gap-4 border p-5 text-start transition-colors"
          >
            <span className="bg-primary-soft text-primary grid size-12 shrink-0 place-items-center rounded-full">
              <intent.Icon className="size-6" strokeWidth={2.4} />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-extrabold">
                {intent.label}
              </span>
              <span className="text-dim mt-0.5 block text-xs leading-relaxed">
                {intent.note}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
