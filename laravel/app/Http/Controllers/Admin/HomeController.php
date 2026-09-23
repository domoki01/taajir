<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\AuditEntry;
use App\Services\AdminStats;
use App\Support\AdminNav;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\View\View;

/**
 * The admin's home screen: where things stand, and where everything is.
 *
 * The section has no sidebar and no pill row. Both were the same mistake in
 * different clothes — furniture from a web page wrapped around what people open
 * on a phone. The destinations live here as grouped rows, and every screen
 * inside the section has one way back to this one.
 */
final class HomeController extends Controller
{
    public function __invoke(Request $request): View
    {
        $user = $request->user();

        return view('admin.home', [
            'stats' => AdminStats::all(),
            'groups' => collect(AdminNav::visibleTo(
                $user->permissions(),
                $user->role_id === Role::Admin->value,
            ))->groupBy('group'),
            // Six, not the whole log: this is "what just happened", and the
            // screen that answers "what happened" is one row further down.
            'recent' => $this->recent(),
        ]);
    }

    /**
     * The last handful of decisions — or null when the log cannot be read.
     *
     * Null rather than an empty collection, for the same reason the counts use
     * a dash: "nothing has happened yet" and "we could not tell you" are
     * different answers, and only one of them means the site is fine.
     *
     * @return Collection<int, AuditEntry>|null
     */
    private function recent(): ?Collection
    {
        try {
            return AuditEntry::query()->latest('created_at')->limit(6)->get();
        } catch (\Throwable $e) {
            report($e);

            return null;
        }
    }
}
