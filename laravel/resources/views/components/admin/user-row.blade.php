{{-- One account, with everything that can be done to it.

     Each control is its own form posting to its own route. That is deliberate:
     a role change, a ban and a quota edit are three different decisions with
     three different permissions and three different log entries, and one
     combined "save" would turn a mis-click in the role dropdown into a silent
     edit of the other two. --}}
@props([
    'user',
    'viewer',
    'roles',
    'canManage' => false,
    'canApprove' => false,
    'requireApproval' => false,
])

@php
    // You cannot change your own role or ban yourself. The service refuses both
    // anyway; hiding the controls means nobody finds that out by trying.
    $isSelf = $user->uid === $viewer->uid;
    $action = fn (string $path) => \App\Support\Nav::href('/admin/utilisateurs/'.$user->uid.'/'.$path);
@endphp

<li class="rounded-card border-border bg-surface shadow-soft border p-4">
    <div class="flex items-start gap-3">
        <span class="bg-primary/5 text-primary grid size-10 shrink-0 place-items-center rounded-full text-sm font-black">
            {{ mb_substr($user->display_name, 0, 1) }}
        </span>

        <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-bold">
                {{ $user->display_name }}
                @if ($isSelf)
                    <span class="text-dim text-xs font-semibold">— {{ __('admin.users.you') }}</span>
                @endif
            </p>

            {{-- Latin runs inside an Arabic page: without dir="ltr" the bidi
                 algorithm reorders an email around the @ and a phone number
                 around its prefix. --}}
            @if ($user->email)
                <p dir="ltr" class="text-dim text-start text-xs break-all">{{ $user->email }}</p>
            @endif
            @if ($user->phone)
                <p dir="ltr" class="text-dim ltr-nums text-start text-xs">{{ $user->phone }}</p>
            @endif

            <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span class="bg-primary/5 text-primary rounded-full px-2 py-0.5 text-[11px] font-bold">
                    {{ $roles->firstWhere('id', $user->role_id)?->label ?? $user->role_id }}
                </span>

                @if ($user->is_banned)
                    <span class="bg-danger/10 text-danger rounded-full px-2 py-0.5 text-[11px] font-bold">
                        {{ __('admin.users.suspended') }}
                    </span>
                @elseif ($requireApproval && ! $user->approved)
                    <span class="bg-warning/10 text-warning rounded-full px-2 py-0.5 text-[11px] font-bold">
                        {{ __('admin.users.awaiting') }}
                    </span>
                @endif

                <span class="text-dim ltr-nums text-[11px] font-bold">
                    {{ $user->active_listing_count }}/{{ $user->listing_quota }}
                </span>
            </div>

            @if ($user->is_banned && $user->ban_reason)
                <p class="text-muted mt-1.5 text-xs">{{ $user->ban_reason }}</p>
            @endif
        </div>
    </div>

    @if ($canApprove && $requireApproval && ! $user->is_banned)
        <form method="POST" action="{{ $action('approbation') }}" class="mt-3">
            @csrf
            <input type="hidden" name="approved" value="{{ $user->approved ? 0 : 1 }}">
            <button class="{{ $user->approved ? 'text-muted border-border border' : 'bg-accent text-white' }} rounded-input px-4 py-2 text-xs font-bold">
                {{ $user->approved ? __('admin.users.unapprove') : __('admin.users.approve') }}
            </button>
        </form>
    @endif

    @if ($canManage && ! $isSelf)
        <div class="border-border mt-3 space-y-2 border-t pt-3">
            <form method="POST" action="{{ $action('role') }}" class="flex flex-wrap items-center gap-2">
                @csrf
                <label class="text-dim text-xs font-bold" for="role-{{ $user->uid }}">{{ __('admin.users.role') }}</label>
                <select id="role-{{ $user->uid }}" name="role"
                    class="rounded-input border-border bg-surface border px-3 py-2 text-xs font-semibold">
                    @foreach ($roles as $role)
                        <option value="{{ $role->id }}" @selected($role->id === $user->role_id)>{{ $role->label }}</option>
                    @endforeach
                </select>
                <button class="text-primary rounded-input border-border border px-4 py-2 text-xs font-bold">{{ __('admin.users.save') }}</button>
            </form>

            <form method="POST" action="{{ $action('quota') }}" class="flex flex-wrap items-center gap-2">
                @csrf
                <label class="text-dim text-xs font-bold" for="quota-{{ $user->uid }}">{{ __('admin.users.quota') }}</label>
                <input id="quota-{{ $user->uid }}" name="listing_quota" type="number" min="0" max="1000"
                    value="{{ $user->listing_quota }}" aria-label="{{ __('admin.users.listing_quota') }}"
                    class="rounded-input border-border ltr-nums w-20 border px-3 py-2 text-xs">
                <input name="featured_quota" type="number" min="0" max="1000"
                    value="{{ $user->featured_quota }}" aria-label="{{ __('admin.users.featured_quota') }}"
                    class="rounded-input border-border ltr-nums w-20 border px-3 py-2 text-xs">
                <button class="text-primary rounded-input border-border border px-4 py-2 text-xs font-bold">{{ __('admin.users.save') }}</button>
            </form>

            <form method="POST" action="{{ $action('suspension') }}" class="flex flex-wrap items-center gap-2">
                @csrf
                <input type="hidden" name="banned" value="{{ $user->is_banned ? 0 : 1 }}">
                @unless ($user->is_banned)
                    {{-- A ban with no reason is one nobody can argue with or
                         undo, including the person it was made about. --}}
                    <input name="reason" required minlength="5" maxlength="255"
                        placeholder="{{ __('admin.users.ban_reason') }}"
                        class="rounded-input border-border min-w-0 flex-1 border px-3 py-2 text-xs">
                @endunless
                <button class="{{ $user->is_banned ? 'text-primary border-border' : 'text-danger border-danger/40' }} rounded-input border px-4 py-2 text-xs font-bold">
                    {{ $user->is_banned ? __('admin.users.unban') : __('admin.users.ban') }}
                </button>
            </form>
        </div>
    @endif
</li>
