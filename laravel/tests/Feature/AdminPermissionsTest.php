<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\Permission;
use App\Models\User;
use App\Services\Geo;
use App\Services\Permissions;
use App\Support\AdminNav;
use Database\Seeders\GeographySeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Phase 7 is done when every permission in §6.2 gates something real.
 *
 * "Real" means two things, and this file checks both: holding the permission
 * alone opens the screen, and not holding it closes the screen to somebody who
 * is otherwise staff. A permission that only gates a menu row gates nothing.
 */
final class AdminPermissionsTest extends TestCase
{
    use RefreshDatabase;

    /**
     * The screen each permission opens, for the ones phase 7 delivers.
     *
     * affiliate.manage is absent on purpose: §11 calls the affiliate
     * programme legitimately optional for v1 and this deployment ships without
     * it, so a route asserted here would be a test that passes by being wrong.
     *
     * @return array<string, array{string, string}>
     */
    public static function screens(): array
    {
        return [
            'listings.moderate' => ['listings.moderate', '/admin/moderation'],
            'requests.moderate' => ['requests.moderate', '/admin/moderation'],
            'comments.moderate' => ['comments.moderate', '/admin/commentaires'],
            'articles.manage' => ['articles.manage', '/admin/articles'],
            'taxonomy.edit' => ['taxonomy.edit', '/admin/filtre'],
            'users.manage' => ['users.manage', '/admin/utilisateurs'],
            'users.approve' => ['users.approve', '/admin/utilisateurs'],
            'roles.manage' => ['roles.manage', '/admin/roles'],
            'promos.manage' => ['promos.manage', '/admin/publicites'],
            'branding.edit' => ['branding.edit', '/admin/identite'],
            'launch.control' => ['launch.control', '/admin/lancement'],
            'push.broadcast' => ['push.broadcast', '/admin/notifications'],
            'audit.view' => ['audit.view', '/admin/journal'],
        ];
    }

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(GeographySeeder::class);
        Geo::forget();
    }

    /** An account holding exactly one permission, and nothing else. */
    private function holderOf(string $permission): User
    {
        $role = 'only-'.str_replace('.', '-', $permission);

        DB::table('roles')->insert([['id' => mb_substr($role, 0, 24), 'label' => $role, 'builtin' => false]]);
        DB::table('role_permissions')->insert([
            ['role_id' => mb_substr($role, 0, 24), 'permission' => $permission],
        ]);
        Permissions::forget();

        return User::factory()->create(['role_id' => mb_substr($role, 0, 24)]);
    }

    #[DataProvider('screens')]
    public function test_the_permission_alone_opens_its_screen(string $permission, string $path): void
    {
        $this->actingAs($this->holderOf($permission))->get($path)->assertOk();
    }

    #[DataProvider('screens')]
    public function test_staff_without_it_are_refused(string $permission, string $path): void
    {
        // Somebody who is staff — they hold a permission, so the door opens —
        // but not this one. A screen that lets them in is a permission that
        // gates nothing.
        $other = $permission === 'audit.view' ? 'branding.edit' : 'audit.view';

        $this->actingAs($this->holderOf($other))->get($path)->assertForbidden();
    }

    public function test_the_affiliate_permission_has_no_row_and_no_screen(): void
    {
        // Stated rather than assumed, so the gap is visible in the suite and
        // not only in the roadmap: §11 calls the affiliate programme optional
        // for v1, and this deployment ships without it. Its points ledger is
        // still migrated, so nobody's balance is lost when it does arrive.
        //
        // No menu row either. A row with a 404 behind it is the same objection
        // as a row that 403s — it goes in when the route does.
        foreach (AdminNav::items() as $item) {
            $this->assertNotContains(Permission::AffiliateManage, $item['need']);
        }
    }

    public function test_every_permission_in_the_catalogue_is_accounted_for(): void
    {
        $delivered = array_keys(self::screens());
        $pending = ['affiliate.manage'];

        $this->assertEqualsCanonicalizing(
            Permission::values(),
            [...$delivered, ...$pending],
            'A permission was added to the catalogue without a screen or a note saying which phase brings one.',
        );
    }
}
