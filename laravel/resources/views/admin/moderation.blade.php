{{-- The moderation queue.

     Oldest first: an ad that has waited longest is the one whose owner is most
     likely to give up on the site. Each card carries what the automatic check
     flagged, so nobody has to re-read a paragraph hunting for the problem a
     hundred times a day. --}}
<x-layout.app :title="__('admin.moderation')">
    <main class="flex-1 py-6">
        <x-layout.container max="max-w-3xl">
            <h1 class="text-xl font-black">{{ __('admin.moderation') }}</h1>

            @if (session('status'))
                <p class="rounded-card bg-success/10 text-success mt-4 px-4 py-3 text-sm font-bold">{{ session('status') }}</p>
            @endif

            <p class="text-muted ltr-nums mt-1 text-sm font-semibold">
                {{ __('listing.count', ['count' => $queue->total()]) }}
            </p>

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
        </x-layout.container>
    </main>
</x-layout.app>
