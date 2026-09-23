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
     * Both of these are source rather than user data: the 69 wilayas and their
     * 1541 communes, without which nothing resolves a URL, and the four
     * built-in roles, without which nobody can be anything but a visitor.
     */
    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            GeographySeeder::class,
        ]);
    }
}
