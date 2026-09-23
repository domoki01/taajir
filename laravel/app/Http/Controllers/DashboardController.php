<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * Where signing in lands.
 *
 * A shell for now: phase 3's job is that Google and phone sign-in both reach a
 * page that knows who you are. The screens behind it — الإعلانات, التنبيهات,
 * المنشورات — arrive with the features they list, from phase 5 on.
 */
final class DashboardController extends Controller
{
    public function __invoke(Request $request): View
    {
        return view('dashboard.home', ['user' => $request->user()]);
    }
}
