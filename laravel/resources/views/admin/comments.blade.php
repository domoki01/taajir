{{-- ── COMMENTS ─────────────────────────────────────────────────────────────
     Everything readers wrote, newest first, across both threads.

     Hiding keeps the row and takes the comment off the page. That is better
     than deleting for the reason a moderator finds out the week after: the
     decision stays reviewable, and the person hidden can still see what they
     wrote and argue about it. Deleting is final and offered anyway, because
     some things should not stay on a disk. --}}
@php
    $threads = [
        [
            'rows' => $listingComments,
            'title' => __('admin.comments.on_listings'),
            'base' => '/admin/commentaires/annonces/',
            'context' => fn ($c) => $c->listing?->title,
            'link' => fn ($c) => $c->listing ? '/annonce/'.$c->listing->id.'/'.$c->listing->slug : null,
        ],
        [
            'rows' => $articleComments,
            'title' => __('admin.comments.on_articles'),
            'base' => '/admin/commentaires/articles/',
            'context' => fn ($c) => $c->article?->title,
            'link' => fn ($c) => $c->article?->path(),
        ],
    ];
@endphp

<x-admin.page :root="false" :title="__('admin.nav.comments')"
    :subtitle="__('admin.comments.count', ['count' => $listingComments->count() + $articleComments->count(), 'hidden' => $hiddenCount])">

    <p class="text-dim mt-2 text-xs leading-relaxed">{{ __('admin.comments.note') }}</p>

    @foreach ($threads as $thread)
        <section class="mt-6">
            <h2 class="text-dim mb-2 px-1 text-xs font-extrabold">{{ $thread['title'] }}</h2>

            <ul class="space-y-3">
                @forelse ($thread['rows'] as $comment)
                    <li class="rounded-card border-border bg-surface shadow-soft border p-4 {{ $comment->status === 'hidden' ? 'opacity-70' : '' }}">
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="text-sm font-bold">{{ $comment->author_name }}</span>
                            @if ($comment->status === 'hidden')
                                <span class="bg-warning/10 text-warning rounded-full px-2 py-0.5 text-[11px] font-bold">
                                    {{ __('community.hidden') }}
                                </span>
                            @endif
                            <span class="text-dim ltr-nums ms-auto text-xs">{{ $comment->created_at?->isoFormat('LLL') }}</span>
                        </div>

                        <p class="text-muted mt-1.5 text-sm leading-relaxed whitespace-pre-line">{{ $comment->text }}</p>

                        @if ($comment->hidden_reason)
                            <p class="text-dim mt-1 text-xs">{{ $comment->hidden_reason }}</p>
                        @endif

                        @php($href = $thread['link']($comment))
                        @if ($href)
                            <a href="{{ \App\Support\Nav::href($href) }}" class="text-primary mt-1.5 block truncate text-xs font-bold underline">
                                {{ $thread['context']($comment) }}
                            </a>
                        @endif

                        <div class="mt-3 flex flex-wrap items-center gap-2">
                            @if ($comment->status === 'hidden')
                                <form method="POST" action="{{ \App\Support\Nav::href($thread['base'].$comment->id.'/afficher') }}">
                                    @csrf
                                    <button class="text-primary rounded-input border-border border px-4 py-2 text-xs font-bold">
                                        {{ __('admin.comments.show') }}
                                    </button>
                                </form>
                            @else
                                <form method="POST" action="{{ \App\Support\Nav::href($thread['base'].$comment->id.'/masquer') }}"
                                    class="flex min-w-0 flex-1 items-center gap-2">
                                    @csrf
                                    <input name="reason" maxlength="255" placeholder="{{ __('admin.comments.reason') }}"
                                        class="rounded-input border-border min-w-0 flex-1 border px-3 py-2 text-xs">
                                    <button class="text-muted rounded-input border-border border px-4 py-2 text-xs font-bold">
                                        {{ __('admin.comments.hide') }}
                                    </button>
                                </form>
                            @endif

                            <form method="POST" action="{{ \App\Support\Nav::href($thread['base'].$comment->id) }}">
                                @csrf
                                @method('DELETE')
                                <button class="text-danger rounded-input border-danger/40 border px-4 py-2 text-xs font-bold">
                                    {{ __('admin.comments.delete') }}
                                </button>
                            </form>
                        </div>
                    </li>
                @empty
                    <li class="rounded-card border-border bg-surface border border-dashed px-6 py-10 text-center font-bold">
                        {{ __('admin.comments.none') }}
                    </li>
                @endforelse
            </ul>
        </section>
    @endforeach
</x-admin.page>
