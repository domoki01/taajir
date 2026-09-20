<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\ArticleComment;
use App\Models\AuditEntry;
use App\Models\Comment;
use App\Services\ArticleService;
use App\Services\CommentService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * Everything readers wrote, newest first, across both threads.
 *
 * Hiding keeps the row and takes the comment off the page. That is better than
 * deleting for the reason a moderator finds out the week after: the decision
 * stays reviewable, and the person hidden can still see what they wrote and
 * argue about it. Deleting is final and is offered anyway, because some things
 * should not stay on a disk.
 */
final class CommentController extends Controller
{
    public function __construct(
        private readonly CommentService $comments,
        private readonly ArticleService $articles,
    ) {}

    private function authorizeAction(Request $request): void
    {
        abort_unless($request->user()?->hasPermission(Permission::CommentsModerate) === true, 403);
    }

    public function index(Request $request): View
    {
        $this->authorizeAction($request);

        // Eager-loaded, both of them: a page of 50 comments across 30 ads is
        // two queries this way and fifty-one the obvious way.
        $listingComments = Comment::query()
            ->with('listing:id,slug,title')
            ->latest('created_at')
            ->limit(50)
            ->get();

        $articleComments = ArticleComment::query()
            ->with('article:id,slug,title')
            ->latest('created_at')
            ->limit(50)
            ->get();

        return view('admin.comments', [
            'listingComments' => $listingComments,
            'articleComments' => $articleComments,
            'hiddenCount' => $listingComments->where('status', 'hidden')->count()
                + $articleComments->where('status', 'hidden')->count(),
        ]);
    }

    public function hide(Request $request, Comment $comment): RedirectResponse
    {
        $this->authorizeAction($request);

        $validated = $request->validate(['reason' => ['nullable', 'string', 'max:255']]);
        $reason = (string) ($validated['reason'] ?? '');

        $this->comments->hide($request->user(), $comment, $reason);
        AuditEntry::record($request->user(), 'comment.hide', 'comment', (string) $comment->id, ['reason' => $reason]);

        return back()->with('status', __('admin.comments.hidden'));
    }

    public function show(Request $request, Comment $comment): RedirectResponse
    {
        $this->authorizeAction($request);

        $comment->update(['status' => 'visible', 'hidden_reason' => null]);
        AuditEntry::record($request->user(), 'comment.show', 'comment', (string) $comment->id);

        return back()->with('status', __('admin.comments.shown'));
    }

    public function destroy(Request $request, Comment $comment): RedirectResponse
    {
        $this->authorizeAction($request);

        $id = (string) $comment->id;
        $this->comments->delete($request->user(), $comment);
        AuditEntry::record($request->user(), 'comment.delete', 'comment', $id);

        return back()->with('status', __('admin.comments.deleted'));
    }

    public function hideArticleComment(Request $request, ArticleComment $comment): RedirectResponse
    {
        $this->authorizeAction($request);

        $validated = $request->validate(['reason' => ['nullable', 'string', 'max:255']]);

        $this->articles->hideComment($request->user(), $comment, (string) ($validated['reason'] ?? ''));

        return back()->with('status', __('admin.comments.hidden'));
    }

    public function showArticleComment(Request $request, ArticleComment $comment): RedirectResponse
    {
        $this->authorizeAction($request);

        $comment->update(['status' => 'visible', 'hidden_reason' => null]);
        AuditEntry::record($request->user(), 'comment.show', 'comment', (string) $comment->id);

        return back()->with('status', __('admin.comments.shown'));
    }

    public function destroyArticleComment(Request $request, ArticleComment $comment): RedirectResponse
    {
        $this->authorizeAction($request);

        $id = (string) $comment->id;
        $this->articles->deleteComment($request->user(), $comment);
        AuditEntry::record($request->user(), 'comment.delete', 'comment', $id);

        return back()->with('status', __('admin.comments.deleted'));
    }
}
