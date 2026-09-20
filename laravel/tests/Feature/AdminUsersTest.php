<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\AuditEntry;
use App\Models\Setting;
use App\Models\User;
use App\Services\Permissions;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * The accounts screen, and the guards that keep one admin from disarming
 * another — or themselves.
 */
final class AdminUsersTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $manager;

    private User $frontDesk;

    private User $member;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);

        // Two narrow roles, because the point of the screen is that each half
        // of it is reachable on its own.
        DB::table('roles')->insert([
            ['id' => 'manager', 'label' => 'Manager', 'builtin' => false],
            ['id' => 'front-desk', 'label' => 'Front desk', 'builtin' => false],
        ]);
        DB::table('role_permissions')->insert([
            ['role_id' => 'manager', 'permission' => 'users.manage'],
            ['role_id' => 'front-desk', 'permission' => 'users.approve'],
        ]);
        Permissions::forget();

        $this->admin = User::factory()->create(['role_id' => 'admin']);
        $this->manager = User::factory()->create(['role_id' => 'manager']);
        $this->frontDesk = User::factory()->create(['role_id' => 'front-desk']);
        $this->member = User::factory()->create(['role_id' => 'user']);
    }

    public function test_either_permission_opens_the_screen_and_neither_opens_it_alone(): void
    {
        $this->actingAs($this->member)->get('/admin/utilisateurs')->assertForbidden();
        $this->actingAs($this->manager)->get('/admin/utilisateurs')->assertOk();
        $this->actingAs($this->frontDesk)->get('/admin/utilisateurs')->assertOk();
    }

    public function test_approve_only_cannot_change_a_role_a_ban_or_a_quota(): void
    {
        $this->actingAs($this->frontDesk)
            ->post("/admin/utilisateurs/{$this->member->uid}/role", ['role' => 'moderator'])
            ->assertForbidden();

        $this->actingAs($this->frontDesk)
            ->post("/admin/utilisateurs/{$this->member->uid}/suspension", ['banned' => 1, 'reason' => 'spam on every ad'])
            ->assertForbidden();

        $this->actingAs($this->frontDesk)
            ->post("/admin/utilisateurs/{$this->member->uid}/quota", ['listing_quota' => 10, 'featured_quota' => 1])
            ->assertForbidden();

        $this->assertSame('user', $this->member->fresh()->role_id);
    }

    public function test_managing_accounts_does_not_quietly_contain_managing_roles(): void
    {
        // Otherwise users.manage means roles.manage by way of "promote a
        // friend, ask them to promote you back".
        $this->actingAs($this->manager)
            ->post("/admin/utilisateurs/{$this->member->uid}/role", ['role' => 'admin'])
            ->assertSessionHasErrors('role');

        $this->assertSame('user', $this->member->fresh()->role_id);

        $this->actingAs($this->admin)
            ->post("/admin/utilisateurs/{$this->member->uid}/role", ['role' => 'admin'])
            ->assertSessionHasNoErrors();

        $this->assertSame('admin', $this->member->fresh()->role_id);
    }

    public function test_the_last_super_admin_cannot_be_demoted(): void
    {
        $second = User::factory()->create(['role_id' => 'admin']);

        // Two of them: demoting one is fine.
        $this->actingAs($this->admin)
            ->post("/admin/utilisateurs/{$second->uid}/role", ['role' => 'user'])
            ->assertSessionHasNoErrors();

        // One left, and it is the one signed in — refused twice over.
        $this->actingAs($this->admin)
            ->post("/admin/utilisateurs/{$this->admin->uid}/role", ['role' => 'user'])
            ->assertSessionHasErrors('role');

        $manager = $this->manager;
        $manager->forceFill(['role_id' => 'admin'])->save();
        $this->assertSame(2, User::query()->where('role_id', 'admin')->count());

        $this->actingAs($this->admin)
            ->post("/admin/utilisateurs/{$manager->uid}/role", ['role' => 'user'])
            ->assertSessionHasNoErrors();

        $this->actingAs($this->admin)
            ->post("/admin/utilisateurs/{$this->admin->uid}/role", ['role' => 'user'])
            ->assertSessionHasErrors('role');
        $this->assertSame('admin', $this->admin->fresh()->role_id);
    }

    public function test_a_ban_needs_a_reason_and_the_log_carries_it(): void
    {
        $this->actingAs($this->manager)
            ->post("/admin/utilisateurs/{$this->member->uid}/suspension", ['banned' => 1, 'reason' => 'شوي'])
            ->assertSessionHasErrors('ban');

        $this->assertFalse($this->member->fresh()->is_banned);

        $this->actingAs($this->manager)
            ->post("/admin/utilisateurs/{$this->member->uid}/suspension", [
                'banned' => 1,
                'reason' => 'إعلانات مكرّرة وأرقام مزوّرة',
            ])
            ->assertSessionHasNoErrors();

        $banned = $this->member->fresh();
        $this->assertTrue($banned->is_banned);
        $this->assertSame('إعلانات مكرّرة وأرقام مزوّرة', $banned->ban_reason);

        $entry = AuditEntry::query()->where('action', 'user.ban')->firstOrFail();
        $this->assertSame('إعلانات مكرّرة وأرقام مزوّرة', $entry->note());
    }

    public function test_unbanning_clears_the_reason_and_needs_none(): void
    {
        $this->member->forceFill(['is_banned' => true, 'ban_reason' => 'spam'])->save();

        $this->actingAs($this->manager)
            ->post("/admin/utilisateurs/{$this->member->uid}/suspension", ['banned' => 0])
            ->assertSessionHasNoErrors();

        $restored = $this->member->fresh();
        $this->assertFalse($restored->is_banned);
        $this->assertNull($restored->ban_reason);
    }

    public function test_nobody_bans_themselves(): void
    {
        $this->actingAs($this->manager)
            ->post("/admin/utilisateurs/{$this->manager->uid}/suspension", ['banned' => 1, 'reason' => 'testing this out'])
            ->assertSessionHasErrors('ban');

        $this->assertFalse($this->manager->fresh()->is_banned);
    }

    public function test_a_quota_is_bounded_so_a_stray_zero_is_not_ten_thousand_ads(): void
    {
        $this->actingAs($this->manager)
            ->post("/admin/utilisateurs/{$this->member->uid}/quota", ['listing_quota' => 10000, 'featured_quota' => 0])
            ->assertSessionHasErrors('listing_quota');

        $this->actingAs($this->manager)
            ->post("/admin/utilisateurs/{$this->member->uid}/quota", ['listing_quota' => 25, 'featured_quota' => 2])
            ->assertSessionHasNoErrors();

        $this->assertSame(25, $this->member->fresh()->listing_quota);
    }

    public function test_turning_approval_on_approves_everyone_already_here(): void
    {
        // Otherwise one click stops every current member of the platform from
        // posting — people who were approved by the site being open when they
        // joined.
        $waiting = User::factory()->count(3)->create(['approved' => false]);

        $this->actingAs($this->frontDesk)
            ->post('/admin/utilisateurs/approbation', ['on' => 1])
            ->assertSessionHasNoErrors();

        $this->assertTrue(Setting::read('access')['requireApproval']);
        foreach ($waiting as $account) {
            $this->assertTrue($account->fresh()->approved);
        }

        $entry = AuditEntry::query()->where('action', 'access.approval')->firstOrFail();
        $this->assertSame(3, $entry->detail['approved']);
    }

    public function test_the_registration_queue_is_the_front_desks_own_power(): void
    {
        Setting::query()->create(['key' => 'access', 'value' => ['requireApproval' => true]]);
        $this->member->forceFill(['approved' => false])->save();

        $this->actingAs($this->manager)
            ->post("/admin/utilisateurs/{$this->member->uid}/approbation", ['approved' => 1])
            ->assertForbidden();

        $this->actingAs($this->frontDesk)
            ->post("/admin/utilisateurs/{$this->member->uid}/approbation", ['approved' => 1])
            ->assertSessionHasNoErrors();

        $this->assertTrue($this->member->fresh()->approved);
    }

    public function test_search_matches_a_name_an_email_and_a_whole_uid(): void
    {
        $target = User::factory()->create([
            'display_name' => 'وكالة الأمل العقارية',
            'email' => 'amel@example.dz',
        ]);

        $this->actingAs($this->manager)->get('/admin/utilisateurs?q=الأمل')
            ->assertSee('amel@example.dz')
            ->assertDontSee($this->member->email);

        $this->actingAs($this->manager)->get('/admin/utilisateurs?q=amel@example.dz')
            ->assertSee('وكالة الأمل العقارية', false);

        $this->actingAs($this->manager)->get('/admin/utilisateurs?q='.$target->uid)
            ->assertSee('amel@example.dz');
    }
}
