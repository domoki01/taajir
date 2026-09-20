{{-- ── ROLES ────────────────────────────────────────────────────────────────
     A matrix: roles down, permissions across. The super-admin's row is drawn
     with every box ticked and disabled, because that is the truth — it holds
     everything by code and the table is never consulted for it. Rendering it
     editable would be a lie the first save exposes. --}}
<x-admin.page :root="false" :title="__('admin.nav.roles')" :subtitle="__('admin.roles.subtitle')">

    <form method="POST" action="{{ \App\Support\Nav::href('/admin/roles') }}" class="mt-4 space-y-3">
        @csrf

        @foreach ($roles as $role)
            @php($locked = $role->id === $superAdmin)

            <fieldset class="rounded-card border-border bg-surface shadow-soft border p-4">
                {{-- Every role the form drew, ticked or not. Without this a row
                     whose boxes were all just unticked is simply absent from
                     the payload, and the save cannot tell it apart from a row
                     the form never showed. --}}
                <input type="hidden" name="roles[]" value="{{ $role->id }}">

                <legend class="flex flex-wrap items-center gap-2 px-1">
                    <span class="text-sm font-black">{{ $role->label }}</span>
                    <span dir="ltr" class="text-dim text-start text-[11px] font-bold">{{ $role->id }}</span>
                    <span class="text-dim ltr-nums text-[11px] font-bold">
                        {{ __('admin.roles.holders', ['count' => $counts[$role->id] ?? 0]) }}
                    </span>
                    @if ($role->builtin)
                        <span class="bg-primary/5 text-primary rounded-full px-2 py-0.5 text-[11px] font-bold">
                            {{ __('admin.roles.builtin') }}
                        </span>
                    @endif
                </legend>

                @if ($locked)
                    <p class="text-muted mt-2 text-xs leading-relaxed">{{ __('admin.roles.super_admin_note') }}</p>
                @endif

                <div class="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2">
                    @foreach ($permissions as $permission)
                        <label class="flex items-start gap-2 text-xs font-semibold {{ $locked ? 'text-dim' : '' }}">
                            <input type="checkbox"
                                name="permissions[{{ $role->id }}][]"
                                value="{{ $permission->value }}"
                                @checked($locked || in_array($permission->value, $held[$role->id] ?? [], true))
                                @disabled($locked)
                                class="accent-primary mt-0.5 size-4 shrink-0">
                            <span>{{ $permission->label() }}</span>
                        </label>
                    @endforeach
                </div>

                @if (! $locked && ! $role->builtin)
                    <p class="text-dim mt-3 text-[11px]">{{ __('admin.roles.delete_hint') }}</p>
                @endif
            </fieldset>
        @endforeach

        <button class="bg-accent rounded-input w-full px-5 py-3 text-sm font-bold text-white">
            {{ __('admin.roles.save') }}
        </button>
    </form>

    {{-- Deleting is its own form, outside the matrix: it is not a thing you
         want to happen because a save button was pressed. --}}
    @foreach ($roles as $role)
        @continue($role->builtin || $role->id === $superAdmin)
        <form method="POST" action="{{ \App\Support\Nav::href('/admin/roles/'.$role->id) }}" class="mt-2">
            @csrf
            @method('DELETE')
            <button class="text-danger rounded-input border-danger/40 border px-4 py-2 text-xs font-bold">
                {{ __('admin.roles.delete', ['label' => $role->label]) }}
            </button>
        </form>
    @endforeach

    <section class="rounded-card border-border bg-surface shadow-soft mt-6 border p-4">
        <h2 class="text-sm font-black">{{ __('admin.roles.new') }}</h2>
        {{-- A new role starts with nothing. Anything else would hand out access
             as a side effect of typing a name. --}}
        <p class="text-muted mt-1 text-xs leading-relaxed">{{ __('admin.roles.new_note') }}</p>

        <form method="POST" action="{{ \App\Support\Nav::href('/admin/roles/nouveau') }}" class="mt-3 flex flex-wrap items-center gap-2">
            @csrf
            {{-- Latin and stable: it lands in URLs and in the audit log. --}}
            <input name="id" dir="ltr" required placeholder="{{ __('admin.roles.id_placeholder') }}"
                aria-label="{{ __('admin.roles.id') }}"
                class="rounded-input border-border w-36 border px-3 py-2 text-start text-xs">
            <input name="label" required minlength="2" maxlength="40" placeholder="{{ __('admin.roles.label_placeholder') }}"
                aria-label="{{ __('admin.roles.label') }}"
                class="rounded-input border-border min-w-0 flex-1 border px-3 py-2 text-xs">
            <button class="bg-accent rounded-input px-4 py-2 text-xs font-bold text-white">{{ __('admin.roles.add') }}</button>
        </form>
    </section>
</x-admin.page>
