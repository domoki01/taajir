import Link from "next/link";
import { kFunnelIntents, funnelHref, funnelSignupHref } from "@/lib/funnel";

/**
 * The four answers. On the funnel page they are the entire page.
 *
 * Each one routes into a form the site already has rather than a parallel one
 * built for the funnel: /publier carries the validation, the quota, the slug
 * generation and the image upload, and a second copy of all that would be two
 * code paths to keep in step long after the launch is over.
 *
 * A signed-out visitor is sent through /inscription with the destination in
 * `next`, so the choice survives the sign-up instead of being asked twice.
 */
export function IntentPicker({ signedIn }: { signedIn: boolean }) {
  return (
    <ul className="mx-auto grid max-w-2xl gap-3 sm:grid-cols-2">
      {kFunnelIntents.map((intent) => (
        <li key={intent.id}>
          <Link
            href={signedIn ? funnelHref(intent) : funnelSignupHref(intent)}
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
