{{-- ── ADMIN HOME ───────────────────────────────────────────────────────────
     Four numbers and a map. The numbers are what a moderator opens this screen
     to check; the map is everything else, grouped so a list of a dozen rows can
     be read rather than scanned. --}}
@php
    $tiles = [
        ['icon' => 'clock', 'label' => __('admin.tiles.pending'), 'value' => $stats['pending'], 'href' => '/admin/moderation', 'tone' => $stats['pending'] ? 'text-warning' : ''],
        ['icon' => 'circle-check', 'label' => __('admin.tiles.published'), 'value' => $stats['published'], 'href' => '/vente', 'tone' => 'text-success'],
        ['icon' => 'users', 'label' => __('admin.tiles.users'), 'value' => $stats['users'], 'href' => '/admin/utilisateurs', 'tone' => ''],
        ['icon' => 'triangle-alert', 'label' => __('admin.tiles.banned'), 'value' => $stats['banned'], 'href' => '/admin/utilisateurs', 'tone' => $stats['banned'] ? 'text-danger' : ''],
    ];
@endphp

<x-admin.page :title="__('admin.overview')" :subtitle="__('admin.overview_subtitle')">
    <ul class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        @foreach ($tiles as $tile)
            <li>
                <a href="{{ \App\Support\Nav::href($tile['href']) }}"
                    class="rounded-card border-border bg-surface active:bg-surface-soft block border p-3 transition-colors">
                    <p class="text-dim flex items-center gap-1.5 text-[11px] font-bold">
                        <x-dynamic-component :component="'icon.'.$tile['icon']" class="size-3.5" />
                        {{ $tile['label'] }}
                    </p>
                    {{-- A dash, not a zero: a count that failed and a table that
                         is empty are different facts, and an admin who reads
                         "0 waiting" and closes the tab has been misled. --}}
                    <p class="ltr-nums mt-1 text-xl font-black {{ $tile['tone'] }}">
                        {{ $tile['value'] === null ? '—' : $tile['value'] }}
                    </p>
                </a>
            </li>
        @endforeach
    </ul>

    @foreach (\App\Support\AdminNav::GROUPS as $group)
        @php($rows = $groups[$group] ?? collect())
        @continue($rows->isEmpty())

        <section class="mt-6">
            <h2 class="text-dim mb-2 px-1 text-xs font-extrabold">{{ __('admin.groups.'.$group) }}</h2>

            <ul class="rounded-card border-border bg-surface overflow-hidden border">
                @foreach ($rows as $row)
                    <li class="border-border border-t first:border-t-0">
                        <a href="{{ \App\Support\Nav::href($row['href']) }}"
                            class="active:bg-surface-soft flex items-center gap-3 px-4 py-3 transition-colors">
                            <span class="bg-primary/5 text-primary grid size-9 shrink-0 place-items-center rounded-[12px]">
                                <x-dynamic-component :component="'icon.'.$row['icon']" class="size-4.5" />
                            </span>
                            <span class="min-w-0 flex-1">
                                <span class="block text-sm font-bold">{{ __('admin.nav.'.$row['key']) }}</span>
                                {{-- One line under each row: a label alone makes
                                     you open a screen to find out what it is. --}}
                                <span class="text-dim block text-xs">{{ __('admin.hints.'.$row['key']) }}</span>
                            </span>
                            {{-- Forward, so it points the way the page reads:
                                 right in French, left in Arabic. Mirrored
                                 rather than swapped for a second icon — one
                                 element, and it cannot get out of step with
                                 itself. --}}
                            <x-icon.chevron-right class="text-dim size-4 shrink-0 rtl:-scale-x-100" />
                        </a>
                    </li>
                @endforeach
            </ul>
        </section>
    @endforeach

    <section class="mt-6">
        <h2 class="text-dim mb-2 px-1 text-xs font-extrabold">{{ __('admin.recent') }}</h2>

        @if ($recent === null)
            <p class="text-muted px-1 text-sm">{{ __('admin.audit_unavailable') }}</p>
        @elseif ($recent->isEmpty())
            <p class="text-muted px-1 text-sm">{{ __('admin.audit_empty') }}</p>
        @else
            <ul class="rounded-card border-border bg-surface overflow-hidden border">
                @foreach ($recent as $entry)
                    <li class="border-border flex flex-wrap items-center gap-2 border-t px-4 py-3 text-sm first:border-t-0">
                        <span class="font-bold">{{ $entry->actionLabel() }}</span>
                        @if ($entry->actor_name)
                            <span class="text-muted truncate text-xs">— {{ $entry->actor_name }}</span>
                        @endif
                        <span class="text-dim ltr-nums ms-auto text-xs">{{ $entry->created_at?->isoFormat('LLL') }}</span>
                    </li>
                @endforeach
            </ul>
        @endif
    </section>
</x-admin.page>
