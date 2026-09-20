{{-- The moderation queue.

     Oldest first: an ad that has waited longest is the one whose owner is most
     likely to give up on the site. Each card carries what the automatic check
     flagged, so nobody has to re-read a paragraph hunting for the problem a
     hundred times a day. --}}
<x-admin.page :root="false" :title="__('admin.moderation')"
    :subtitle="__('listing.count', ['count' => $queue->total()])">

    @if ($canModerateListings)
            @forelse ($queue as $listing)
                <article class="rounded-card border-border bg-surface shadow-soft mt-4 border p-4">
                    <div class="flex items-start gap-3">
                        @if ($listing->cover_url)
                            <img src="{{ $listing->cover_url }}" alt="" class="rounded-input size-20 shrink-0 object-cover">
                        @endif

                        <div class="min-w-0 flex-1">
                            <p class="text-primary ltr-nums text-sm font-black">{{ $listing->formattedPrice() }}</p>
                            <h2 class="text-sm font-bold">{{ $listing->title }}</h2>
                            <p class="text-dim mt-0.5 text-xs">{{ $listing->placeLabel() }} · {{ $listing->owner_name }}</p>

                            @if ($flag = $flagLabel($listing->policy_rule))
                                {{-- Amber, not red: this is what the check
                                     noticed, not a verdict. --}}
                                <p class="bg-warning/10 text-warning mt-2 inline-block rounded-full px-2.5 py-1 text-[11px] font-bold">
                                    {{ $flag }}
                                </p>
                            @endif
                        </div>
                    </div>

                    <p class="text-muted mt-3 line-clamp-4 text-xs leading-relaxed whitespace-pre-line">{{ $listing->description }}</p>

                    <div class="mt-4 flex flex-wrap items-center gap-2">
                        <form method="POST" action="{{ \App\Support\Nav::href('/admin/moderation/'.$listing->id.'/approuver') }}">
                            @csrf
                            <button class="bg-accent rounded-input px-4 py-2 text-xs font-bold text-white">{{ __('admin.approve') }}</button>
                        </form>

                        {{-- A rejection carries its reason or it is one the
                             owner cannot act on, so they post it again. --}}
                        <form method="POST" action="{{ \App\Support\Nav::href('/admin/moderation/'.$listing->id.'/refuser') }}" class="flex items-center gap-2">
                            @csrf
                            <input name="reason" required minlength="4" maxlength="255"
                                placeholder="{{ __('admin.reject_reason') }}"
                                class="rounded-input border-border border px-3 py-2 text-xs">
                            <button class="text-danger rounded-input border-danger/40 border px-4 py-2 text-xs font-bold">{{ __('admin.reject') }}</button>
                        </form>

                        <form method="POST" action="{{ \App\Support\Nav::href('/admin/moderation/'.$listing->id.'/archiver') }}">
                            @csrf
                            <button class="text-muted rounded-input border-border border px-4 py-2 text-xs font-bold">{{ __('admin.archive') }}</button>
                        </form>
                    </div>
                </article>
            @empty
                <p class="rounded-card border-border bg-surface mt-4 border border-dashed px-6 py-12 text-center font-bold">
                    {{ __('admin.queue_empty') }}
                </p>
            @endforelse

            <div class="mt-6">{{ $queue->links() }}</div>
    @endif

    {{-- The demand queue, on its own permission. A moderator may hold one of
         the two: the section is absent rather than present and refusing. --}}
    @if ($canModerateRequests)
        <section class="{{ $canModerateListings ? 'border-border mt-10 border-t pt-6' : 'mt-4' }}">
            <h2 class="text-lg font-extrabold">
                {{ __('admin.requests.queue') }}
                <span class="text-dim ltr-nums ms-2 text-sm font-bold">{{ $requests->count() }}</span>
            </h2>

            @forelse ($requests as $demand)
                <article class="rounded-card border-border bg-surface shadow-soft mt-4 border p-4">
                    <p class="text-dim text-xs font-bold">
                        {{ __('community.intent_'.$demand->intent) }} · {{ $demand->placeLabel() }} · {{ $demand->owner_name }}
                    </p>
                    <h3 class="mt-1 text-sm font-bold">{{ $demand->title }}</h3>

                    @if ($flag = $flagLabel($demand->policy_rule))
                        <p class="bg-warning/10 text-warning mt-2 inline-block rounded-full px-2.5 py-1 text-[11px] font-bold">
                            {{ $flag }}
                        </p>
                    @endif

                    <p class="text-muted mt-2 line-clamp-4 text-xs leading-relaxed whitespace-pre-line">{{ $demand->description }}</p>

                    <div class="mt-3 flex flex-wrap items-center gap-2">
                        <form method="POST" action="{{ \App\Support\Nav::href('/admin/moderation/demandes/'.$demand->id) }}">
                            @csrf
                            <input type="hidden" name="status" value="visible">
                            <button class="bg-accent rounded-input px-4 py-2 text-xs font-bold text-white">{{ __('admin.approve') }}</button>
                        </form>

                        {{-- A refusal carries its reason, the same rule the ad
                             queue holds: without one the author cannot act on
                             it and posts the same thing again. --}}
                        <form method="POST" action="{{ \App\Support\Nav::href('/admin/moderation/demandes/'.$demand->id) }}"
                            class="flex min-w-0 flex-1 items-center gap-2">
                            @csrf
                            <input type="hidden" name="status" value="rejected">
                            <input name="reason" required minlength="4" maxlength="255"
                                placeholder="{{ __('admin.reject_reason') }}"
                                class="rounded-input border-border min-w-0 flex-1 border px-3 py-2 text-xs">
                            <button class="text-danger rounded-input border-danger/40 border px-4 py-2 text-xs font-bold">
                                {{ __('admin.reject') }}
                            </button>
                        </form>
                    </div>
                </article>
            @empty
                <p class="rounded-card border-border bg-surface mt-4 border border-dashed px-6 py-10 text-center font-bold">
                    {{ __('admin.requests.queue_empty') }}
                </p>
            @endforelse
        </section>
    @endif
</x-admin.page>
