<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     *
     * Empty until phase 2, which seeds the 69 wilayas and their communes from
     * `../src/data/geo/` — not from Firestore, because that dataset is committed
     * source rather than user data.
     */
    public function run(): void
    {
        //
    }
}
