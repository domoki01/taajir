<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Models\Commune;
use App\Models\Listing;
use App\Models\User;
use App\Models\Wilaya;
use Tests\TestCase;

/**
 * Integer columns must be cast, not trusted.
 *
 * Without a cast, an attribute is whatever the driver returns: SQLite hands
 * back a native int, MySQL hands back a string, because PDO does. Every test
 * here runs on SQLite, so a missing cast is invisible until production — where
 * it surfaced as a 500 on the publish form, Geo::communes(int $wilayaCode)
 * refusing the string MySQL had just returned, under strict_types, on a page
 * that passed every test.
 *
 * These assert through Eloquent's casting rather than through a query: making
 * a model from string attributes reproduces exactly what MySQL delivers, on
 * any driver, which is the only way a SQLite suite can catch this at all.
 */
final class DriverTypesTest extends TestCase
{
    public function test_a_wilaya_code_is_an_int_even_when_the_driver_says_string(): void
    {
        $wilaya = Wilaya::make(['code' => '16', 'code58' => '16', 'commune_count' => '57']);

        $this->assertSame(16, $wilaya->code);
        $this->assertSame(16, $wilaya->code58);
        $this->assertSame(57, $wilaya->commune_count);
    }

    public function test_a_commune_wilaya_code_is_an_int(): void
    {
        $commune = Commune::make(['wilaya_code' => '16']);

        $this->assertSame(16, $commune->wilaya_code);
    }

    /**
     * The money and count columns on a listing, for the same reason.
     *
     * A price compared or formatted as a string is the 10 000× error this
     * project is built to avoid, and it would arrive only on the production
     * driver.
     */
    public function test_listing_numbers_are_numbers(): void
    {
        $listing = Listing::make([
            'price' => '8000000',
            'area_built' => '120',
            'bathrooms' => '2',
            'floor' => '3',
            'wilaya_code' => '16',
            'view_count' => '41',
        ]);

        foreach (['price', 'area_built', 'bathrooms', 'floor', 'wilaya_code', 'view_count'] as $field) {
            $this->assertIsInt($listing->{$field}, "{$field} is not cast; MySQL will hand it over as a string");
        }
    }

    public function test_user_counters_are_numbers(): void
    {
        $user = User::make(['listing_quota' => '3', 'points_balance' => '250']);

        $this->assertIsInt($user->listing_quota);
        $this->assertIsInt($user->points_balance);
    }
}
