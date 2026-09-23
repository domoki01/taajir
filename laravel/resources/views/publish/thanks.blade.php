{{-- Where the ad landed, in its own words.

     Three outcomes and three different things to say. Telling someone their ad
     is published when a moderator still has to see it is how a site earns a
     reputation for lying. --}}
<x-layout.app :title="__('listing.publish_title')">
    <main class="flex flex-1 items-center py-10">
        <x-layout.container max="max-w-sm">
            <div class="rounded-card border-border bg-surface shadow-soft border p-6 text-center">
                <p class="text-base font-black">
                    @switch($status)
                        @case(\App\Enums\ListingStatus::Published)
                            {{ __('listing.thanks_published') }}
                            @break
                        @case(\App\Enums\ListingStatus::PendingLaunch)
                            {{ __('listing.thanks_held') }}
                            @break
                        @default
                            {{ __('listing.thanks_pending') }}
                    @endswitch
                </p>

                <div class="mt-6 space-y-2">
                    @if ($status === \App\Enums\ListingStatus::Published)
                        <a href="{{ \App\Support\Nav::href($listing->path()) }}"
                            class="bg-accent rounded-input block py-3 text-sm font-bold text-white">
                            {{ __('listing.view_listing') }}
                        </a>
                    @endif

                    <a href="{{ \App\Support\Nav::href('/tableau-de-bord/annonces') }}"
                        class="rounded-input border-border text-primary block border py-3 text-sm font-bold">
                        {{ __('listing.my_listings') }}
                    </a>
                </div>
            </div>
        </x-layout.container>
    </main>
</x-layout.app>
