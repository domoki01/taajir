{{-- Free-form filtering.

     noindex on purpose: this page can express an unbounded number of filter
     permutations, and letting a crawler walk them is how a site ends up
     competing with itself for every query. The clean, canonical combinations
     are the browse routes. --}}
<x-layout.app :title="__('listing.search_title')">
    <x-layout.header />

    <main class="flex-1 py-6">
        <x-layout.container>
            <h1 class="text-xl font-black">{{ __('listing.search_title') }}</h1>

            <x-search-form :filters="$filters" class="mt-4" />

            <p class="text-muted ltr-nums mt-5 text-sm font-semibold">
                {{ __('listing.count', ['count' => $results->total()]) }}
            </p>

            <div class="mt-3">
                <x-listing.grid :listings="$results" />
            </div>

            <div class="mt-6">{{ $results->links() }}</div>
        </x-layout.container>
    </main>

    @push('head')
        <meta name="robots" content="noindex, follow">
    @endpush
</x-layout.app>
