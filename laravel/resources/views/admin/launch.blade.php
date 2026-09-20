{{-- ── THE LAUNCH ───────────────────────────────────────────────────────────
     Three controls that look similar and are not. Holding the site is
     reversible; clearing the timer changes nothing but what the closed page
     says; throwing the switch is the one action on the site with no undo. --}}
<x-admin.page :root="false" :title="__('admin.nav.launch')" :subtitle="__('launch.admin_subtitle')">

    <div class="rounded-card border-border bg-surface shadow-soft mt-4 border p-4">
        <p class="text-sm font-black">
            {{ $launch->isHeld() ? __('launch.state_held') : __('launch.state_open') }}
        </p>
        <p class="text-muted mt-1 text-xs leading-relaxed">
            {{ $launch->isHeld() ? __('launch.state_held_note') : __('launch.state_open_note') }}
        </p>

        @if ($launch->launchedAt)
            <p class="text-dim ltr-nums mt-2 text-xs">
                {{ __('launch.launched_on', ['date' => $launch->launchedAt->isoFormat('LLL')]) }}
            </p>
        @endif

        <form method="POST" action="{{ \App\Support\Nav::href('/admin/lancement/etat') }}" class="mt-3">
            @csrf
            <input type="hidden" name="state" value="{{ $launch->isHeld() ? 'active' : 'prelaunch' }}">
            <button class="{{ $launch->isHeld() ? 'text-primary border-border border' : 'text-danger border-danger/40 border' }} rounded-input px-4 py-2 text-xs font-bold">
                {{ $launch->isHeld() ? __('launch.open_without_publishing') : __('launch.hold_the_site') }}
            </button>
        </form>
    </div>

    <div class="rounded-card border-border bg-surface shadow-soft mt-3 border p-4">
        <h2 class="text-sm font-black">{{ __('launch.countdown') }}</h2>
        {{-- Clearing it shows "the wait is over" and nothing else. The switch
             stays a person's to throw. --}}
        <p class="text-muted mt-1 text-xs leading-relaxed">{{ __('launch.countdown_note') }}</p>

        <form method="POST" action="{{ \App\Support\Nav::href('/admin/lancement/compte-a-rebours') }}"
            class="mt-3 flex flex-wrap items-center gap-2">
            @csrf
            <input type="datetime-local" name="launch_at" dir="ltr"
                value="{{ $launch->launchAt?->format('Y-m-d\TH:i') }}"
                aria-label="{{ __('launch.countdown') }}"
                class="rounded-input border-border ltr-nums border px-3 py-2 text-xs">
            <button class="text-primary rounded-input border-border border px-4 py-2 text-xs font-bold">
                {{ __('launch.save_timer') }}
            </button>
        </form>

        @if ($launch->timerElapsed())
            <p class="bg-warning/10 text-warning rounded-input mt-3 px-3 py-2 text-xs font-bold">
                {{ __('launch.timer_elapsed') }}
            </p>
        @endif
    </div>

    @if ($launch->isHeld())
        <div class="rounded-card border-border bg-surface shadow-soft mt-3 border p-4">
            <h2 class="text-sm font-black">{{ __('launch.what_will_happen') }}</h2>

            {{-- Said in numbers before the button, because the difference
                 between the two lines below is the whole risk of the action:
                 approved ads go public, the rest go to the review queue. --}}
            <ul class="text-muted mt-2 space-y-1 text-xs leading-relaxed">
                <li class="ltr-nums">{{ __('launch.will_publish', ['count' => $heldApproved]) }}</li>
                <li class="ltr-nums">{{ __('launch.will_requeue', ['count' => $heldTotal - $heldApproved]) }}</li>
                <li class="ltr-nums">{{ __('launch.will_release_requests', ['count' => $heldRequests]) }}</li>
            </ul>

            <p class="text-dim mt-3 text-[11px] leading-relaxed">{{ __('launch.channels_note') }}</p>

            <form method="POST" action="{{ \App\Support\Nav::href('/admin/lancement') }}" class="mt-4">
                @csrf
                <label class="block">
                    <span class="text-xs font-bold">{{ __('launch.confirm_label') }}</span>
                    <input name="confirm" required dir="ltr" autocomplete="off" placeholder="active"
                        class="rounded-input border-border mt-1 w-full border px-3 py-2 text-start text-sm">
                </label>
                <button class="bg-accent rounded-input mt-3 w-full px-5 py-3 text-sm font-bold text-white">
                    {{ __('launch.execute') }}
                </button>
            </form>
        </div>
    @endif

    <div class="rounded-card border-border bg-surface shadow-soft mt-3 border p-4">
        <h2 class="text-sm font-black">{{ __('launch.channels') }}</h2>
        <ul class="mt-2 space-y-1 text-xs">
            @foreach ($readiness as $channel => $ready)
                <li class="flex items-center gap-2">
                    <span class="{{ $ready ? 'text-success' : 'text-dim' }} font-bold">
                        {{ $ready ? '✓' : '—' }}
                    </span>
                    <span class="font-bold">{{ __('broadcast.channels.'.$channel) }}</span>
                    <span class="text-dim ltr-nums ms-auto">
                        {{ __('broadcast.waiting', ['count' => $pending[$channel] ?? 0]) }}
                    </span>
                </li>
            @endforeach
        </ul>
    </div>
</x-admin.page>
