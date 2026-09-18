{{-- ── MOBILE BOTTOM NAVIGATION ─────────────────────────────────────────────
     The whole menu on a phone. The header is gone below `md`, so this is not a
     shortcut bar sitting under a top bar — it is the navigation, and every
     destination someone reaches often has to be in it. --}}
@php
    $path = \App\Support\Nav::currentPath();
    $items = \App\Support\Nav::items();

    // The first match wins, so two destinations never both claim aria-current.
    $current = null;
    foreach ($items as $item) {
        if (\App\Support\Nav::isCurrent($path, $item)) {
            $current = $item['href'];
            break;
        }
    }
@endphp

@unless (\App\Support\Nav::isImmersiveRoute($path))
    {{-- Occupies the space the fixed bar hovers over, so the page's own footer is
         never hidden underneath it. Kept inside this component rather than as
         padding on <body> — that would leave a gap on the immersive routes where
         the bar does not render. --}}
    <div aria-hidden="true" class="h-[calc(4.5rem+env(safe-area-inset-bottom))] md:hidden"></div>

    {{-- Less translucent than a desktop header would be. This one sits over
         whatever is scrolling underneath it, and an 11px label stops being
         readable the moment a white card slides behind it. The blur keeps the
         glass feel, the opacity keeps the text. --}}
    <nav
        aria-label="التنقّل السريع"
        class="rounded-t-sheet border-border bg-surface/95 shadow-lifted fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-xl md:hidden"
        style="padding-bottom: env(safe-area-inset-bottom)"
    >
        <ul class="mx-auto flex max-w-md items-stretch justify-between px-2">
            @foreach (array_slice($items, 0, 2) as $item)
                <x-layout.nav-tab :item="$item" :current="$current" />
            @endforeach

            {{-- ── THE ACTION ───────────────────────────────────────────────
                 Emerald belongs to filled action buttons and nothing else. This
                 is the one thing in the bar you press to *do* something rather
                 than to go somewhere, so it is the only green here; the moment a
                 destination borrows the colour, this stops reading as a button. --}}
            <li class="flex items-start">
                <a
                    href="{{ \App\Support\Nav::PUBLISH_HREF }}"
                    aria-label="نشر إعلان"
                    class="bg-accent shadow-lifted ring-bg grid size-14 -translate-y-5 place-items-center rounded-full text-white ring-4 transition-transform hover:opacity-95 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                    <x-icon.plus class="size-7" stroke-width="3" />
                </a>
            </li>

            @foreach (array_slice($items, 2) as $item)
                <x-layout.nav-tab :item="$item" :current="$current" />
            @endforeach
        </ul>
    </nav>
@endunless
