{{-- ── THE SIDE MENU ────────────────────────────────────────────────────────
     Every page on the site, in one panel, reachable from every screen.

     The site's navigation is four destinations: that is the right number for a
     bottom bar, and the wrong number for "show me what this site has". Removing
     the footer took the last link to the legal pages with it. This panel is the
     answer to both — the four stay where they are, and everything else lives one
     tap away instead of nowhere.

     One panel, two triggers. The header owns the desktop trigger and the mobile
     top bar owns the phone one, and both flip the same Alpine store, so the
     document never holds two `aria-modal` dialogs at once.

     The React version closed the panel from each link's own onClick, because a
     link to the page you are already on changes no path and an effect keyed on
     it would leave the panel sitting there looking stuck. Here every link is a
     full page load, so the panel is gone either way. --}}
@props(['deals' => []])

@php
    $path = \App\Support\Nav::currentPath();
    $locale = \App\Enums\Locale::current();
@endphp

{{-- Backdrop and panel stay mounted so the slide has something to animate from;
     `invisible` keeps them out of the tab order when shut. --}}
<div
    x-data
    x-bind:aria-hidden="$store.menu.open ? 'false' : 'true'"
    x-bind:class="{ 'visible opacity-100': $store.menu.open, 'invisible opacity-0': ! $store.menu.open }"
    x-on:keydown.escape.window="$store.menu.open && $store.menu.hide()"
    class="invisible fixed inset-0 z-50 opacity-0 transition-opacity duration-200 motion-reduce:transition-none"
>
    <button
        type="button"
        x-bind:tabindex="$store.menu.open ? 0 : -1"
        x-on:click="$store.menu.hide()"
        aria-label="{{ __('nav.close_menu') }}"
        class="absolute inset-0 h-full w-full cursor-default bg-black/40"
    ></button>

    <div
        role="dialog"
        aria-modal="true"
        aria-label="{{ __('nav.site_menu') }}"
        tabindex="-1"
        {{-- Focus moves into the panel so the keyboard and the screen reader
             follow it; without this, tabbing continues behind the overlay. --}}
        x-effect="$store.menu.open && $el.focus()"
        x-bind:class="{ 'translate-x-0': $store.menu.open, 'ltr:-translate-x-full rtl:translate-x-full': ! $store.menu.open }"
        class="bg-surface absolute inset-y-0 start-0 flex w-[86%] max-w-xs flex-col shadow-2xl transition-transform duration-200 outline-none ltr:-translate-x-full rtl:translate-x-full motion-reduce:transition-none"
    >
        <div class="border-border flex items-start gap-2 border-b px-4 py-4">
            <div class="min-w-0 flex-1">
                <p class="text-lg leading-tight font-black">{{ \App\Services\Branding::current()->siteName }}</p>
                <p class="text-dim mt-0.5 text-xs leading-snug">{{ \App\Services\Branding::current()->tagline }}</p>
            </div>
            <button
                type="button"
                x-bind:tabindex="$store.menu.open ? 0 : -1"
                x-on:click="$store.menu.hide()"
                aria-label="{{ __('nav.close') }}"
                class="text-dim hover:text-primary -me-1 grid size-9 shrink-0 place-items-center rounded-full transition-colors"
            >
                <x-icon.x class="size-5" />
            </button>
        </div>

        {{-- The one filled button in the panel. Everything else is a link, so
             what someone is here to *do* stays visually separate from where they
             can go. --}}
        <div class="px-4 pt-4">
            <a
                href="{{ \App\Support\Nav::href(\App\Support\Nav::PUBLISH_HREF) }}"
                x-bind:tabindex="$store.menu.open ? 0 : -1"
                class="bg-accent rounded-input flex items-center justify-center gap-2 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
                <x-icon.plus class="size-4" stroke-width="3" />
                {{ __('nav.publish') }}
            </a>
        </div>

        <nav aria-label="{{ __('nav.all_pages') }}" class="flex-1 overflow-y-auto px-2 py-3">
            <x-layout.menu-section :title="__('nav.section_browse')" :links="\App\Support\Nav::browseLinks($deals)" :path="$path" />
            <x-layout.menu-section :title="__('nav.section_account')" :links="\App\Support\Nav::accountLinks()" :path="$path" />
            <x-layout.menu-section :title="__('nav.section_platform')" :links="\App\Support\Nav::infoLinks()" :path="$path" />

            {{-- The switcher stays inside the panel rather than in a bar. It is
                 something you touch once, on your first visit, and a permanent
                 control for it would spend header room that four destinations
                 already compete for. Each option links to *this* page in that
                 language, not to the home page: being thrown back to the start
                 of the site is the thing a language switcher most often gets
                 wrong. --}}
            <div class="mb-1">
                <h2 class="text-dim px-3 pt-3 pb-1 text-[11px] font-extrabold tracking-wide">{{ __('nav.language') }}</h2>
                <ul class="flex flex-wrap gap-2 px-3 pt-1">
                    @foreach (\App\Enums\Locale::cases() as $option)
                        <li>
                            <a
                                href="{{ $option->path($path) }}"
                                hreflang="{{ $option->htmlLang() }}"
                                lang="{{ $option->htmlLang() }}"
                                dir="{{ $option->direction() }}"
                                x-bind:tabindex="$store.menu.open ? 0 : -1"
                                @if ($option === $locale) aria-current="true" @endif
                                class="rounded-input inline-block border px-3 py-1.5 text-xs font-bold transition-colors {{ $option === $locale ? 'border-primary bg-primary-soft text-primary' : 'border-border text-muted hover:border-primary' }}"
                            >{{ $option->nativeName() }}</a>
                        </li>
                    @endforeach
                </ul>
            </div>
        </nav>

        <div class="border-border border-t px-4 py-3">
            <a href="{{ \App\Support\Nav::href('/inscription') }}" x-bind:tabindex="$store.menu.open ? 0 : -1" class="text-primary text-sm font-bold">{{ __('nav.sign_up') }}</a>
            <span class="text-dim mx-2 text-sm">·</span>
            <a href="{{ \App\Support\Nav::href('/connexion') }}" x-bind:tabindex="$store.menu.open ? 0 : -1" class="text-primary text-sm font-bold">{{ __('nav.sign_in') }}</a>
        </div>
    </div>
</div>
