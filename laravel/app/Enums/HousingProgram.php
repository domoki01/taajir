<?php

declare(strict_types=1);

namespace App\Enums;

enum HousingProgram: string
{
    case Prive = 'prive';
    case Promotionnel = 'promotionnel';
    case Aadl = 'aadl';
    case Lpp = 'lpp';
    case Lpa = 'lpa';
    case Lsp = 'lsp';
    case Social = 'social';

    public function label(): string
    {
        return __('listing.housing_programs.'.$this->value);
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
