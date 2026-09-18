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
     * Geography is the only thing seeded unconditionally: the 69 wilayas and
     * their 1541 communes are source, not user data, and nothing resolves a URL
     * without them.
     */
    public function run(): void
    {
        $this->call(GeographySeeder::class);
    }
}
