{{-- ── THE CLOSED DOOR ──────────────────────────────────────────────────────
     What everyone sees while the site is held. It is not an apology: the whole
     point of the hold is to gather ads and demands before opening, so the page
     is a form's front door with a clock on it. --}}
@php($branding = \App\Services\Branding::current())

<x-layout.app bare :title="__('launch.title')" :description="__('launch.meta', ['site' => $branding->siteName])">
    <main class="from-primary-soft to-bg flex flex-1 items-center bg-gradient-to-b py-12">
        <x-layout.container>
            <div class="mx-auto max-w-xl text-center">
                <span class="bg-primary mx-auto grid size-14 place-items-center rounded-[18px] text-white">
                    <x-icon.building-2 class="size-7" stroke-width="2.4" />
                </span>
                <h1 class="mt-5 text-3xl font-black">{{ $branding->siteName }}</h1>

                @if ($user)
                    <p role="status" class="rounded-card bg-success/10 text-success mt-5 flex items-start gap-2 p-4 text-start text-sm font-bold">
                        <x-icon.circle-check class="mt-0.5 size-5 shrink-0" />
                        <span>{{ __('launch.signed_in') }}</span>
                    </p>
                @else
                    <p class="text-muted mt-3 text-base leading-relaxed">{{ __('launch.signed_out') }}</p>
                @endif

                {{-- The countdown, and the poll behind it.

                     It polls rather than trusting its own clock: the page can
                     sit open overnight on a phone whose clock is wrong, and the
                     moment that matters is the one the server agrees with. When
                     the state flips, the tab reloads itself onto the open
                     site. --}}
                <div class="mt-8" x-data="countdown(@js($launch->launchAt?->toIso8601String()))" x-init="start()">
                    <template x-if="target && remaining > 0">
                        <ul class="flex justify-center gap-2" aria-live="off">
                            <template x-for="part in parts" :key="part.key">
                                <li class="rounded-card border-border bg-surface shadow-soft min-w-16 border px-3 py-2">
                                    <span class="ltr-nums text-primary block text-2xl font-black" x-text="String(part.value).padStart(2, '0')"></span>
                                    <span class="text-dim block text-[11px] font-bold" x-text="part.label"></span>
                                </li>
                            </template>
                        </ul>
                    </template>

                    <template x-if="!target || remaining <= 0">
                        {{-- No date announced, or the clock ran out. Either way
                             the honest line is the same: not long — because the
                             switch is still a person's to throw. --}}
                        <p class="text-primary text-lg font-black">{{ __('launch.soon') }}</p>
                    </template>
                </div>

                <div class="mt-8 flex flex-wrap justify-center gap-2">
                    <a href="{{ \App\Support\Nav::href('/publier') }}"
                        class="bg-accent rounded-input px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90">
                        {{ $user ? __('launch.post_another') : __('launch.post_first') }}
                    </a>
                    @unless ($user)
                        <a href="{{ \App\Support\Nav::href('/connexion') }}?next={{ urlencode(\App\Support\Nav::href('/lancement')) }}"
                            class="rounded-input border-border bg-surface border px-6 py-3 text-sm font-bold">
                            {{ __('launch.have_account') }}
                        </a>
                    @endunless
                </div>

                <p class="text-dim mt-8 text-xs leading-relaxed">{{ __('launch.no_spam') }}</p>
            </div>
        </x-layout.container>
    </main>

    @push('scripts')
        <script>
            document.addEventListener('alpine:init', () => {
                Alpine.data('countdown', (iso) => ({
                    target: iso ? new Date(iso).getTime() : null,
                    remaining: 0,
                    parts: [],

                    start() {
                        this.tick();
                        setInterval(() => this.tick(), 1000);
                        // Every half-minute, not every second: the answer only
                        // changes once, and the page may be open for days.
                        setInterval(() => this.poll(), 30000);
                    },

                    tick() {
                        if (!this.target) return;
                        this.remaining = Math.max(0, this.target - Date.now());

                        const total = Math.floor(this.remaining / 1000);
                        this.parts = [
                            { key: 'd', value: Math.floor(total / 86400), label: @js(__('launch.days')) },
                            { key: 'h', value: Math.floor((total % 86400) / 3600), label: @js(__('launch.hours')) },
                            { key: 'm', value: Math.floor((total % 3600) / 60), label: @js(__('launch.minutes')) },
                            { key: 's', value: total % 60, label: @js(__('launch.seconds')) },
                        ];
                    },

                    async poll() {
                        try {
                            const res = await fetch(@js(\App\Support\Nav::href('/api/launch-state')), { cache: 'no-store' });
                            const state = await res.json();
                            if (state.state === 'active') window.location.reload();
                            this.target = state.launchAt ? new Date(state.launchAt).getTime() : null;
                        } catch { /* Offline. The clock keeps running; the next poll tries again. */ }
                    },
                }));
            });
        </script>
    @endpush
</x-layout.app>
