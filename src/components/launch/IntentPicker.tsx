import Link from "next/link";
import { Home, KeyRound, Search } from "lucide-react";

/**
 * "ما هي غايتك العقارية اليوم؟" — the one question the pre-launch page asks.
 *
 * Each answer routes into a form the site already has rather than a parallel
 * one built for the funnel: /publier carries the validation, the quota, the
 * slug generation and the image upload, and a second copy of all that would be
 * two code paths to keep in step long after the launch is over.
 */
const kIntents = [
  {
    href: "/publier?deal=vente",
    label: "حاب نبيع",
    note: "دار، شقة، أرض ولا محل",
    Icon: Home,
  },
  {
    href: "/publier?deal=location",
    label: "حاب نكري",
    note: "شهري، سنوي ولا بالليلة",
    Icon: KeyRound,
  },
  {
    href: "/demandes?composer=1",
    label: "حاب نشري",
    note: "قول واش تحوّس عليه",
    Icon: Search,
  },
] as const;

export function IntentPicker() {
  return (
    <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-3">
      {kIntents.map(({ href, label, note, Icon }) => (
        <Link
          key={href}
          href={href}
          className="rounded-card border-border bg-surface hover:border-primary shadow-soft flex items-center gap-3 border p-4 text-start transition-colors sm:flex-col sm:items-start sm:p-5"
        >
          <span className="bg-primary-soft text-primary grid size-11 shrink-0 place-items-center rounded-full">
            <Icon className="size-5" strokeWidth={2.4} />
          </span>
          <span>
            <span className="block font-extrabold">{label}</span>
            <span className="text-dim mt-0.5 block text-xs">{note}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
