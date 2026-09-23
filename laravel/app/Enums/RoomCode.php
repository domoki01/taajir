<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Rooms use the Algerian F-nomenclature, where the number counts living rooms
 * plus bedrooms — an F3 has two bedrooms and a salon. Nobody here searches for
 * "2 bedrooms", so this is the primary control in the filter UI.
 */
enum RoomCode: string
{
    case F1 = 'F1';
    case F2 = 'F2';
    case F3 = 'F3';
    case F4 = 'F4';
    case F5 = 'F5';
    case F6 = 'F6';
    case F7Plus = 'F7+';

    public function label(): string
    {
        return $this === self::F7Plus ? __('listing.rooms_f7_plus') : $this->value;
    }
}
