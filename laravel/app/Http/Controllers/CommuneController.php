<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\Geo;
use Illuminate\Http\JsonResponse;

/**
 * The communes of one wilaya, for the publish form's second select.
 *
 * Per-wilaya rather than one big payload: the whole dataset is 1541 rows, and
 * nobody picking a commune on a phone should download all of it. Public and
 * cacheable — it is the same committed geography the sitemap is built from.
 */
final class CommuneController extends Controller
{
    public function __invoke(string $wilaya): JsonResponse
    {
        $found = Geo::wilaya($wilaya);

        if ($found === null) {
            return response()->json([], 404);
        }

        $communes = Geo::communes($found->code)
            ->map(fn ($commune) => ['slug' => $commune->slug, 'name' => $commune->name()])
            ->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        return response()->json($communes)
            ->setPublic()
            ->setMaxAge(3600);
    }
}
