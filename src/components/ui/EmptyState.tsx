import Link from "next/link";
import { Inbox, type LucideIcon } from "lucide-react";

/**
 * Nothing here — said the way an app says it.
 *
 * It used to be a dashed rectangle with a magnifying glass in it, which is the
 * visual language of a placeholder somebody has not built yet. On the first
 * screen a new account ever opens, that is the wrong first impression by some
 * distance.
 *
 * A solid card, a softer icon, and — where there is an obvious next step — the
 * button for it. An empty screen that tells you what to do next is a screen;
 * an empty screen that only tells you it is empty is a dead end.
 */
export function EmptyState({
  title,
  body,
  icon: Icon = Inbox,
  action,
}: {
  title: string;
  body?: string;
  icon?: LucideIcon;
  action?: { label: string; href: string };
}) {
  return (
    <div className="rounded-card border-border bg-surface flex flex-col items-center gap-3 border px-6 py-12 text-center">
      <span className="bg-primary-soft text-primary grid size-14 place-items-center rounded-full">
        <Icon className="size-7" strokeWidth={2} />
      </span>
      <p className="text-base font-black">{title}</p>
      {body && (
        <p className="text-muted max-w-sm text-sm leading-relaxed">{body}</p>
      )}
      {action && (
        <Link
          href={action.href}
          className="bg-accent rounded-input mt-1 px-5 py-2.5 text-sm font-bold text-white transition-opacity active:opacity-90"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
