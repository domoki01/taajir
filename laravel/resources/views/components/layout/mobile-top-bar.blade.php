{{-- ── MOBILE BACK BAR ──────────────────────────────────────────────────────
     The header is gone below `md` and the bottom nav stands down on the listing
     page and the publish form, which would leave those two screens with no way
     out at all on a phone. This is the native answer: a detail screen loses the
     tab bar and gains a back affordance.

     It carries the site name as well, because the most common way anyone reaches
     a listing in Algeria is a WhatsApp link — arriving on a page with no
     indication of which site you are on is its own problem. --}}
@php($immersive = \App\Support\Nav::isImmersiveRoute(\App\Support\Nav::currentPath()))

{{-- Two jobs, one 48px bar. On a detail screen it is the way out; everywhere
     else it is the way *in* — the phone has no header, so without this the menu
     would have nowhere to open from and half the site would stay unreachable. --}}
<div class="border-border bg-surface/95 sticky top-0 z-40 flex h-12 items-center gap-1 border-b px-2 backdrop-blur-xl md:hidden">
    @if ($immersive)
        {{-- A listing opened straight from a WhatsApp link has nothing behind it,
             and history.back() there walks the person out of the site entirely —
             which is the single most common way a listing is opened in Algeria.

             Neither signal is sufficient alone. `document.referrer` does not
             update on a client-side navigation, so it stays empty for someone who
             has been browsing for ten minutes; and `history.length` counts the
             tab's initial entry in some contexts, so 2 can still mean "nothing
             behind us". Together they err towards the home page, which is a fine
             place to land. --}}
        <button
            type="button"
            x-data
            x-on:click="
                document.referrer.startsWith(window.location.origin) || window.history.length > 2
                    ? window.history.back()
                    : window.location.assign('/')
            "
            aria-label="رجوع"
            class="text-primary grid size-10 place-items-center rounded-full transition-transform active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100"
        >
            <x-icon.chevron-right class="size-6" stroke-width="2.4" />
        </button>
    @else
        <x-layout.menu-trigger />
    @endif

    <a href="/" class="text-sm font-extrabold tracking-tight">{{ config('taajir.site_name') }}</a>
</div>
