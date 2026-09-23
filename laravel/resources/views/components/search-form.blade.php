{{-- The advanced search, in one place.

     Used by the home page and by /recherche. It was written only on the search
     page, and copying it onto the home page would have left two forms to keep
     in step — the sort of duplication that is invisible until one of them
     quietly stops offering a filter the other has.

     It always submits to /recherche. The home page stays a landing page with
     one canonical URL, and results live on the page whose job is results and
     which is noindex for exactly that reason.

     Geo and Taxonomy are read here rather than passed in: both cache in the
     process, so this costs nothing, and a component that asks for what it
     needs cannot be rendered by a controller that forgot to provide it. --}}
@props(['filters' => [], 'heading' => null])

@php
    $wilayas = \App\Services\Geo::wilayas();
    $options = \App\Services\Taxonomy::current()->visibleOptions();
@endphp

<form method="GET" action="{{ \App\Support\Nav::href('/recherche') }}"
    {{ $attributes->merge(['class' => 'rounded-card border-border bg-surface shadow-soft border p-4']) }}>

    @if ($heading)
        <h2 class="mb-3 text-base font-black">{{ $heading }}</h2>
    @endif

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
            @foreach ($options['transactionTypes'] as $option)
                <option value="{{ $option['slug'] }}" @selected(($filters['transaction'] ?? '') === $option['slug'])>{{ $option['label'] }}</option>
            @endforeach
        </select>

        <select name="type" class="rounded-input border-border w-full border px-3 py-2.5 text-sm">
            <option value="">{{ __('listing.any_type') }}</option>
            @foreach ($options['propertyTypes'] as $option)
                <option value="{{ $option['slug'] }}" @selected(($filters['type'] ?? '') === $option['slug'])>{{ $option['label'] }}</option>
            @endforeach
        </select>

        <select name="wilaya" class="rounded-input border-border w-full border px-3 py-2.5 text-sm">
            <option value="">{{ __('listing.any_wilaya') }}</option>
            @foreach ($wilayas as $wilaya)
                <option value="{{ $wilaya->slug }}" @selected(($filters['wilaya'] ?? '') === $wilaya->slug)>{{ $wilaya->name() }}</option>
            @endforeach
        </select>

        {{-- Typed in dinars, stored in dinars. The ملايين convention belongs
             to display, never to an input the server parses. --}}
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
