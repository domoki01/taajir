<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * How a price is expressed. Derived from the transaction type.
 *
 * Ported from kPriceUnits in the Next app's src/lib/enums.ts. Keys are Latin
 * and stable — they end up in URLs and database rows. Labels are Arabic and
 * may be reworded freely.
 */
enum PriceUnit: string
{
    case Total = 'total';
    case Mois = 'mois';
    case Annee = 'annee';
    case Nuit = 'nuit';
    case M2 = 'm2';

    public function label(): string
    {
        return match ($this) {
            self::Total => 'السعر الإجمالي',
            self::Mois => 'في الشهر',
            self::Annee => 'في السنة',
            self::Nuit => 'في الليلة',
            self::M2 => 'للمتر المربع',
        };
    }

    /**
     * Does a price in this unit belong on the rent scale?
     *
     * Derived from the unit rather than stored beside it, so "a rental priced as
     * a total" cannot be expressed. A monthly, yearly or nightly price is rent;
     * a total or a per-m² price is a sale. 45 000 DZD is an ordinary month's
     * rent and an absurd sale price, and the two must not share a scale.
     */
    public function isRental(): bool
    {
        return in_array($this, [self::Mois, self::Annee, self::Nuit], true);
    }
}
