<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\AuditEntry;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * The moderation trail: who did what, to which thing, and when.
 *
 * Read-only, and there is no controller action anywhere that edits or deletes a
 * row. That is the whole point of it — a log an admin can tidy up is one that
 * cannot answer the question it exists for, which is a moderator's decision
 * being questioned later by the person it affected.
 */
final class AuditController extends Controller
{
    public function __invoke(Request $request): View
    {
        abort_unless($request->user()?->hasPermission(Permission::AuditView) === true, 403);

        return view('admin.journal', [
            'entries' => AuditEntry::query()->latest('created_at')->paginate(50),
        ]);
    }
}
