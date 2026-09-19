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

            <form method="GET" action="{{ \App\Support\Nav::href('/recherche') }}" class="rounded-card border-border bg-surface shadow-soft mt-4 border p-4">
                <div class="grid gap-3 md:grid-cols-4">
                    <input
                        type="search"
                        name="q"
                        value="{{ $filters['q'] ?? '' }}"
                        placeholder="{{ __('listing.search_placeholder') }}"
                        class="rounded-input border-border w-full border px-3 py-2.5 text-sm md:col-span-2"
                    >

                    <select name="transaction" class="rounded-input border-border w-full border px-3 py-2.5 text-sm">
                        <option value="">{{ __('listing.any_transaction') }}</option>
                        @foreach ($taxonomy->visibleOptions()['transactionTypes'] as $option)
                            <option value="{{ $option['slug'] }}" @selected(($filters['transaction'] ?? '') === $option['slug'])>{{ $option['label'] }}</option>
                        @endforeach
                    </select>

                    <select name="type" class="rounded-input border-border w-full border px-3 py-2.5 text-sm">
                        <option value="">{{ __('listing.any_type') }}</option>
                        @foreach ($taxonomy->visibleOptions()['propertyTypes'] as $option)
                            <option value="{{ $option['slug'] }}" @selected(($filters['type'] ?? '') === $option['slug'])>{{ $option['label'] }}</option>
                        @endforeach
                    </select>

                    <select name="wilaya" class="rounded-input border-border w-full border px-3 py-2.5 text-sm">
                        <option value="">{{ __('listing.any_wilaya') }}</option>
                        @foreach ($wilayas as $wilaya)
                            <option value="{{ $wilaya->slug }}" @selected(($filters['wilaya'] ?? '') === $wilaya->slug)>{{ $wilaya->name() }}</option>
                        @endforeach
                    </select>

                    {{-- Typed in dinars, stored in dinars. The ملايين
                         convention belongs to display, never to an input the
                         server parses. --}}
                    <input type="number" inputmode="numeric" name="priceMin" value="{{ $filters['priceMin'] ?? '' }}"
                        placeholder="{{ __('listing.price_min') }}"
                        class="rounded-input border-border ltr-nums w-full border px-3 py-2.5 text-sm">

                    <input type="number" inputmode="numeric" name="priceMax" value="{{ $filters['priceMax'] ?? '' }}"
                        placeholder="{{ __('listing.price_max') }}"
                        class="rounded-input border-border ltr-nums w-full border px-3 py-2.5 text-sm">

                    <select name="sort" class="rounded-input border-border w-full border px-3 py-2.5 text-sm">
                        <option value="">{{ __('listing.sort_newest') }}</option>
                        <option value="price_asc" @selected(($filters['sort'] ?? '') === 'price_asc')>{{ __('listing.sort_price_asc') }}</option>
                        <option value="price_desc" @selected(($filters['sort'] ?? '') === 'price_desc')>{{ __('listing.sort_price_desc') }}</option>
                    </select>
                </div>

                <div class="mt-3 flex gap-2">
                    <button type="submit" class="bg-accent rounded-input px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90">
                        {{ __('listing.apply') }}
                    </button>
                    <a href="{{ \App\Support\Nav::href('/recherche') }}" class="text-muted rounded-input border-border border px-5 py-2.5 text-sm font-bold">
                        {{ __('listing.reset') }}
                    </a>
                </div>
            </form>

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
