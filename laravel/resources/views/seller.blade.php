{{-- Somebody's public page: who they are, what they have posted, and a button
     to hear about the next one. --}}
<x-layout.app :title="$seller->display_name">
    <x-layout.header />

    <main class="flex-1 py-6">
        <x-layout.container>
            <header class="rounded-card border-border bg-surface flex flex-wrap items-center gap-4 border p-5">
                @if ($seller->photo_url)
                    <img src="{{ $seller->photo_url }}" alt="" width="64" height="64"
                         class="h-16 w-16 rounded-full object-cover" loading="lazy">
                @else
                    <span class="bg-primary/10 text-primary flex h-16 w-16 items-center justify-center rounded-full text-xl font-black">
                        {{ mb_substr($seller->display_name, 0, 1) }}
                    </span>
                @endif

                <div class="min-w-0 flex-1">
                    <h1 class="truncate text-lg font-black">{{ $seller->display_name }}</h1>
                    <p class="text-dim ltr-nums mt-0.5 text-xs">
                        <span x-text="followers">{{ $followerCount }}</span> {{ __('follow.followers') }}
                        @if ($seller->created_at)
                            · {{ __('follow.member_since', ['date' => $seller->created_at->translatedFormat('F Y')]) }}
                        @endif
                    </p>
                </div>

                {{-- The only filled button on the page, because it is the only
                     thing here you press. --}}
                @if (! $isSelf)
                    <div x-data="followButton(@js($seller->public_id), @js($isFollowing), @js($followerCount), @js((bool) auth()->check()))">
                        <button type="button" x-on:click="toggle()" x-bind:disabled="busy"
                                x-bind:class="following
                                    ? 'border-border text-primary border bg-transparent'
                                    : 'bg-accent text-white'"
                                class="rounded-input px-5 py-2.5 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-60">
                            <span x-text="following ? @js(__('follow.following')) : @js(__('follow.follow'))"></span>
                        </button>
                        <p x-show="error" x-cloak x-text="error" class="text-danger mt-1 text-xs font-semibold"></p>
                    </div>
                @endif
            </header>

            <h2 class="mt-8 text-base font-black">{{ __('follow.listings') }}</h2>

            @if ($listings->isEmpty())
                <p class="rounded-card border-border bg-surface text-dim mt-3 border border-dashed px-6 py-10 text-center text-sm font-bold">
                    {{ __('follow.no_listings') }}
                </p>
            @else
                <div class="mt-3"><x-listing.grid :listings="$listings" /></div>
                <div class="mt-6">{{ $listings->links() }}</div>
            @endif

            @if ($requests->isNotEmpty())
                <h2 class="mt-8 text-base font-black">{{ __('follow.requests') }}</h2>

                <ul class="mt-3 space-y-2">
                    @foreach ($requests as $demand)
                        <li class="rounded-card border-border bg-surface border">
                            <a href="{{ \App\Support\Nav::href('/demandes/'.$demand->id) }}" class="block p-4">
                                <p class="text-sm font-bold">{{ $demand->title }}</p>
                                <p class="text-dim mt-1 line-clamp-2 text-sm leading-relaxed">{{ $demand->description }}</p>
                            </a>
                        </li>
                    @endforeach
                </ul>
            @endif
        </x-layout.container>
    </main>
</x-layout.app>
