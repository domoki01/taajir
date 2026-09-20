<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Services\ArticleService;
use App\Support\ArticleBody;
use App\Support\Nav;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * The editor.
 *
 * The body is typed as text and stored as blocks. Nothing an editor writes ever
 * becomes markup — that is the whole design, and the reason there is no rich
 * text field here and no HTML column behind it.
 */
final class ArticleController extends Controller
{
    public function __construct(private readonly ArticleService $articles) {}

    private function authorizeAction(Request $request): void
    {
        abort_unless($request->user()?->hasPermission(Permission::ArticlesManage) === true, 403);
    }

    public function index(Request $request): View
    {
        $this->authorizeAction($request);

        return view('admin.articles', [
            // Drafts included, and newest first by when they were touched
            // rather than by publication: this is a work list, not a feed.
            'articles' => Article::query()->latest('updated_at')->paginate(20),
        ]);
    }

    public function create(Request $request): View
    {
        $this->authorizeAction($request);

        return view('admin.article-edit', ['article' => null, 'body' => '']);
    }

    public function edit(Request $request, Article $article): View
    {
        $this->authorizeAction($request);

        return view('admin.article-edit', [
            'article' => $article,
            // Turned back into the text that produced it, so the editor reopens
            // what it saved rather than a JSON dump of it.
            'body' => ArticleBody::toRaw($article->body ?? []),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->authorizeAction($request);

        $article = $this->articles->save($request->user(), null, $this->validated($request));

        return redirect()
            ->to(Nav::href('/admin/articles/'.$article->id.'/modifier'))
            ->with('status', __('article.saved'));
    }

    public function update(Request $request, Article $article): RedirectResponse
    {
        $this->authorizeAction($request);

        $this->articles->save($request->user(), $article, $this->validated($request));

        return back()->with('status', __('article.saved'));
    }

    public function destroy(Request $request, Article $article): RedirectResponse
    {
        $this->authorizeAction($request);

        $this->articles->delete($request->user(), $article);

        return redirect()->to(Nav::href('/admin/articles'))->with('status', __('article.deleted'));
    }

    /** @return array<string, mixed> */
    private function validated(Request $request): array
    {
        $validated = $request->validate([
            'slug' => ['required', 'string', 'max:70'],
            'title' => ['required', 'string', 'min:10', 'max:120'],
            'excerpt' => ['required', 'string', 'min:20', 'max:300'],
            'body' => ['required', 'string', 'max:40000'],
            'cover_url' => ['nullable', 'string', 'max:500'],
            'cover_alt' => ['nullable', 'string', 'max:140'],
            'tags' => ['nullable', 'string', 'max:200'],
            'status' => ['required', 'in:draft,published'],
        ]);

        // One comma-separated field rather than six inputs: six tags is the
        // ceiling, most pieces carry two, and a repeating row for something
        // typed once is more form than the job needs.
        $validated['tags'] = array_filter(array_map('trim', explode(',', (string) ($validated['tags'] ?? ''))));

        return $validated;
    }
}
