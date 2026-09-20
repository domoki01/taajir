<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Article;
use App\Models\ArticleComment;
use App\Services\ArticleService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * The public side of the masthead.
 *
 * These pages exist for a reason that is not editorial: a classifieds site with
 * nothing but listings has almost no text a search engine can index against a
 * question. Somebody typing "كيفاش نكري دار في الجزائر بلا سمسار" is a future
 * user, and today that query lands on a competitor's blog.
 */
final class ArticleController extends Controller
{
    public function __construct(private readonly ArticleService $articles) {}

    public function index(): View
    {
        return view('articles.index', [
            'articles' => Article::query()->public()->latest('published_at')->paginate(12),
        ]);
    }

    public function show(Request $request, string $slug): View
    {
        // Published only. A draft is not a page — 404, not 403, because "this
        // does not exist yet" is the truth and 403 would confirm it does.
        $article = Article::query()->public()->where('slug', $slug)->firstOrFail();

        return view('articles.show', [
            'article' => $article,
            // Hidden comments keep their row, so the filter is per reader: the
            // author still sees their own, staff see all of them, nobody else
            // does.
            'comments' => $article->comments()
                ->oldest('created_at')
                ->get()
                ->filter(fn ($comment) => $comment->visibleTo($request->user()))
                ->values(),
        ]);
    }

    public function comment(Request $request, string $slug): RedirectResponse
    {
        $article = Article::query()->where('slug', $slug)->firstOrFail();

        $validated = $request->validate([
            'text' => ['required', 'string', 'min:2', 'max:1000'],
        ]);

        $this->articles->comment($request->user(), $article, $validated['text']);

        return back()->with('status', __('article.comment_posted'));
    }

    public function destroyComment(Request $request, ArticleComment $comment): RedirectResponse
    {
        $this->articles->deleteComment($request->user(), $comment);

        return back();
    }
}
