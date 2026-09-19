<?php

declare(strict_types=1);

namespace App\Enums;

enum SaleForm: string
{
    case Definitif = 'definitif';
    case Vsp = 'vsp';
    case Promotionnel = 'promotionnel';
    case Encheres = 'encheres';

    public function label(): string
    {
        return __('listing.sale_forms.'.$this->value);
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
