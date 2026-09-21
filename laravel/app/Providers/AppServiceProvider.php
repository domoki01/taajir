<?php

namespace App\Providers;

use App\Services\InstallsReleases;
use App\Services\ReleaseInstaller;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        /*
         * Bound rather than constructed where it is used.
         *
         * ReleaseInstaller writes over whatever tree it is given, and the only
         * sane default is this install — but a default reached for inside a
         * controller is one a test reaches too, and a test that mirrors a zip
         * over base_path() overwrites the repository it is running from. That
         * is not hypothetical; it happened while this was being written, and
         * README.md came back from git.
         */
        $this->app->bind(InstallsReleases::class, fn () => ReleaseInstaller::forThisInstall());

        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
