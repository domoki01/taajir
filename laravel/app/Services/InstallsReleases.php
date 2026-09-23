<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Applying a release.
 *
 * Extracted for the same reason VerifiesIdTokens was: the implementation is
 * `final`, and the one thing a test of the *screen* must not do is run the real
 * one — `apply()` migrates, seeds and rebuilds the caches, which against a test
 * database means pulling the in-memory schema out from under the request that
 * is still being served.
 *
 * It is a seam with a real name, not a test hook: a deployment that pulled from
 * git instead of a zip would implement this and change nothing else.
 */
interface InstallsReleases
{
    /**
     * @return array{app: int, docroot: int, cleared: int, migrations: string}
     *
     * @throws \RuntimeException
     */
    public function apply(string $zipPath): array;
}
