<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Promo;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Promo> */
class PromoFactory extends Factory
{
    protected $model = Promo::class;

    public function definition(): array
    {
        return [
            'image_url' => '/storage/promos/'.fake()->lexify('????????????????').'.webp',
            'storage_path' => 'promos/'.fake()->lexify('????????????????').'.webp',
            'width' => 1600,
            'height' => 500,
            'link_url' => '/vente/appartement/alger',
            'title' => 'وكالة '.fake()->lexify('????'),
            'is_active' => true,
            'order' => 0,
        ];
    }
}
