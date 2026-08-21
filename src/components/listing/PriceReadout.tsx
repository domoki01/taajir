import { formatPriceExact, toDinars, type PriceInputUnit } from "@/lib/price";

/**
 * What the number in the price field actually means.
 *
 * "800" under مليون and "800" under دج are the same three keystrokes and a
 * 10 000x difference in what gets stored. Nothing downstream can tell the two
 * apart — both are a valid price for something — so the only person who can
 * catch the slip is the one who typed it, and only if they are shown the figure
 * they are about to publish rather than the one they typed.
 *
 * Shared between the publish wizard and the edit form on purpose: the two rows
 * are the same row, and a guard that exists on one of them is a guard the other
 * one silently does without.
 */
export function PriceReadout({
  amount,
  unit,
  /** True while «لا تعرض السعر» is ticked — there is no figure to confirm. */
  hidden,
}: {
  amount: string;
  unit: PriceInputUnit;
  hidden: boolean;
}) {
  const typed = Number(amount);
  if (hidden || !Number.isFinite(typed) || typed <= 0) return null;

  return (
    <p className="text-muted mt-2 text-sm font-semibold">
      يعني{" "}
      <span className="text-primary ltr-nums font-black">
        {formatPriceExact(toDinars(typed, unit))}
      </span>
    </p>
  );
}
