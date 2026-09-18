<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Wilaya;
use App\Services\Geo;
use App\Services\Taxonomy;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\Response;

/**
 * The indexable browse pages — the ones a search for "كراء شقة باب الزوار" is
 * meant to land on. Free-form filtering lives at /recherche, which is noindex,
 * so the crawler only ever sees these clean, canonical combinations.
 *
 * `/{transaction}/{type?}/{wilaya?}/{commune?}`, resolved in that order.
 */
final class BrowseController extends Controller
{
    public function __invoke(string $transaction, ?string $rest = null): View
    {
        $taxonomy = Taxonomy::current();
        $parsed = $this->parse($transaction, $rest, $taxonomy);

        abort_if($parsed === null, Response::HTTP_NOT_FOUND);

        return view('browse', [
            'taxonomy' => $taxonomy,
            'transaction' => $parsed['transaction'],
            'propertyType' => $parsed['propertyType'],
            'wilaya' => $parsed['wilaya'],
            'commune' => $parsed['commune'],
            'heading' => $this->heading($parsed, $taxonomy),
            'canonical' => $this->canonicalPath($parsed),
        ]);
    }

    /**
     * Resolve /vente/appartement/alger into a filter set, rejecting anything
     * that is not a real segment. Without this the route would happily generate
     * an unbounded number of empty pages for a crawler to walk.
     *
     * Two things are stricter here than in the React version, both for that
     * same reason. The commune segment is checked against the wilaya that
     * precedes it rather than passed through unvalidated, and a fifth segment
     * is a 404 rather than ignored — otherwise `/vente/appartement/alger/x/y/z`
     * answers 200 for every value of x, y and z.
     *
     * @return array{transaction: string, propertyType: ?string, wilaya: ?Wilaya, commune: ?string}|null
     */
    private function parse(string $transaction, ?string $rest, Taxonomy $taxonomy): ?array
    {
        // Checked against the resolved taxonomy, not the enum, so a category an
        // admin added routes exactly like a built-in one — and a hidden one
        // keeps resolving, because hiding is a presentation decision. Anything
        // else and the filter would offer a link the router refuses.
        if (! isset($taxonomy->transactionTypes[$transaction])) {
            return null;
        }

        $segments = $rest === null || $rest === '' ? [] : explode('/', $rest);
        if (count($segments) > 3) {
            return null;
        }

        [$typeSlug, $wilayaSlug, $communeSlug] = [...$segments, null, null, null];

        $propertyType = null;
        if ($typeSlug !== null && $typeSlug !== '') {
            if (! isset($taxonomy->propertyTypes[$typeSlug])) {
                return null;
            }
            $propertyType = $typeSlug;
        }

        $wilaya = null;
        if ($wilayaSlug !== null && $wilayaSlug !== '') {
            $wilaya = Geo::wilaya($wilayaSlug);
            if ($wilaya === null) {
                return null;
            }
        }

        $commune = null;
        if ($communeSlug !== null && $communeSlug !== '') {
            // A commune only means anything inside its wilaya, and several
            // wilayas share a slug, so this cannot be looked up on its own.
            if ($wilaya === null || Geo::commune($wilaya->code, $communeSlug) === null) {
                return null;
            }
            $commune = $communeSlug;
        }

        return [
            'transaction' => $transaction,
            'propertyType' => $propertyType,
            'wilaya' => $wilaya,
            'commune' => $commune,
        ];
    }

    /** @param array{transaction: string, propertyType: ?string, wilaya: ?Wilaya, commune: ?string} $parsed */
    private function heading(array $parsed, Taxonomy $taxonomy): string
    {
        $what = $parsed['propertyType']
            ? $taxonomy->propertyTypes[$parsed['propertyType']]
            : 'عقارات';
        $deal = $taxonomy->transactionTypes[$parsed['transaction']];
        $where = $parsed['wilaya'] ? ' في '.$parsed['wilaya']->name_ar : ' في الجزائر';

        return $what.' لل'.$deal.$where;
    }

    /**
     * The canonical path stops at the wilaya, as it does on the other side: the
     * commune narrows the same page rather than being one of its own.
     *
     * @param  array{transaction: string, propertyType: ?string, wilaya: ?Wilaya, commune: ?string}  $parsed
     */
    private function canonicalPath(array $parsed): string
    {
        return '/'.implode('/', array_filter([
            $parsed['transaction'],
            $parsed['propertyType'],
            $parsed['wilaya']?->slug,
        ]));
    }
}
