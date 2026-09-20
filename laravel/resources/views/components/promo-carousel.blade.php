{{-- The paid slots on the home page.

     A scroll-snap strip rather than an auto-advancing carousel: a banner that
     moves on its own is one a reader has to catch, and on a phone the swipe is
     the gesture they already have. Nothing here is JavaScript. --}}
@props(['promos'])

@if ($promos->isNotEmpty())
    <section aria-label="{{ __('promo.label') }}" class="mt-4">
        <ul class="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            @foreach ($promos as $promo)
                <li class="w-[88%] shrink-0 snap-start sm:w-[60%]">
                    {{-- An external banner opens beside the site and carries
                         noopener: the destination is an advertiser's page, and
                         window.opener would be theirs to use. --}}
                    <a href="{{ $promo->link_url }}"
                        @if ($promo->isExternal()) target="_blank" rel="noopener nofollow sponsored" @endif
                        class="rounded-card shadow-soft block overflow-hidden">
                        <img src="{{ $promo->image_url }}" alt="{{ $promo->title }}"
                            width="{{ $promo->width }}" height="{{ $promo->height }}"
                            loading="lazy" decoding="async"
                            class="w-full object-cover">
                    </a>
                </li>
            @endforeach
        </ul>
    </section>
@endif
