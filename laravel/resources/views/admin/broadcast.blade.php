{{-- ── BROADCAST ────────────────────────────────────────────────────────────
     Today this queues rather than sends. Saying so plainly beats a send button
     that quietly does nothing — and the rows it writes are what makes wiring a
     provider later a matter of one adapter rather than a guess at who should
     have been told. --}}
<x-admin.page :root="false" :title="__('admin.nav.push')" :subtitle="__('broadcast.subtitle')">

    <p class="bg-warning/10 text-warning rounded-card mt-4 px-4 py-3 text-xs leading-relaxed font-bold">
        {{ __('broadcast.nothing_sends_yet') }}
    </p>

    <form method="POST" action="{{ \App\Support\Nav::href('/admin/notifications') }}"
        class="rounded-card border-border bg-surface shadow-soft mt-4 border p-4 space-y-3">
        @csrf

        <label class="block">
            <span class="text-xs font-bold">{{ __('broadcast.title_label') }}</span>
            <input name="title" required minlength="4" maxlength="60" value="{{ old('title') }}"
                class="rounded-input border-border mt-1 w-full border px-3 py-2 text-sm">
        </label>

        <label class="block">
            <span class="text-xs font-bold">{{ __('broadcast.body_label') }}</span>
            <textarea name="body" required minlength="4" maxlength="160" rows="2"
                class="rounded-input border-border mt-1 w-full border px-3 py-2 text-sm">{{ old('body') }}</textarea>
            {{-- Two lines is where both phones cut it off. --}}
            <span class="text-dim mt-1 block text-[11px]">{{ __('broadcast.body_hint') }}</span>
        </label>

        <label class="block">
            <span class="text-xs font-bold">{{ __('broadcast.url_label') }}</span>
            <input name="url" dir="ltr" maxlength="500" placeholder="/vente/appartement/alger" value="{{ old('url') }}"
                class="rounded-input border-border mt-1 w-full border px-3 py-2 text-start text-sm">
            {{-- A notification arrives wearing the site's name and icon on a
                 lock screen. It must not be able to carry anyone off it. --}}
            <span class="text-dim mt-1 block text-[11px]">{{ __('broadcast.url_hint') }}</span>
        </label>

        <button class="bg-accent rounded-input w-full px-5 py-3 text-sm font-bold text-white">
            {{ __('broadcast.queue_it') }}
        </button>
    </form>

    <section class="mt-6">
        <h2 class="text-dim mb-2 px-1 text-xs font-extrabold">{{ __('broadcast.waiting_title') }}</h2>
        <ul class="rounded-card border-border bg-surface overflow-hidden border">
            @foreach ($readiness as $channel => $ready)
                <li class="border-border flex items-center gap-2 border-t px-4 py-3 text-xs first:border-t-0">
                    <span class="{{ $ready ? 'text-success' : 'text-dim' }} font-bold">{{ $ready ? '✓' : '—' }}</span>
                    <span class="font-bold">{{ __('broadcast.channels.'.$channel) }}</span>
                    <span class="text-dim ms-auto">
                        {{ $ready ? __('broadcast.ready') : __('broadcast.not_wired') }}
                    </span>
                    <span class="text-primary ltr-nums w-12 text-end font-bold">{{ $pending[$channel] ?? 0 }}</span>
                </li>
            @endforeach
        </ul>
    </section>

    @if ($recent->isNotEmpty())
        <section class="mt-6">
            <h2 class="text-dim mb-2 px-1 text-xs font-extrabold">{{ __('broadcast.recent') }}</h2>
            <ul class="rounded-card border-border bg-surface overflow-hidden border">
                @foreach ($recent as $entry)
                    <li class="border-border border-t px-4 py-3 first:border-t-0">
                        <p class="text-sm font-bold">{{ $entry->title }}</p>
                        <p class="text-muted mt-0.5 text-xs">{{ $entry->body }}</p>
                        <p class="text-dim ltr-nums mt-1 text-[11px]">
                            {{ __('broadcast.recipients', ['count' => $entry->recipients]) }}
                        </p>
                    </li>
                @endforeach
            </ul>
        </section>
    @endif
</x-admin.page>
