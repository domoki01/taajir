<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\Locale;
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
 *
 * A view per language rather than a page of translation keys. These are
 * paragraphs of legal and safety prose, not labels: they are written in each
 * language rather than translated string by string, they are reviewed as whole
 * documents, and a terms page assembled from forty keys is one nobody can read
 * before publishing it.
 */
final class StaticPageController extends Controller
{
    public function __invoke(string $page): View
    {
        $locale = Locale::current();

        // Arabic is the fallback, and the one language every page is guaranteed
        // to exist in. A missing translation shows the Arabic document rather
        // than a 404: the content pages carry the terms people agreed to and
        // the advice that keeps them from being defrauded, so having them in
        // the wrong language beats not having them.
        $view = "static.{$locale->value}.{$page}";

        return view()->exists($view)
            ? view($view)
            : view('static.'.Locale::default()->value.'.'.$page);
    }
}
