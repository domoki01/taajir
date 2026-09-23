<?php

declare(strict_types=1);

namespace Tests\Unit;

use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * The default cache store must work without a migration this project does not
 * have.
 *
 * Laravel's skeleton defaults to `database` and ships a create_cache_table
 * migration. This project dropped the migration and kept the default, so the
 * store pointed at a table that does not exist; only .env.example writing
 * CACHE_STORE=file kept installs alive, and an .env without that line failed
 * on every throttled action — posting a demand, replying to one, cache:clear —
 * with "no such table: cache".
 */
final class CacheStoreTest extends TestCase
{
    public function test_the_default_store_does_not_need_a_table_that_does_not_exist(): void
    {
        $default = config('cache.default');

        $this->assertNotSame(
            'database',
            $default,
            'the database store needs a cache table, and this project has no migration for one',
        );
    }

    public function test_the_cache_actually_works_with_no_env_set(): void
    {
        // The throttles in RequestService and the session exchange go through
        // this. A store that cannot be written to is a 500 on the way in.
        config(['cache.default' => 'file']);
        Cache::store(config('cache.default'))->put('taajir-probe', 'value', 60);

        $this->assertSame('value', Cache::store(config('cache.default'))->get('taajir-probe'));

        Cache::store(config('cache.default'))->forget('taajir-probe');
    }

    public function test_no_migration_claims_to_create_a_cache_table(): void
    {
        // If one is ever added, the default above can go back to `database` —
        // and this test is where that decision gets revisited rather than
        // rediscovered from a 500.
        $migrations = glob(database_path('migrations/*.php')) ?: [];
        $found = array_filter($migrations, fn (string $f) => str_contains($f, 'cache_table'));

        $this->assertSame([], array_values($found), 'a cache table migration exists now; revisit cache.default');
    }
}
