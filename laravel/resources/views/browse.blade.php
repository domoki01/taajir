{{-- The browse page for one clean combination of deal, property type and place.

     These are the indexable pages — the ones a search for "كراء شقة باب الزوار"
     is meant to land on. Free-form filtering lives at /recherche, which is
     noindex, so a crawler only ever sees these clean combinations. --}}
<x-layout.app
    :title="$heading"
    :description="__('browse.meta_description', ['heading' => $heading, 'site' => __('brand.name')])"
>
    <x-layout.header />

    <main class="flex-1 py-8">
        <x-layout.container>
            <nav aria-label="{{ __('nav.breadcrumb') }}" class="text-dim mb-3 text-xs font-semibold">
                <a href="{{ \App\Support\Nav::href('/') }}" class="hover:text-primary">{{ __('nav.home') }}</a>
                <span class="mx-1.5">/</span>
                <a href="{{ \App\Support\Nav::href('/'.$transaction) }}" class="hover:text-primary">{{ $taxonomy->transactionTypes[$transaction] }}</a>
                @if ($wilaya)
                    <span class="mx-1.5">/</span>
                    <span>{{ $wilaya->name() }}</span>
                @endif
            </nav>

            <h1 class="text-2xl font-black md:text-3xl">{{ $heading }}</h1>

            @if ($commune)
                <p class="text-muted mt-1 text-sm font-semibold">{{ \App\Services\Geo::placeLabel($wilaya->slug, $commune) }}</p>
            @endif

            <p class="text-muted ltr-nums mt-1 text-sm font-semibold">
                {{ __('listing.count', ['count' => $results->total()]) }}
            </p>

            <div class="mt-5">
                <x-listing.grid :listings="$results" />
            </div>

            <div class="mt-6">
                {{ $results->links() }}
            </div>

            {{-- Internal links are what get the long tail of wilaya pages crawled
                 at all; without them these routes exist but are unreachable. --}}
            <section class="mt-12">
                <h2 class="text-base font-extrabold">{{ __('browse.by_wilaya', ['deal' => $taxonomy->transactionTypes[$transaction]]) }}</h2>
                <ul class="mt-3 flex flex-wrap gap-2">
                    @foreach (\App\Services\Geo::wilayas()->take(24) as $w)
                        <li>
                            <a
                                href="{{ \App\Support\Nav::href('/'.$transaction.'/'.($propertyType ?? 'appartement').'/'.$w->slug) }}"
                                class="rounded-input border-border bg-surface hover:border-primary inline-block border px-3 py-1.5 text-xs font-semibold transition-colors"
                            >{{ $w->name() }}</a>
                        </li>
                    @endforeach
                </ul>
            </section>
        </x-layout.container>
    </main>
</x-layout.app>
