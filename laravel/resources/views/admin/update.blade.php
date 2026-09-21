{{-- ── APPLYING A RELEASE ───────────────────────────────────────────────────
     The super-admin's screen, and only theirs. Uploading a zip means uploading
     PHP, and PHP runs — that is not a capability the roles matrix should be
     able to hand out. --}}
<x-admin.page :root="false" :title="__('update.title')" :subtitle="__('update.subtitle')">

    @if (session('migrations'))
        <div class="rounded-card border-border bg-surface mt-4 border p-4">
            <p class="text-dim text-xs font-extrabold">{{ __('update.migrations_ran') }}</p>
            <pre dir="ltr" class="text-muted mt-2 overflow-x-auto text-start text-[11px] leading-relaxed">{{ session('migrations') }}</pre>
        </div>
    @endif

    <form method="POST" action="{{ \App\Support\Nav::href('/admin/mise-a-jour') }}" enctype="multipart/form-data"
        class="rounded-card border-border bg-surface shadow-soft mt-4 border p-4"
        x-data="{ busy: false }" x-on:submit="busy = true">
        @csrf

        <label class="block">
            <span class="text-xs font-bold">{{ __('update.file_label') }}</span>
            <input type="file" name="release" accept=".zip,application/zip" required
                class="mt-2 w-full text-xs">
            <span class="text-dim ltr-nums mt-1 block text-[11px]">
                {{ __('update.limit', ['size' => round($limit / 1024 / 1024, 1)]) }}
            </span>
        </label>

        {{-- Disabled the moment it is pressed. Applying a release twice at once
             is two processes writing the same files, and the second one wins
             halfway through the first. --}}
        <button class="bg-accent rounded-input mt-4 w-full px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
            x-bind:disabled="busy">
            <span x-show="!busy">{{ __('update.apply') }}</span>
            <span x-show="busy" x-cloak>{{ __('update.applying') }}</span>
        </button>

        <p class="text-dim mt-3 text-[11px] leading-relaxed">{{ __('update.patience') }}</p>
    </form>

    <section class="rounded-card border-border bg-surface mt-3 border p-4">
        <h2 class="text-sm font-black">{{ __('update.what_it_does') }}</h2>
        <ul class="text-muted mt-2 space-y-1 text-xs leading-relaxed">
            <li>{{ __('update.step_extract') }}</li>
            <li>{{ __('update.step_keep') }}</li>
            <li>{{ __('update.step_cache') }}</li>
            <li>{{ __('update.step_migrate') }}</li>
        </ul>

        <p dir="ltr" class="text-dim mt-3 text-start text-[11px] break-all">{{ $appPath }}</p>
    </section>

    @if ($exposed)
        {{-- Worth saying on the one screen an admin opens to deploy. --}}
        <p class="rounded-card bg-warning/10 text-warning mt-3 px-4 py-3 text-xs leading-relaxed font-bold">
            {{ __('update.exposed') }}
        </p>
    @endif
</x-admin.page>
