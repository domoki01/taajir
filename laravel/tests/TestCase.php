<?php

namespace Tests;

use App\Services\Geo;
use App\Services\Taxonomy;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Geo holds the 69-row wilaya table for the life of the process, which
        // is one request in production and the whole suite here. A test that
        // reseeds would otherwise read the previous test's rows.
        Geo::forget();
        Taxonomy::forget();
    }
}
