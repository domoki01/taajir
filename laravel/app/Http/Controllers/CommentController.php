<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Comment;
use App\Models\Listing;
use App\Services\CommentService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

final class CommentController extends Controller
{
    public function __construct(private readonly CommentService $comments) {}

    public function store(Request $request, Listing $listing): RedirectResponse
    {
        $validated = $request->validate(['text' => ['required', 'string', 'min:2', 'max:1000']]);

        // Only on an ad the public can see. Commenting on a held or rejected
        // one would leak that it exists.
        abort_unless($listing->status === 'published', 404);

        $this->comments->create($request->user(), $listing, $validated['text']);

        return back();
    }

    public function destroy(Request $request, Comment $comment): RedirectResponse
    {
        $this->comments->delete($request->user(), $comment);

        return back();
    }
}
