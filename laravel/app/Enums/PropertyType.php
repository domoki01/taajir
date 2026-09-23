<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * What is being sold or rented.
 *
 * Ported from kPropertyTypes in src/lib/enums.ts. The slugs are the second
 * segment of a browse URL (`/vente/appartement/alger`), so they are part of the
 * contract with Google; the labels live in lang/{locale}/taxonomy.php, and an
 * admin can rename, reorder, hide or add to this list — which is why the column that
 * stores one is a VARCHAR and the live list comes from App\Services\Taxonomy
 * rather than from here.
 */
enum PropertyType: string
{
    case Appartement = 'appartement';
    case Villa = 'villa';
    case Maison = 'maison';
    case NiveauVilla = 'niveau-villa';
    case Studio = 'studio';
    case Duplex = 'duplex';
    case Terrain = 'terrain';
    case TerrainAgricole = 'terrain-agricole';
    case Local = 'local';
    case Bureau = 'bureau';
    case Hangar = 'hangar';
    case Garage = 'garage';
    case Immeuble = 'immeuble';

    public function label(): string
    {
        return __('taxonomy.property_types.'.$this->value);
    }

    /** Priced and searched by land area rather than built area. */
    public function isLand(): bool
    {
        return in_array($this, [self::Terrain, self::TerrainAgricole], true);
    }

    /**
     * slug => label, in the order the enum declares them.
     *
     * @return array<string, string>
     */
    public static function labels(): array
    {
        $out = [];
        foreach (self::cases() as $case) {
            $out[$case->value] = $case->label();
        }

        return $out;
    }
}
