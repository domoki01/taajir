{{-- ── ACCOUNTS ─────────────────────────────────────────────────────────────
     Two permissions reach this screen: `users.manage` edits roles, bans and
     quotas, `users.approve` works the registration queue. Someone holding only
     the second gets the queue and nothing else, which is what a front-desk role
     should be able to do — so the screen renders what the reader can act on
     rather than showing controls that 403 when pressed. --}}
<x-admin.page :root="false" :title="__('admin.nav.users')"
    :subtitle="$search !== '' ? __('admin.users.results', ['count' => $users->total()]) : __('admin.users.count', ['count' => $users->total()])">

    @if ($canApprove)
        {{-- The switch and what it costs, together. Turning approval *on*
             approves everyone who already has an account, which is not obvious
             and is the difference between filtering who arrives next and muting
             the entire platform. --}}
        <form method="POST" action="{{ \App\Support\Nav::href('/admin/utilisateurs/approbation') }}"
            class="rounded-card border-border bg-surface shadow-soft mt-4 border p-4">
            @csrf
            <input type="hidden" name="on" value="{{ $requireApproval ? 0 : 1 }}">

            <p class="text-sm font-bold">{{ __('admin.users.approval_title') }}</p>
            <p class="text-muted mt-1 text-xs leading-relaxed">
                {{ $requireApproval ? __('admin.users.approval_is_on') : __('admin.users.approval_is_off') }}
            </p>

            <button class="{{ $requireApproval ? 'text-primary border-border border' : 'bg-accent text-white' }} rounded-input mt-3 px-4 py-2 text-xs font-bold">
                {{ $requireApproval ? __('admin.users.approval_turn_off') : __('admin.users.approval_turn_on') }}
            </button>
        </form>
    @endif

    @unless ($canManage)
        <p class="rounded-input bg-warning/10 text-warning mt-4 px-4 py-3 text-sm font-bold">
            {{ __('admin.users.approve_only') }}
        </p>
    @endunless

    @if ($requireApproval && $pending->isNotEmpty())
        <section class="mt-6">
            <h2 class="text-lg font-extrabold">
                {{ __('admin.users.waiting') }}
                <span class="text-dim ltr-nums ms-2 text-sm font-bold">{{ $pending->count() }}</span>
            </h2>
            {{-- Oldest first, for the same reason the moderation queue is. --}}
            <p class="text-dim mt-1 text-xs">{{ __('admin.users.waiting_note') }}</p>

            <ul class="mt-3 space-y-3">
                @foreach ($pending as $account)
                    <x-admin.user-row :user="$account" :viewer="$viewer" :roles="$roles"
                        :can-manage="$canManage" :can-approve="$canApprove" :require-approval="$requireApproval" />
                @endforeach
            </ul>
        </section>
    @endif

    <form action="{{ \App\Support\Nav::href('/admin/utilisateurs') }}"
        class="rounded-card shadow-soft border-border bg-surface mt-6 flex items-center gap-2 border p-2">
        <x-icon.search class="text-dim ms-2 size-5 shrink-0" />
        <input name="q" type="search" value="{{ $search }}"
            placeholder="{{ __('admin.users.search_placeholder') }}"
            aria-label="{{ __('admin.users.search_label') }}"
            class="placeholder:text-dim min-w-0 flex-1 bg-transparent py-2 text-base outline-none">
        <button type="submit" class="bg-accent rounded-input shrink-0 px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90">
            {{ __('admin.users.search') }}
        </button>
    </form>

    <div class="mt-5">
        @if ($users->isEmpty())
            <p class="rounded-card border-border bg-surface border border-dashed px-6 py-12 text-center font-bold">
                {{ $search !== '' ? __('admin.users.no_match') : __('admin.users.none') }}
            </p>
        @else
            <ul class="space-y-3">
                @foreach ($users as $account)
                    <x-admin.user-row :user="$account" :viewer="$viewer" :roles="$roles"
                        :can-manage="$canManage" :can-approve="$canApprove" :require-approval="$requireApproval" />
                @endforeach
            </ul>
        @endif
    </div>

    <div class="mt-6">{{ $users->links() }}</div>
</x-admin.page>
