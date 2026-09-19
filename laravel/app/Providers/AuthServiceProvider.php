<?php

declare(strict_types=1);

namespace App\Providers;

use App\Enums\Permission;
use App\Services\Auth\FirebaseTokenVerifier;
use App\Services\Auth\VerifiesIdTokens;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

final class AuthServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(
            VerifiesIdTokens::class,
            fn () => new FirebaseTokenVerifier((string) config('firebase.project_id')),
        );
    }

    public function boot(): void
    {
        // firestore.rules is gone; its job splits in two. Object-level rules
        // become policies, and the fourteen admin permissions become these
        // gates — §6.1. Registering them from the enum means a permission
        // cannot exist in the catalogue without a gate, or the other way round.
        foreach (Permission::cases() as $permission) {
            Gate::define($permission->value, fn ($user) => $user->hasPermission($permission));
        }
    }
}
