<?php

declare(strict_types=1);

namespace App\Enums;

enum Amenity: string
{
    case Ascenseur = 'ascenseur';
    case Garage = 'garage';
    case Jardin = 'jardin';
    case Terrasse = 'terrasse';
    case Meuble = 'meuble';
    case Chauffage = 'chauffage';
    case Climatisation = 'climatisation';
    case ChauffeEau = 'chauffe-eau';
    case Bache = 'bache';
    case Securite = 'securite';
    case VueMer = 'vue-mer';
    case Piscine = 'piscine';
    case Cave = 'cave';
    case Fibre = 'fibre';
    case ProcheTram = 'proche-tram';
    case ProcheEcole = 'proche-ecole';
    case ProcheCommerces = 'proche-commerces';

    public function label(): string
    {
        return __('listing.amenities.'.$this->value);
    }

    /** @return array<string, string> slug => label, in declaration order */
    public static function labels(): array
    {
        $out = [];
        foreach (self::cases() as $case) {
            $out[$case->value] = $case->label();
        }

        return $out;
    }
}
