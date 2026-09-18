{{-- The browse page for one clean combination of deal, property type and place.

     Phase 2 builds the routing: the segments resolve against the live taxonomy
     and the seeded geography, and anything else is a 404. The results grid and
     the filter panel arrive in phase 4 with the listings read path — there is
     no listings table yet, and a hard-coded "0 إعلان" would be a claim this
     page cannot make. --}}
<x-layout.app :title="$heading" :description="'تصفّح إعلانات '.$heading.' على '.config('taajir.site_name').': أسعار، مساحات، صور ووثائق، من الملاك مباشرة ومن الوكالات.'">
    <x-layout.header />

    <main class="flex-1 py-8">
        <x-layout.container>
            <nav aria-label="مسار التصفّح" class="text-dim mb-3 text-xs font-semibold">
                <a href="/" class="hover:text-primary">الرئيسية</a>
                <span class="mx-1.5">/</span>
                <a href="/{{ $transaction }}" class="hover:text-primary">{{ $taxonomy->transactionTypes[$transaction] }}</a>
                @if ($wilaya)
                    <span class="mx-1.5">/</span>
                    <span>{{ $wilaya->name_ar }}</span>
                @endif
            </nav>

            <h1 class="text-2xl font-black md:text-3xl">{{ $heading }}</h1>

            @if ($commune)
                <p class="text-muted mt-1 text-sm font-semibold">{{ \App\Services\Geo::placeLabel($wilaya->slug, $commune) }}</p>
            @endif

            {{-- Internal links are what get the long tail of wilaya pages crawled
                 at all; without them these routes exist but are unreachable. --}}
            <section class="mt-12">
                <h2 class="text-base font-extrabold">{{ $taxonomy->transactionTypes[$transaction] }} حسب الولاية</h2>
                <ul class="mt-3 flex flex-wrap gap-2">
                    @foreach (\App\Services\Geo::wilayas()->take(24) as $w)
                        <li>
                            <a
                                href="/{{ $transaction }}/{{ $propertyType ?? 'appartement' }}/{{ $w->slug }}"
                                class="rounded-input border-border bg-surface hover:border-primary inline-block border px-3 py-1.5 text-xs font-semibold transition-colors"
                            >{{ $w->name_ar }}</a>
                        </li>
                    @endforeach
                </ul>
            </section>
        </x-layout.container>
    </main>
</x-layout.app>
