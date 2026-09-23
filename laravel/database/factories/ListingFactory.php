<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\ListingStatus;
use App\Models\Listing;
use App\Models\User;
use App\Support\ListingId;
use App\Support\ListingSlug;
use App\Support\Text;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Listing> */
class ListingFactory extends Factory
{
    protected $model = Listing::class;

    public function definition(): array
    {
        $transaction = fake()->randomElement(['vente', 'location']);
        $type = fake()->randomElement(['appartement', 'villa', 'maison', 'studio', 'terrain']);
        $wilaya = fake()->randomElement(['alger', 'oran', 'constantine', 'setif', 'blida']);
        $commune = fake()->randomElement(['bab-ezzouar', 'bir-el-djir', 'el-khroub', 'ain-arnat', 'boufarik']);
        $title = 'عقار في '.$commune;

        return [
            'id' => ListingId::mint(),
            'slug' => ListingSlug::build($transaction, $type, 'F3', $commune, $wilaya),
            'owner_uid' => User::factory(),
            'owner_type' => 'individual',
            'owner_name' => fake()->name(),
            'transaction_type' => $transaction,
            'property_type' => $type,
            // Whole dinars. A sale in the millions, a rent in the tens of
            // thousands — the two scales must never be generated alike.
            'price' => $transaction === 'vente'
                ? fake()->numberBetween(300, 2000) * 10_000
                : fake()->numberBetween(2, 12) * 10_000,
            'price_unit' => $transaction === 'vente' ? 'total' : 'mois',
            'area_built' => fake()->numberBetween(45, 300),
            'rooms_code' => fake()->randomElement(['F2', 'F3', 'F4', 'F5']),
            'wilaya_code' => 16,
            'wilaya_slug' => $wilaya,
            'commune_slug' => $commune,
            'title' => $title,
            'description' => fake()->paragraph(),
            'search_text' => Text::normalize($title.' '.$commune.' '.$wilaya),
            'status' => ListingStatus::Published->value,
            'created_at' => now(),
            'published_at' => now(),
        ];
    }

    public function pending(): static
    {
        return $this->state(['status' => ListingStatus::Pending->value, 'published_at' => null]);
    }

    public function featured(): static
    {
        return $this->state(['is_featured' => true]);
    }
}
