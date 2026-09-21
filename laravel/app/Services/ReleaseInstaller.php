<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Symfony\Component\Console\Output\BufferedOutput;
use ZipArchive;

/**
 * ── APPLYING A RELEASE ───────────────────────────────────────────────────────
 * Unpack a release zip over the running application.
 *
 * This is what deploy/public_html/install-update.php does, as a class, so the
 * admin screen and the standalone script cannot drift into two different
 * deploys. The script keeps its own copy of the *bootstrap* — finding the app,
 * reading the token, clearing the caches before the framework loads — because
 * it has to work when the framework will not. Everything after that is here.
 *
 * What it will not touch, and why each one would take the site down:
 *
 *   .env          the database password and APP_KEY
 *   storage/      every uploaded photo, and the logs
 *   vendor/       installed by Composer, not shipped in a release
 *   index.php     the split-layout front controller, tuned per account
 *
 * The one thing to be honest about: an admin who can upload a zip can upload
 * PHP, and PHP runs. There is no version of "update from the browser" where
 * that is not true. It is why the screen is limited to the super-admin role
 * rather than to a permission that can be handed out — see UpdateController.
 */
final class ReleaseInstaller implements InstallsReleases
{
    /**
     * Never replaced, whatever a release carries, matched at the top level only.
     *
     * These are the installation rather than the code: the credentials, the
     * uploads, the logs, and the front controller that knows where this
     * particular host put everything. A release that shipped one would be
     * overwriting the server with a developer's machine.
     *
     * @var list<string>
     */
    private const NEVER_REPLACED_IN_APP = ['.env', 'storage'];

    /** @var list<string> */
    private const NEVER_REPLACED_IN_DOCROOT = ['index.php', 'storage'];

    /**
     * Kept only because a release usually does not carry them.
     *
     * vendor/ is server-owned in the ordinary case — built there by composer,
     * left alone here. But this host has no SSH and no proc_open, so composer
     * cannot run on it at all, and a release that adds a dependency leaves the
     * site throwing "Class not found" at whoever touches the new code first.
     * When a release does ship one of these, shipping it is the point.
     *
     * @var list<string>
     */
    private const KEPT_UNLESS_SHIPPED = ['vendor', 'node_modules'];

    public function __construct(
        private readonly string $appPath,
        private readonly string $docroot,
    ) {}

    public static function forThisInstall(): self
    {
        return new self(base_path(), public_path());
    }

    /**
     * @return array{app: int, docroot: int, cleared: int, migrations: string}
     *
     * @throws \RuntimeException
     */
    public function apply(string $zipPath): array
    {
        $staging = $this->unpack($zipPath);

        try {
            $app = $this->mirror($staging.'/taajir-app', $this->appPath, $this->keepInApp($staging.'/taajir-app'));
            $docroot = $this->mirror($staging.'/public_html', $this->docroot, self::NEVER_REPLACED_IN_DOCROOT);
            $this->linkStorage();
        } finally {
            File::deleteDirectory($staging);
        }

        /*
         * The caches that keep old code running after the files beneath them
         * have changed. Cleared after the copy, not before: a request served in
         * between would recompile from whichever half was already written.
         */
        $cleared = 0;
        foreach ([$this->appPath.'/bootstrap/cache/*.php', $this->appPath.'/storage/framework/views/*.php'] as $pattern) {
            foreach (glob($pattern) ?: [] as $stale) {
                $cleared += @unlink($stale) ? 1 : 0;
            }
        }

        $migrations = $this->artisan('migrate', ['--force' => true]);
        $this->artisan('db:seed', ['--force' => true]);
        $this->artisan('config:cache');
        $this->artisan('route:cache');
        $this->artisan('view:cache');

        return compact('app', 'docroot', 'cleared', 'migrations');
    }

    /**
     * Open the zip into a staging directory and check it is one of ours.
     *
     * Staged rather than extracted in place, because a request served halfway
     * through an in-place extract sees a tree that is half one version and half
     * the other — which is the state that produced an undefined variable in a
     * view whose controller had not been replaced yet.
     *
     * @throws \RuntimeException
     */
    private function unpack(string $zipPath): string
    {
        if (! class_exists(ZipArchive::class)) {
            throw new \RuntimeException(__('update.no_zip_extension'));
        }

        $archive = new ZipArchive;

        if ($archive->open($zipPath) !== true) {
            throw new \RuntimeException(__('update.unreadable'));
        }

        $staging = storage_path('app/release-'.bin2hex(random_bytes(6)));

        if (! File::makeDirectory($staging, 0755, true)) {
            throw new \RuntimeException(__('update.no_staging'));
        }

        $ok = $archive->extractTo($staging);
        $archive->close();

        if (! $ok) {
            File::deleteDirectory($staging);
            throw new \RuntimeException(__('update.extract_failed'));
        }

        if (! is_dir($staging.'/taajir-app') || ! is_dir($staging.'/public_html')) {
            File::deleteDirectory($staging);
            throw new \RuntimeException(__('update.not_a_release'));
        }

        return $staging;
    }

    /**
     * The uploads symlink, if it is not already there.
     *
     * `artisan storage:link` cannot make this one: it writes to public/storage,
     * and in the split layout the document root is somewhere else entirely.
     * setup.php and install-update.php both create it; this did not, so an
     * install only ever updated from the admin screen never got one — and
     * because the docroot's `storage` is on the never-replaced list, nothing
     * else was going to make it either. Every listing photo 404s until it
     * exists, which looks like a broken image pipeline rather than a missing
     * symlink.
     *
     * Silent when it fails: some hosts forbid symlink(), and a release that
     * otherwise applied cleanly should not be reported as a failure over this.
     */
    private function linkStorage(): void
    {
        $link = $this->docroot.'/storage';

        if (file_exists($link)) {
            return;
        }

        @symlink($this->appPath.'/storage/app/public', $link);
    }

    /**
     * What this particular release must not overwrite.
     *
     * Everything in NEVER_REPLACED_IN_APP, plus whichever of the
     * KEPT_UNLESS_SHIPPED trees the release left out. A release that carries
     * vendor/ replaces vendor/; one that does not, leaves it standing.
     *
     * @return list<string>
     */
    private function keepInApp(string $from): array
    {
        $keep = self::NEVER_REPLACED_IN_APP;

        foreach (self::KEPT_UNLESS_SHIPPED as $tree) {
            if (! is_dir($from.'/'.$tree)) {
                $keep[] = $tree;
            }
        }

        return $keep;
    }

    /**
     * Copy one tree over another, overwriting.
     *
     * `$keep` is matched at the top level only. A nested file called .env is
     * not the one that matters, and skipping by name at every depth would
     * quietly refuse to update resources/views/storage/*.
     *
     * @param  list<string>  $keep
     */
    private function mirror(string $from, string $to, array $keep = []): int
    {
        $copied = 0;

        foreach (scandir($from) ?: [] as $entry) {
            if ($entry === '.' || $entry === '..' || in_array($entry, $keep, true)) {
                continue;
            }

            $source = $from.'/'.$entry;
            $target = $to.'/'.$entry;

            if (is_dir($source)) {
                File::ensureDirectoryExists($target);
                $copied += $this->mirror($source, $target);
            } else {
                $copied += @copy($source, $target) ? 1 : 0;
            }
        }

        return $copied;
    }

    /**
     * @param  array<string, mixed>  $parameters
     *
     * @throws \RuntimeException
     */
    private function artisan(string $command, array $parameters = []): string
    {
        $output = new BufferedOutput;

        try {
            $status = Artisan::call($command, $parameters, $output);
        } catch (\Throwable $e) {
            throw new \RuntimeException(__('update.command_failed', ['command' => $command]).': '.$e->getMessage(), 0, $e);
        }

        $text = $output->fetch();

        if ($status !== 0) {
            throw new \RuntimeException(__('update.command_failed', ['command' => $command]).":\n".$text);
        }

        return $text;
    }
}
