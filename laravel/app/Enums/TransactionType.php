<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Kind of deal.
 *
 * Ported from kTransactionTypes in src/lib/enums.ts. The slugs are Latin and
 * stable — they are the first segment of every browse URL
 * (`/vente/appartement/alger`), so they are part of the contract with Google.
 *
 * Admins can hide, rename and add deals from /admin/filtre, which is why the
 * column that stores one is a VARCHAR and not an ENUM. These four are the
 * built-ins; the live taxonomy arrives in phase 2 and supersedes this list as
 * the source of what the menus offer.
 */
enum TransactionType: string
{
    case Vente = 'vente';
    case Location = 'location';
    // Nightly/holiday rental is a genuinely separate market in the coastal
    // wilayas, with its own price unit — not a variant of monthly rent.
    case Vacances = 'vacances';
    case Echange = 'echange';

    public function label(): string
    {
        return match ($this) {
            self::Vente => 'بيع',
            self::Location => 'كراء',
            self::Vacances => 'كراء بالليلة',
            self::Echange => 'مبادلة',
        };
    }

    /**
     * The same four deals, worded for someone searching rather than posting.
     *
     * A buyer and a seller are on opposite sides of one set of ads, so "شراء" is
     * not a filter value — filtering by it would ask for ads that do not exist.
     * It is named in the label because that is the word a buyer looks for.
     */
    public function filterLabel(): string
    {
        return match ($this) {
            self::Vente => 'للبيع / شراء',
            self::Location => 'للكراء',
            self::Vacances => 'كراء بالليلة',
            self::Echange => 'مبادلة',
        };
    }

    /**
     * The one code-level fact each deal carries: how its price is expressed.
     *
     * Everything else about a transaction type is a label. This is not — it
     * decides the unit shown next to the price, and through PriceUnit::isRental()
     * which scale the price is read on. Splitting it out as data is what lets an
     * admin add a deal at all: a new type declares its unit, and the rest of the
     * code stops needing to have heard of it.
     */
    public function defaultPriceUnit(): PriceUnit
    {
        return match ($this) {
            self::Vente => PriceUnit::Total,
            self::Location => PriceUnit::Mois,
            self::Vacances => PriceUnit::Nuit,
            self::Echange => PriceUnit::Total,
        };
    }
}
