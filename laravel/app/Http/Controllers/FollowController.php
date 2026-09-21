<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\Follows;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Follow and unfollow, answered as JSON so the button does not reload the page.
 */
final class FollowController extends Controller
{
    public function __construct(private readonly Follows $follows) {}

    public function store(Request $request, string $publicId): JsonResponse
    {
        $target = $this->target($publicId);

        $done = $this->follows->follow($request->user(), $target);

        return response()->json([
            'following' => $done,
            'followers' => $this->follows->followerCount($target),
        ]);
    }

    public function destroy(Request $request, string $publicId): JsonResponse
    {
        $target = $this->target($publicId);

        $this->follows->unfollow($request->user(), $target);

        return response()->json([
            'following' => false,
            'followers' => $this->follows->followerCount($target),
        ]);
    }

    private function target(string $publicId): User
    {
        $user = User::query()->where('public_id', $publicId)->firstOrFail();

        // Same rule as the profile page: a banned account is not there.
        abort_if($user->is_banned, 404);

        return $user;
    }
}
