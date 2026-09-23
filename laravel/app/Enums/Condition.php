<?php

declare(strict_types=1);

namespace App\Enums;

enum Condition: string
{
    case Neuf = 'neuf';
    case Bon = 'bon';
    case ARenover = 'a-renover';
    case Brut = 'brut';

    public function label(): string
    {
        return __('listing.conditions.'.$this->value);
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
