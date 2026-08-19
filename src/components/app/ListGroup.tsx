import Link from "next/link";
import { ChevronLeft, type LucideIcon } from "lucide-react";

// ── THE GROUPED LIST ─────────────────────────────────────────────────────────
// The pattern every phone app uses for an account screen, a settings screen and
// any menu with more than four destinations: full-width rows in a rounded card,
// hairline dividers between them, a tinted icon square at the start and a
// chevron at the end.
//
// It replaces two things that made this site read as a web page. A wrapping row
// of identical pills — thirteen of them in the admin, six in the dashboard —
// which no app has ever shown anybody, and a desktop sidebar, which is furniture
// from a different kind of software entirely.
//
// Why it works where the pills did not: a row is the full width of the thumb, it
// carries an icon to find it by and a chevron that says "this leads somewhere",
// and the group heading answers *what kind of thing* is in the list before any
// label is read. The eye lands in a neighbourhood, then on a row.

export function ListGroup({
  title,
  footnote,
  children,
}: {
  title?: string;
  footnote?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 first:mt-0">
      {title && (
        <h2 className="text-dim mb-2 px-1 text-xs font-extrabold">{title}</h2>
      )}
      <div className="rounded-card border-border bg-surface overflow-hidden border">
        {children}
      </div>
      {footnote && (
        <p className="text-dim mt-2 px-1 text-xs leading-relaxed">{footnote}</p>
      )}
    </section>
  );
}

type RowProps = {
  icon: LucideIcon;
  label: string;
  hint?: string;
  /** Right-hand value: a count, a state, a phone number. */
  value?: string;
  /** Colour for the icon square. Defaults to the navy structural tint. */
  tone?: "primary" | "success" | "warning" | "danger";
  href?: string;
};

const kTones: Record<NonNullable<RowProps["tone"]>, string> = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/10 text-danger",
};

/**
 * One row.
 *
 * `min-h-14` is not decoration: it is the floor for a target somebody hits with
 * a thumb while walking. The divider is drawn by the row rather than the group
 * so the first one has none, which is what stops the card looking like a table.
 */
export function ListRow({
  icon: Icon,
  label,
  hint,
  value,
  tone = "primary",
  href,
}: RowProps) {
  const inner = (
    <>
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-[10px] ${kTones[tone]}`}
      >
        <Icon className="size-[18px]" strokeWidth={2.3} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{label}</span>
        {hint && (
          <span className="text-dim block truncate text-xs font-semibold">
            {hint}
          </span>
        )}
      </span>
      {value && (
        <span className="text-muted ltr-nums shrink-0 text-sm font-bold">
          {value}
        </span>
      )}
      {href && (
        <ChevronLeft className="text-dim size-4 shrink-0" strokeWidth={2.6} />
      )}
    </>
  );

  const className =
    "border-border flex min-h-14 w-full items-center gap-3 border-t px-4 py-3 text-start transition-colors first:border-t-0 active:bg-surface-soft md:hover:bg-surface-soft";

  return href ? (
    <Link href={href} className={className}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}
