<x-layout.app>
    <x-layout.header />

    <main class="flex-1 py-6">
        <x-layout.container>
            <x-promo-carousel :promos="$promos" />

            @if (count($featured) > 0)
                <section>
                    <h2 class="text-lg font-extrabold">{{ __('listing.featured_listings') }}</h2>
                    <div class="mt-3">
                        <x-listing.grid :listings="$featured" />
                    </div>
                </section>
            @endif

            <section class="{{ count($featured) > 0 ? 'mt-10' : '' }}">
                <h2 class="text-lg font-extrabold">{{ __('listing.latest') }}</h2>
                <div class="mt-3">
                    <x-listing.grid :listings="$latest" />
                </div>
            </section>

            {{-- The wilaya shortcuts. Ordered by population weight rather than
                 by code, so they are useful instead of alphabetical — and they
                 are what gets the long tail of wilaya pages crawled at all. --}}
            <section class="mt-12">
                <h2 class="text-base font-extrabold">{{ __('listing.browse_by_wilaya') }}</h2>
                <ul class="mt-3 flex flex-wrap gap-2">
                    @foreach ($wilayas as $wilaya)
                        <li>
                            <a
                                href="{{ \App\Support\Nav::href('/vente/appartement/'.$wilaya->slug) }}"
                                class="rounded-input border-border bg-surface hover:border-primary inline-block border px-3 py-1.5 text-xs font-semibold transition-colors"
                            >{{ $wilaya->name() }}</a>
                        </li>
                    @endforeach
                </ul>
            </section>
        </x-layout.container>
    </main>
</x-layout.app>
