{{-- The paid slots on the home page.

     A scroll-snap strip rather than an auto-advancing carousel: a banner that
     moves on its own is one a reader has to catch, and on a phone the swipe is
     the gesture they already have. Nothing here is JavaScript.

     Each slot is exactly one card of the grid below — same track width, same
     gap, same 4/3 box — so the strip reads as the first row of the page rather
     than a billboard above it. It was 88% of the viewport, which made a single
     promo a full-width hero and pushed every real ad below the fold: the widths
     below are the grid's own (grid-cols-2 / md:3 / lg:4 at gap-3) worked out as
     flex bases, because a flex row is what scrolls and a grid is not.

     `safe center` is what centres two promos and still shows the first one when
     there are nine: plain `center` on an overflowing row pushes the start of
     the content out of reach in every browser, and there is no scrolling back
     to it. --}}
@props(['promos'])

@if ($promos->isNotEmpty())
    <section aria-label="{{ __('promo.label') }}" class="mt-4">
        <ul class="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [justify-content:safe_center] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            @foreach ($promos as $promo)
                <li class="shrink-0 basis-[calc(50%-0.375rem)] snap-start md:basis-[calc(33.3333%-0.5rem)] lg:basis-[calc(25%-0.5625rem)]">
                    {{-- An external banner opens beside the site and carries
                         noopener: the destination is an advertiser's page, and
                         window.opener would be theirs to use. --}}
                    <a href="{{ $promo->link_url }}"
                        @if ($promo->isExternal()) target="_blank" rel="noopener nofollow sponsored" @endif
                        class="rounded-card shadow-soft bg-surface-soft block overflow-hidden">
                        {{-- The card's own box, and `contain` inside it.
                             `cover` would crop whatever an advertiser sent to
                             4/3, and what gets cropped off a promo is the text
                             — the one part of it that had to be read. Art
                             supplied at 4/3 fills the frame with nothing
                             showing. --}}
                        <div class="aspect-[4/3]">
                            <img src="{{ $promo->image_url }}" alt="{{ $promo->title }}"
                                width="{{ $promo->width }}" height="{{ $promo->height }}"
                                loading="lazy" decoding="async"
                                class="h-full w-full object-contain">
                        </div>
                    </a>
                </li>
            @endforeach
        </ul>
    </section>
@endif
