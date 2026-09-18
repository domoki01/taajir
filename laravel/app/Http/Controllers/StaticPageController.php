<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\View\View;

/**
 * The five pages that are pure content: who we are, the help FAQ, the terms,
 * the privacy policy and the safety advice.
 *
 * One controller rather than five, because none of them does anything but pick
 * a view — the Next app grouped them under a single `(static)` layout for the
 * same reason. Their URLs are Latin and French-derived like every other path on
 * the site, and they are registered one by one in routes/web.php so the browse
 * catch-all can never swallow them.
 */
final class StaticPageController extends Controller
{
    public function __invoke(string $page): View
    {
        return view("static.{$page}");
    }
}
