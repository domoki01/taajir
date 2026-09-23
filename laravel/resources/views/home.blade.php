<x-layout.app>
    <x-layout.header />

    <main class="flex-1 py-6">
        <x-layout.container>
            <x-promo-carousel :promos="$promos" />

            {{-- The search, at the top of the page, under the paid slots.

                 This is what people come here to do. It used to live only on
                 /recherche, reachable through a link in the menu, which asked a
                 visitor to know the site had a search before they could use it.
                 It submits to /recherche: the home page keeps one canonical URL
                 and the results live on the page that is noindex for exactly
                 that reason.

                 The listings stay below it. Most people look before they
                 search, and a home page that is only a form tells a visitor
                 nothing about what is on the site. --}}
            <x-search-form :heading="__('listing.search_title')" class="mt-4" />

            @if (count($featured) > 0)
                <section class="mt-10">
                    <h2 class="text-lg font-extrabold">{{ __('listing.featured_listings') }}</h2>
                    <div class="mt-3">
                        <x-listing.grid :listings="$featured" />
                    </div>
                </section>
            @endif

            <section class="mt-10">
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
