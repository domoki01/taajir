<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\Permission;
use App\Models\User;
use App\Services\Geo;
use App\Services\InstallsReleases;
use App\Services\Permissions;
use App\Services\ReleaseInstaller;
use App\Support\AdminNav;
use Database\Seeders\GeographySeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

/**
 * Applying a release from the browser.
 *
 * The gate is the part worth testing hardest: an upload here becomes running
 * PHP, so "who may press this" is not a detail.
 */
final class AdminUpdateTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $everythingElse;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(GeographySeeder::class);
        Geo::forget();

        $this->admin = User::factory()->create(['role_id' => 'admin']);

        // Somebody holding all fourteen permissions — and not the super-admin
        // role. They must still be refused.
        DB::table('roles')->insert([['id' => 'almost', 'label' => 'Almost', 'builtin' => false]]);
        DB::table('role_permissions')->insert(array_map(
            fn (string $p) => ['role_id' => 'almost', 'permission' => $p],
            Permission::values(),
        ));
        Permissions::forget();

        $this->everythingElse = User::factory()->create(['role_id' => 'almost']);
    }

    protected function tearDown(): void
    {
        // apply() rebuilds the caches, and in a test those land in this
        // install's bootstrap/cache. They are build artefacts; leaving one
        // behind pins the next run's config to whatever the test had.
        foreach (glob(base_path('bootstrap/cache/*.php')) ?: [] as $stale) {
            @unlink($stale);
        }

        parent::tearDown();
    }

    public function test_every_permission_in_the_catalogue_is_not_enough(): void
    {
        // The point of the role gate. Uploading a zip means uploading PHP, and
        // a box in the roles matrix must not be able to hand that out.
        $this->actingAs($this->everythingElse)->get('/admin/mise-a-jour')->assertForbidden();
        $this->actingAs($this->everythingElse)
            ->post('/admin/mise-a-jour', ['release' => UploadedFile::fake()->create('r.zip', 10, 'application/zip')])
            ->assertForbidden();

        $this->actingAs($this->admin)->get('/admin/mise-a-jour')->assertOk();
    }

    public function test_the_row_shows_for_the_super_admin_alone(): void
    {
        $rows = collect(AdminNav::visibleTo(Permission::cases(), false))->pluck('key');
        $this->assertNotContains('update', $rows);

        $rows = collect(AdminNav::visibleTo([], true))->pluck('key');
        $this->assertContains('update', $rows);

        $this->actingAs($this->everythingElse)->get('/admin')->assertDontSee(__('admin.nav.update'));
        $this->actingAs($this->admin)->get('/admin')->assertSee(__('admin.nav.update'));
    }

    public function test_something_that_is_not_a_release_is_refused(): void
    {
        $zip = $this->zipOf(['readme.txt' => 'hello']);

        $this->actingAs($this->admin)
            ->post('/admin/mise-a-jour', ['release' => new UploadedFile($zip, 'r.zip', 'application/zip', null, true)])
            ->assertSessionHasErrors('release');
    }

    public function test_a_release_replaces_code_and_leaves_the_server_files_alone(): void
    {
        [$app, $docroot] = $this->fakeInstall();

        // The ones that would take the site down if a deploy replaced them.
        File::put($app.'/.env', 'APP_KEY=the-real-one');
        File::ensureDirectoryExists($app.'/storage/app');
        File::put($app.'/storage/app/photo.webp', 'an upload');
        File::ensureDirectoryExists($app.'/vendor');
        File::put($app.'/vendor/autoload.php', 'installed by composer');
        File::put($docroot.'/index.php', 'the tuned front controller');

        // And a code file on the old version.
        File::ensureDirectoryExists($app.'/app');
        File::put($app.'/app/Thing.php', 'old');

        // No vendor/ in this release, which is the ordinary case: the tree is
        // built on the server and a release has no business carrying it.
        $zip = $this->zipOf([
            'taajir-app/app/Thing.php' => 'new',
            'taajir-app/.env' => 'APP_KEY=from-the-zip',
            'taajir-app/storage/app/photo.webp' => 'from the zip',
            'public_html/index.php' => 'the generic front controller',
            'public_html/robots.txt' => 'new robots',
        ]);

        (new ReleaseInstaller($app, $docroot))->apply($zip);

        $this->assertSame('new', File::get($app.'/app/Thing.php'));
        $this->assertSame('new robots', File::get($docroot.'/robots.txt'));

        $this->assertSame('APP_KEY=the-real-one', File::get($app.'/.env'));
        $this->assertSame('an upload', File::get($app.'/storage/app/photo.webp'));
        $this->assertSame('installed by composer', File::get($app.'/vendor/autoload.php'));
        $this->assertSame('the tuned front controller', File::get($docroot.'/index.php'));
    }

    public function test_a_release_that_ships_vendor_replaces_it(): void
    {
        /*
         * The exception, and the reason it exists: this host has no SSH and no
         * proc_open, so composer cannot run on it at all. A release that adds a
         * dependency and then steps around vendor/ leaves the site throwing
         * "Class not found" at whoever reaches the new code first — which is
         * exactly what happened when intervention/image landed and a seller
         * attaching a photo got a 500.
         *
         * Carrying vendor/ is the whole point of such a release, so a release
         * that carries one replaces it.
         */
        [$app, $docroot] = $this->fakeInstall();

        File::put($app.'/.env', 'APP_KEY=the-real-one');
        File::ensureDirectoryExists($app.'/vendor');
        File::put($app.'/vendor/autoload.php', 'the old tree, missing a package');

        $zip = $this->zipOf([
            'taajir-app/vendor/autoload.php' => 'the new tree',
            'taajir-app/vendor/intervention/image/src/ImageManager.php' => 'the package that was missing',
            'public_html/robots.txt' => 'x',
        ]);

        (new ReleaseInstaller($app, $docroot))->apply($zip);

        $this->assertSame('the new tree', File::get($app.'/vendor/autoload.php'));
        $this->assertSame(
            'the package that was missing',
            File::get($app.'/vendor/intervention/image/src/ImageManager.php'),
        );
        // The rule widened for vendor only. .env is the installation itself.
        $this->assertSame('APP_KEY=the-real-one', File::get($app.'/.env'));
    }

    public function test_a_nested_file_named_env_is_not_the_one_that_is_protected(): void
    {
        // Matching by name at every depth would quietly refuse to update
        // resources/views/storage/*, which is a real path.
        [$app, $docroot] = $this->fakeInstall();
        File::ensureDirectoryExists($app.'/resources/views/storage');
        File::put($app.'/resources/views/storage/index.blade.php', 'old');

        $zip = $this->zipOf([
            'taajir-app/resources/views/storage/index.blade.php' => 'new',
            'public_html/robots.txt' => 'x',
        ]);

        (new ReleaseInstaller($app, $docroot))->apply($zip);

        $this->assertSame('new', File::get($app.'/resources/views/storage/index.blade.php'));
    }

    public function test_the_caches_that_keep_old_code_running_are_cleared(): void
    {
        [$app, $docroot] = $this->fakeInstall();
        File::ensureDirectoryExists($app.'/bootstrap/cache');
        File::ensureDirectoryExists($app.'/storage/framework/views');
        File::put($app.'/bootstrap/cache/config.php', '<?php return [];');
        File::put($app.'/storage/framework/views/abc.php', 'compiled');

        $zip = $this->zipOf(['taajir-app/app/Thing.php' => 'new', 'public_html/robots.txt' => 'x']);

        $result = (new ReleaseInstaller($app, $docroot))->apply($zip);

        $this->assertSame(2, $result['cleared']);
        $this->assertFileDoesNotExist($app.'/bootstrap/cache/config.php');
        $this->assertFileDoesNotExist($app.'/storage/framework/views/abc.php');
    }

    public function test_a_failed_unpack_leaves_no_staging_directory_behind(): void
    {
        [$app, $docroot] = $this->fakeInstall();
        $before = count(glob(storage_path('app/release-*')) ?: []);

        try {
            (new ReleaseInstaller($app, $docroot))->apply($this->zipOf(['readme.txt' => 'x']));
            $this->fail('a zip that is not a release should be refused');
        } catch (\RuntimeException $e) {
            $this->assertSame(__('update.not_a_release'), $e->getMessage());
        }

        $this->assertSame($before, count(glob(storage_path('app/release-*')) ?: []));
    }

    public function test_applying_one_is_recorded(): void
    {
        /*
         * A double, bound through the interface.
         *
         * The real installer migrates, seeds and rebuilds the caches — against
         * a test database that means pulling the in-memory schema out from
         * under the request still being served, and the audit write then fails
         * on a table that no longer exists. What this test is about is the
         * screen: that a successful apply is recorded, and by whom.
         *
         * The earlier version of this test used the real one and mirrored the
         * zip over the repository it was running from; README.md came back from
         * git. That is why the controller resolves its installer rather than
         * reaching for base_path() itself.
         */
        $this->app->instance(InstallsReleases::class, new class implements InstallsReleases
        {
            public function apply(string $zipPath): array
            {
                return ['app' => 12, 'docroot' => 3, 'cleared' => 4, 'migrations' => 'INFO Nothing to migrate.'];
            }
        });

        $zip = $this->zipOf(['taajir-app/README.md' => 'new', 'public_html/robots.txt' => 'new']);

        $this->actingAs($this->admin)
            ->post('/admin/mise-a-jour', ['release' => new UploadedFile($zip, 'taajir.zip', 'application/zip', null, true)])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('status');

        $entry = DB::table('admin_audit')->where('action', 'release.install')->first();
        $this->assertNotNull($entry);
        $this->assertSame($this->admin->uid, $entry->actor_uid);
        $this->assertSame('taajir.zip', json_decode($entry->detail, true)['note']);
    }

    public function test_a_refused_release_says_why_and_records_nothing(): void
    {
        $this->app->instance(InstallsReleases::class, new class implements InstallsReleases
        {
            public function apply(string $zipPath): array
            {
                throw new \RuntimeException('the disk is full');
            }
        });

        $zip = $this->zipOf(['taajir-app/README.md' => 'new', 'public_html/robots.txt' => 'new']);

        $this->actingAs($this->admin)
            ->post('/admin/mise-a-jour', ['release' => new UploadedFile($zip, 'taajir.zip', 'application/zip', null, true)])
            ->assertSessionHasErrors('release');

        // Nothing was applied, so nothing is claimed in the log.
        $this->assertSame(0, DB::table('admin_audit')->where('action', 'release.install')->count());
    }

    /** @return array{0: string, 1: string} */
    private function fakeInstall(): array
    {
        $root = storage_path('framework/testing/install-'.uniqid());
        File::ensureDirectoryExists($root.'/app-tree');
        File::ensureDirectoryExists($root.'/docroot');

        return [$root.'/app-tree', $root.'/docroot'];
    }

    /** @param array<string, string> $files */
    private function zipOf(array $files): string
    {
        $path = storage_path('framework/testing/zip-'.uniqid().'.zip');
        File::ensureDirectoryExists(dirname($path));

        $zip = new \ZipArchive;
        $zip->open($path, \ZipArchive::CREATE);
        foreach ($files as $name => $contents) {
            $zip->addFromString($name, $contents);
        }
        $zip->close();

        return $path;
    }
}
