<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\User;
use App\Support\ReferralCode;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<User> */
class UserFactory extends Factory
{
    protected $model = User::class;

    public function definition(): array
    {
        return [
            // 28 characters, the shape of a Firebase uid.
            'uid' => Str::random(28),
            'email' => fake()->unique()->safeEmail(),
            'display_name' => fake()->name(),
            'email_verified' => true,
            'role_id' => 'user',
            'approved' => true,
            'listing_quota' => 3,
            'referral_code' => ReferralCode::mint(),
            'created_at' => now(),
            'last_seen_at' => now(),
        ];
    }
}
