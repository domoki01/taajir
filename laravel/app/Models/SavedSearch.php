<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SavedSearch extends Model
{
    public const UPDATED_AT = null;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['notify' => 'boolean', 'created_at' => 'datetime', 'last_notified_at' => 'datetime'];
    }

    /** The filters this search stands for, in the shape ListingQuery takes. */
    public function filters(): array
    {
        return array_filter([
            'transaction' => $this->transaction_type,
            'type' => $this->property_type,
            'wilaya' => $this->wilaya_slug,
            'commune' => $this->commune_slug,
        ]);
    }
}
