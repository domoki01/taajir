<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\Permissions;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * The screen that decides what every other screen may do — and the four guards
 * that stop an admin locking themselves out of it.
 */
final class AdminRolesTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $keeper;

    private User $member;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);

        // Somebody who holds roles.manage without being the super-admin: the
        // only account for whom guard 2 can actually fire.
        DB::table('roles')->insert([['id' => 'keeper', 'label' => 'Keeper', 'builtin' => false]]);
        DB::table('role_permissions')->insert([['role_id' => 'keeper', 'permission' => 'roles.manage']]);
        Permissions::forget();

        $this->admin = User::factory()->create(['role_id' => 'admin']);
        $this->keeper = User::factory()->create(['role_id' => 'keeper']);
        $this->member = User::factory()->create(['role_id' => 'user']);
    }

    /** @param array<string, list<string>> $matrix */
    private function save(User $actor, array $matrix, ?array $roles = null)
    {
        return $this->actingAs($actor)->post('/admin/roles', [
            'roles' => $roles ?? array_keys($matrix),
            'permissions' => $matrix,
        ]);
    }

    public function test_the_screen_needs_roles_manage(): void
    {
        $this->actingAs($this->member)->get('/admin/roles')->assertForbidden();
        $this->actingAs($this->keeper)->get('/admin/roles')->assertOk();
    }

    public function test_a_saved_matrix_is_what_the_gates_then_read(): void
    {
        $this->save($this->admin, [
            'keeper' => ['roles.manage'],
            'agency' => ['listings.moderate', 'articles.manage'],
        ])->assertSessionHasNoErrors();

        Permissions::forget();
        $agency = User::factory()->create(['role_id' => 'agency']);

        $this->assertTrue($agency->hasPermission(Permission::ListingsModerate));
        $this->assertTrue($agency->hasPermission(Permission::ArticlesManage));
        $this->assertFalse($agency->hasPermission(Permission::UsersManage));
    }

    public function test_emptying_a_row_empties_it(): void
    {
        // The form posts the ids it drew as well as the boxes that are ticked;
        // without that a row whose every box was unticked is simply absent from
        // the payload and the old permissions survive the save.
        $this->save($this->admin, ['keeper' => ['roles.manage']], ['keeper', 'moderator'])
            ->assertSessionHasNoErrors();

        Permissions::forget();
        $this->assertSame([], Permissions::of('moderator'));
    }

    public function test_the_super_admins_row_is_ignored_rather_than_obeyed(): void
    {
        // Guard 1. It holds everything by code; accepting an edit would only
        // make the screen lie.
        $this->save($this->admin, ['admin' => [], 'keeper' => ['roles.manage']])
            ->assertSessionHasNoErrors();

        Permissions::forget();
        $this->assertSame(Permission::cases(), Permissions::of('admin'));
        $this->assertTrue($this->admin->fresh()->hasPermission(Permission::UsersManage));
    }

    public function test_nobody_takes_the_key_out_of_their_own_pocket(): void
    {
        // Guard 2: the one edit with no undo, because the screen that would fix
        // it is the screen you just locked.
        $this->save($this->keeper, ['keeper' => ['articles.manage']])
            ->assertSessionHasErrors('permissions');

        Permissions::forget();
        $this->assertTrue($this->keeper->fresh()->hasPermission(Permission::RolesManage));
    }

    public function test_a_permission_that_left_the_catalogue_is_dropped_not_refused(): void
    {
        $this->save($this->admin, ['keeper' => ['roles.manage', 'listings.teleport']])
            ->assertSessionHasNoErrors();

        Permissions::forget();
        $this->assertSame([Permission::RolesManage], Permissions::of('keeper'));
    }

    public function test_a_new_role_starts_with_nothing(): void
    {
        $this->actingAs($this->admin)
            ->post('/admin/roles/nouveau', ['id' => 'Agence-Pro', 'label' => 'وكالة محترفة'])
            ->assertSessionHasNoErrors();

        $role = Role::query()->findOrFail('agence-pro');
        $this->assertSame('وكالة محترفة', $role->label);
        $this->assertFalse($role->builtin);

        Permissions::forget();
        $this->assertSame([], Permissions::of('agence-pro'));
    }

    public function test_a_role_id_is_latin_and_unique(): void
    {
        $this->actingAs($this->admin)
            ->post('/admin/roles/nouveau', ['id' => 'وكالة', 'label' => 'Agence'])
            ->assertSessionHasErrors('id');

        $this->actingAs($this->admin)
            ->post('/admin/roles/nouveau', ['id' => 'keeper', 'label' => 'Another keeper'])
            ->assertSessionHasErrors('id');
    }

    public function test_built_in_roles_survive_deletion_and_so_does_one_with_people_on_it(): void
    {
        // Guards 3 and 4.
        $this->actingAs($this->admin)->delete('/admin/roles/moderator')->assertSessionHasErrors('id');
        $this->assertTrue(Role::query()->whereKey('moderator')->exists());

        $this->actingAs($this->admin)->delete('/admin/roles/keeper')->assertSessionHasErrors('id');
        $this->assertTrue(Role::query()->whereKey('keeper')->exists());

        // Move the one account off it, and it goes.
        $this->keeper->forceFill(['role_id' => 'user'])->save();
        $this->actingAs($this->admin)->delete('/admin/roles/keeper')->assertSessionHasNoErrors();
        $this->assertFalse(Role::query()->whereKey('keeper')->exists());
        $this->assertSame(0, DB::table('role_permissions')->where('role_id', 'keeper')->count());
    }

    public function test_the_matrix_shows_what_the_resolver_says_not_what_the_table_holds(): void
    {
        $this->actingAs($this->admin)->get('/admin/roles')
            ->assertOk()
            ->assertSee(Permission::LaunchControl->label())
            ->assertSee(__('admin.roles.super_admin_note'), false);
    }
}
