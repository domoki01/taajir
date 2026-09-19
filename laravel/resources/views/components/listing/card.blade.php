{{-- One ad in a results grid.

     Everything on it is read straight off the listing row — the owner's name,
     the cover image, the place — because those are denormalised at write time
     precisely so a page of twenty-four cards is one query. --}}
@props(['listing'])

<article class="rounded-card border-border bg-surface shadow-soft hover:shadow-lifted overflow-hidden border transition-shadow">
    <a href="{{ \App\Support\Nav::href($listing->path()) }}" class="block">
        <div class="bg-surface-soft relative aspect-[4/3]">
            @if ($listing->cover_url)
                <img src="{{ $listing->cover_url }}" alt="{{ $listing->title }}" loading="lazy" class="h-full w-full object-cover">
            @else
                {{-- No photo is normal here; plenty of ads are posted without
                     one. A grey box with the site mark reads better than a
                     broken image. --}}
                <div class="text-dim grid h-full place-items-center">
                    <x-icon.building-2 class="size-8" stroke-width="1.5" />
                </div>
            @endif

            @if ($listing->is_featured)
                {{-- Navy, not emerald: a badge is information, not something
                     you press. --}}
                <span class="bg-primary absolute start-2 top-2 rounded-full px-2.5 py-1 text-[11px] font-bold text-white">
                    {{ __('listing.featured') }}
                </span>
            @endif
        </div>

        <div class="p-3">
            <p class="text-primary ltr-nums text-base font-black">{{ $listing->formattedPrice() }}</p>

            <h3 class="mt-1 line-clamp-2 text-sm leading-snug font-bold">{{ $listing->title }}</h3>

            <p class="text-dim mt-1.5 flex items-center gap-1 text-xs font-semibold">
                <x-icon.map-pin class="size-3.5 shrink-0" />
                <span class="truncate">{{ $listing->placeLabel() }}</span>
            </p>

            <div class="text-muted ltr-nums mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold">
                @if ($listing->rooms_code)
                    <span>{{ $listing->rooms_code }}</span>
                @endif
                @if ($listing->area_built)
                    <span>{{ $listing->area_built }} m²</span>
                @elseif ($listing->area_land)
                    <span>{{ $listing->area_land }} m²</span>
                @endif
            </div>
        </div>
    </a>
</article>
