{{-- «إعلاناتي» — every ad this account has, in every state.

     Including the rejected ones, with the reason. An owner who cannot see why
     their ad was refused posts the same thing again. --}}
<x-layout.app :title="__('listing.my_listings')">
    <x-layout.header />

    <main class="flex-1 py-6">
        <x-layout.container max="max-w-3xl">
            <h1 class="text-xl font-black">{{ __('listing.my_listings') }}</h1>

            <ul class="mt-5 space-y-3">
                @forelse ($listings as $listing)
                    <li class="rounded-card border-border bg-surface shadow-soft border p-4">
                        <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0">
                                <p class="text-primary ltr-nums text-sm font-black">{{ $listing->formattedPrice() }}</p>
                                <h2 class="mt-0.5 truncate text-sm font-bold">{{ $listing->title }}</h2>
                                <p class="text-dim mt-1 text-xs">{{ $listing->placeLabel() }}</p>
                            </div>
                            <span class="bg-surface-soft text-muted shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold">
                                {{ $listing->status()->label() }}
                            </span>
                        </div>

                        @if ($listing->rejection_reason)
                            <p class="rounded-input bg-danger/10 text-danger mt-3 px-3 py-2 text-xs leading-relaxed font-semibold">
                                {{ $listing->rejection_reason }}
                            </p>
                        @endif

                        @if ($listing->status === 'published')
                            <a href="{{ \App\Support\Nav::href($listing->path()) }}" class="text-primary mt-2 inline-block text-xs font-bold">
                                {{ __('listing.view_listing') }}
                            </a>
                        @endif
                    </li>
                @empty
                    <li class="rounded-card border-border bg-surface border border-dashed px-6 py-12 text-center font-bold">
                        {{ __('listing.none') }}
                    </li>
                @endforelse
            </ul>

            <div class="mt-6">{{ $listings->links() }}</div>
        </x-layout.container>
    </main>
</x-layout.app>
