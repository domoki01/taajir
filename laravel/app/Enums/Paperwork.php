<?php

declare(strict_types=1);

namespace App\Enums;

enum Paperwork: string
{
    case ActeNotarie = 'acte-notarie';
    case LivretFoncier = 'livret-foncier';
    case ActeAdministratif = 'acte-administratif';
    case CahierDesCharges = 'cahier-des-charges';
    case CertificatPossession = 'certificat-possession';
    case PromesseDeVente = 'promesse-de-vente';
    case ActeNonNotarie = 'acte-non-notarie';
    case EnCours = 'en-cours';
    case Aucun = 'aucun';

    public function label(): string
    {
        return __('listing.paperwork.'.$this->value);
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
