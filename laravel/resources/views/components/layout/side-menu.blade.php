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

@php($path = \App\Support\Nav::currentPath())

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
        aria-label="إغلاق القائمة"
        class="absolute inset-0 h-full w-full cursor-default bg-black/40"
    ></button>

    <div
        role="dialog"
        aria-modal="true"
        aria-label="قائمة الموقع"
        tabindex="-1"
        {{-- Focus moves into the panel so the keyboard and the screen reader
             follow it; without this, tabbing continues behind the overlay. --}}
        x-effect="$store.menu.open && $el.focus()"
        x-bind:class="{ 'translate-x-0': $store.menu.open, 'ltr:-translate-x-full rtl:translate-x-full': ! $store.menu.open }"
        class="bg-surface absolute inset-y-0 start-0 flex w-[86%] max-w-xs flex-col shadow-2xl transition-transform duration-200 outline-none ltr:-translate-x-full rtl:translate-x-full motion-reduce:transition-none"
    >
        <div class="border-border flex items-start gap-2 border-b px-4 py-4">
            <div class="min-w-0 flex-1">
                <p class="text-lg leading-tight font-black">{{ config('taajir.site_name') }}</p>
                <p class="text-dim mt-0.5 text-xs leading-snug">{{ config('taajir.site_tagline') }}</p>
            </div>
            <button
                type="button"
                x-bind:tabindex="$store.menu.open ? 0 : -1"
                x-on:click="$store.menu.hide()"
                aria-label="إغلاق"
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
                href="{{ \App\Support\Nav::PUBLISH_HREF }}"
                x-bind:tabindex="$store.menu.open ? 0 : -1"
                class="bg-accent rounded-input flex items-center justify-center gap-2 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
                <x-icon.plus class="size-4" stroke-width="3" />
                نشر إعلان
            </a>
        </div>

        <nav aria-label="كل الصفحات" class="flex-1 overflow-y-auto px-2 py-3">
            <x-layout.menu-section title="تصفّح" :links="\App\Support\Nav::browseLinks($deals)" :path="$path" />
            <x-layout.menu-section title="حسابي" :links="\App\Support\Nav::accountLinks()" :path="$path" />
            <x-layout.menu-section title="المنصّة" :links="\App\Support\Nav::infoLinks()" :path="$path" />
        </nav>

        <div class="border-border border-t px-4 py-3">
            <a href="/inscription" x-bind:tabindex="$store.menu.open ? 0 : -1" class="text-primary text-sm font-bold">حساب جديد</a>
            <span class="text-dim mx-2 text-sm">·</span>
            <a href="/connexion" x-bind:tabindex="$store.menu.open ? 0 : -1" class="text-primary text-sm font-bold">دخول</a>
        </div>
    </div>
</div>
