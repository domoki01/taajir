<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\AuditEntry;
use App\Services\InstallsReleases;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\View\View;

/**
 * Applying a release from the browser.
 *
 * On an account with no SSH this is the only way to deploy that does not
 * involve a file manager and a dozen steps, two of which silently do nothing.
 *
 * **Gated on the super-admin role, not on a permission.** Every other screen in
 * the panel is behind one of the fourteen in §6.2, and this deliberately is
 * not: uploading a zip means uploading PHP, and PHP runs. That is not a
 * capability to hand out from the roles matrix — anyone who holds it holds the
 * server, permissions and all. It belongs to the one role that already holds
 * everything by code, and it stays there.
 */
final class UpdateController extends Controller
{
    public function __construct(private readonly InstallsReleases $installer) {}

    private function authorizeAction(Request $request): void
    {
        abort_unless($request->user()?->role_id === Role::Admin->value, 403);
    }

    public function index(Request $request): View
    {
        $this->authorizeAction($request);

        return view('admin.update', [
            // What an upload has to fit through. Named on the screen rather
            // than discovered by a truncated file: PHP silently drops anything
            // over the limit, and the form then looks like it did nothing.
            'limit' => min(
                $this->bytes((string) ini_get('upload_max_filesize')),
                $this->bytes((string) ini_get('post_max_size')),
            ),
            'appPath' => base_path(),
            // The tree being inside the document root is the other thing worth
            // saying out loud on the one screen an admin opens to deploy.
            'exposed' => str_starts_with(base_path().'/', public_path().'/'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->authorizeAction($request);

        $validated = $request->validate([
            'release' => ['required', 'file', 'mimes:zip', 'max:65536'],
        ]);

        $upload = $validated['release'];

        // Moved out of PHP's temp directory first: the installer reads it after
        // the response has begun shaping, and a temp file is the framework's to
        // delete whenever it likes.
        $path = storage_path('app/release-'.now()->format('YmdHis').'.zip');
        File::ensureDirectoryExists(dirname($path));
        $upload->move(dirname($path), basename($path));

        try {
            $result = $this->installer->apply($path);
        } catch (\Throwable $e) {
            report($e);

            return back()->withErrors(['release' => $e->getMessage()]);
        } finally {
            @unlink($path);
        }

        AuditEntry::record($request->user(), 'release.install', 'settings', 'release', [
            'note' => $upload->getClientOriginalName(),
            'files' => $result['app'] + $result['docroot'],
        ]);

        return back()
            ->with('status', __('update.applied', [
                'app' => $result['app'],
                'docroot' => $result['docroot'],
            ]))
            ->with('migrations', trim($result['migrations']));
    }

    /** "64M" and "2G" are the shapes php.ini uses; bytes is what a form needs. */
    private function bytes(string $value): int
    {
        $value = trim($value);
        $number = (int) $value;

        return match (strtolower(substr($value, -1))) {
            'g' => $number * 1024 ** 3,
            'm' => $number * 1024 ** 2,
            'k' => $number * 1024,
            default => $number,
        };
    }
}
