{{-- ── THE ADMIN SHELL ──────────────────────────────────────────────────────
     Every screen in the section renders inside this: the same heading block,
     the same one way back, and the same width.

     There is no navigation here. It carried thirteen identical pills, then a
     desktop sidebar, and both were the same mistake in different clothes —
     furniture from a web page wrapped around what people open on a phone. The
     destinations live on /admin as grouped rows; from anywhere inside, "back"
     goes there. --}}
@props([
    'title',
    'subtitle' => null,
    'root' => true,
])

<x-layout.app :title="$title">
    @push('head')
        {{-- Never indexed. These pages 404 for anyone without a permission
             anyway, so a crawler would only ever log soft 404s — and the URLs
             themselves are not something the site advertises. --}}
        <meta name="robots" content="noindex, nofollow">
    @endpush

    <main class="flex-1 pt-4 pb-10">
        <x-layout.container max="max-w-3xl">
            {{-- Desktop only: on a phone the sticky back bar at the top of the
                 viewport already does this, and two back affordances on one
                 screen is one too many. --}}
            @unless ($root)
                <a href="{{ \App\Support\Nav::href('/admin') }}"
                    class="text-dim hover:text-primary mb-3 hidden items-center gap-1 text-xs font-bold md:inline-flex">
                    <x-icon.chevron-right class="size-4 rtl:block ltr:hidden" stroke-width="2.4" />
                    <x-icon.chevron-left class="size-4 ltr:block rtl:hidden" stroke-width="2.4" />
                    {{ __('admin.back_to_panel') }}
                </a>
            @endunless

            <h1 class="mt-1 text-xl font-black">{{ $title }}</h1>

            @if ($subtitle)
                <p class="text-muted mt-1 text-sm font-semibold">{{ $subtitle }}</p>
            @endif

            {{-- One place for "it worked", so no screen has to invent its own.
                 Green, not emerald: `success` is deliberately lighter than
                 `accent` so a confirmation and a button do not read alike. --}}
            @if (session('status'))
                <p class="rounded-card bg-success/10 text-success mt-4 px-4 py-3 text-sm font-bold">{{ session('status') }}</p>
            @endif

            @if ($errors->any())
                <ul class="rounded-card bg-danger/10 text-danger mt-4 space-y-1 px-4 py-3 text-sm font-bold">
                    @foreach ($errors->all() as $message)
                        <li>{{ $message }}</li>
                    @endforeach
                </ul>
            @endif

            {{ $slot }}
        </x-layout.container>
    </main>
</x-layout.app>
