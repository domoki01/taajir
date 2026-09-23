{{-- ── THE LOG ──────────────────────────────────────────────────────────────
     Read-only, and there is no action anywhere that edits or deletes a row.
     That is the point of it: a log an admin can tidy up cannot answer the
     question it exists for. --}}
<x-admin.page :root="false" :title="__('admin.nav.audit')"
    :subtitle="__('admin.audit_count', ['count' => $entries->total()])">

    <p class="text-dim mt-2 text-xs leading-relaxed">{{ __('admin.audit_note') }}</p>

    <div class="mt-6">
        @forelse ($entries as $entry)
            <div class="rounded-input border-border bg-surface mt-2 border px-4 py-3 text-sm">
                <div class="flex flex-wrap items-center gap-2">
                    <span class="font-bold">{{ $entry->actionLabel() }}</span>
                    <span class="text-dim text-xs">{{ $entry->targetLabel() }}</span>
                    <span class="text-dim ltr-nums ms-auto text-xs">{{ $entry->created_at?->isoFormat('LLL') }}</span>
                </div>

                @if ($entry->note())
                    <p class="text-muted mt-1 text-xs">{{ $entry->note() }}</p>
                @endif

                {{-- Two opaque identifiers side by side. dir="ltr" because they
                     are Latin runs inside an Arabic page, and the bidi algorithm
                     would otherwise put the arrow on the wrong end of them. --}}
                <p dir="ltr" class="text-dim mt-1 text-start text-[11px] break-all">
                    {{ $entry->actor_uid }} → {{ $entry->target_id }}
                </p>
            </div>
        @empty
            <p class="rounded-card border-border bg-surface border border-dashed px-6 py-12 text-center font-bold">
                {{ __('admin.audit_empty') }}
            </p>
        @endforelse
    </div>

    <div class="mt-6">{{ $entries->links() }}</div>
</x-admin.page>
