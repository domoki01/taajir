{{-- ── DESKTOP HEADER ───────────────────────────────────────────────────────
     Desktop only. On a phone the bottom bar *is* the menu, and a branding bar
     above it would spend 64px of a small screen restating a logo.

     The destinations come from the same list the bottom bar renders, so the two
     cannot drift into a desktop menu and a phone menu that reach different
     pages. --}}
@php($path = \App\Support\Nav::currentPath())

<header class="bg-surface/90 border-border sticky top-0 z-40 hidden border-b backdrop-blur md:block">
    <div class="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        {{-- The four links to the right of the logo are the frequent
             destinations; the panel is everything else the site has. --}}
        <x-layout.menu-trigger class="-ms-2" />

        {{-- The name and the mark come from the branding screen when an admin
             has saved one, and from the build otherwise. The legal pages keep
             the lang-file name on purpose: those are prose about a named
             entity, and renaming the site should not silently rewrite the
             terms somebody agreed to. --}}
        @php($branding = \App\Services\Branding::current())
        <a href="{{ \App\Support\Nav::href('/') }}" class="flex items-center gap-2">
            @if ($branding->logoUrl)
                <img src="{{ $branding->logoUrl }}" alt="" class="size-9 rounded-[12px] object-contain">
            @else
                <span class="bg-primary grid size-9 place-items-center rounded-[12px] text-white">
                    <x-icon.building-2 class="size-5" stroke-width="2.4" />
                </span>
            @endif
            <span class="text-lg font-extrabold tracking-tight">{{ $branding->siteName }}</span>
        </a>

        <nav aria-label="{{ __('nav.navigation') }}" class="text-muted ms-auto flex items-center gap-6 text-sm font-semibold">
            @foreach (\App\Support\Nav::items() as $item)
                @php($active = \App\Support\Nav::isCurrent($path, $item))
                <a
                    href="{{ \App\Support\Nav::href($item['href']) }}"
                    @if ($active) aria-current="page" @endif
                    class="transition-colors {{ $active ? 'text-primary font-extrabold' : 'hover:text-primary' }}"
                >{{ $item['label'] }}</a>
            @endforeach
        </nav>

        {{-- "الوكالات" stays hidden until agency profiles exist — a link that
             404s is worse than no link. --}}
        <a
            href="{{ \App\Support\Nav::href(\App\Support\Nav::PUBLISH_HREF) }}"
            class="bg-accent rounded-input ms-1 inline-flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
            <x-icon.plus class="size-4" stroke-width="3" />
            {{ __('nav.publish') }}
        </a>
    </div>
</header>
