{{-- One article.

     The body is a list of blocks, and each block is a list of plain-text runs.
     Nothing here is printed unescaped — that is the whole reason the body is
     not markup: rendering stored HTML would put a staff account one compromise
     away from script on every page of the site. --}}
<x-layout.app :title="$article->title" :description="$article->excerpt">
    @push('head')
        {{-- The cover is validated to https or a same-origin path before it is
             stored, which matters most here: og:image is fetched by *other
             people's* servers on every shared link. --}}
        @if ($article->cover_url)
            <meta property="og:image" content="{{ url($article->cover_url) }}">
        @endif
    @endpush

    <x-layout.header />

    <main class="flex-1 py-6">
        <x-layout.container max="max-w-3xl">
            <article>
                <h1 class="text-2xl leading-snug font-black">{{ $article->title }}</h1>

                <p class="text-dim ltr-nums mt-2 text-xs font-bold">
                    {{ $article->author_name }}
                    · {{ $article->published_at?->isoFormat('LL') }}
                    · {{ __('article.read_minutes', ['count' => $article->read_minutes]) }}
                </p>

                @if ($article->cover_url)
                    <img src="{{ $article->cover_url }}" alt="{{ $article->cover_alt }}"
                        class="rounded-card mt-4 w-full object-cover">
                @endif

                <p class="text-muted mt-4 text-base leading-relaxed font-semibold">{{ $article->excerpt }}</p>

                <div class="mt-6 space-y-4">
                    @foreach ($article->blocks() as $block)
                        @php
                            // The one piece of inline syntax there is, resolved
                            // into runs of text before it reaches here: a
                            // <strong> with text inside it, never a string
                            // carrying a tag.
                            $runs = $block['runs'];
                        @endphp

                        @if ($block['type'] === 'h2')
                            <h2 class="text-primary mt-8 text-lg font-black">
                                @foreach ($runs as $run)<span @class(['font-black' => $run['bold']])>{{ $run['text'] }}</span>@endforeach
                            </h2>
                        @elseif ($block['type'] === 'li')
                            <p class="flex gap-2 text-base leading-relaxed">
                                <span class="text-accent shrink-0" aria-hidden="true">•</span>
                                <span>@foreach ($runs as $run)<span @class(['font-extrabold' => $run['bold']])>{{ $run['text'] }}</span>@endforeach</span>
                            </p>
                        @elseif ($block['type'] === 'quote')
                            <blockquote class="border-primary/30 text-muted border-s-4 ps-4 text-base leading-relaxed font-semibold italic">
                                @foreach ($runs as $run)<span @class(['font-extrabold' => $run['bold']])>{{ $run['text'] }}</span>@endforeach
                            </blockquote>
                        @else
                            <p class="text-base leading-relaxed">
                                @foreach ($runs as $run)<span @class(['font-extrabold' => $run['bold']])>{{ $run['text'] }}</span>@endforeach
                            </p>
                        @endif
                    @endforeach
                </div>

                @if ($article->tags)
                    <ul class="mt-8 flex flex-wrap gap-2">
                        @foreach ($article->tags as $tag)
                            <li class="bg-primary/5 text-primary rounded-full px-3 py-1 text-xs font-bold">{{ $tag }}</li>
                        @endforeach
                    </ul>
                @endif
            </article>

            <section class="border-border mt-10 border-t pt-6">
                <h2 class="text-lg font-extrabold">
                    {{ __('community.comments') }}
                    <span class="text-dim ltr-nums ms-1 text-sm font-bold">{{ $comments->count() }}</span>
                </h2>

                @if (session('status'))
                    <p class="rounded-card bg-success/10 text-success mt-3 px-4 py-3 text-sm font-bold">{{ session('status') }}</p>
                @endif

                @error('text')
                    <p class="rounded-card bg-danger/10 text-danger mt-3 px-4 py-3 text-sm font-bold">{{ $message }}</p>
                @enderror

                <ul class="mt-4 space-y-4">
                    @forelse ($comments as $comment)
                        <li class="border-border border-t pt-4 first:border-t-0 first:pt-0">
                            <p class="text-sm font-bold">
                                {{ $comment->author_name }}
                                @if ($comment->status === 'hidden')
                                    <span class="bg-warning/10 text-warning ms-1 rounded-full px-2 py-0.5 text-[11px] font-bold">
                                        {{ __('community.hidden') }}
                                    </span>
                                @endif
                            </p>
                            <p class="text-muted mt-1 text-sm leading-relaxed whitespace-pre-line">{{ $comment->text }}</p>
                            <p class="text-dim ltr-nums mt-1 text-xs">{{ $comment->created_at?->isoFormat('LLL') }}</p>

                            @if (auth()->check() && (auth()->id() === $comment->author_uid || auth()->user()->hasPermission(\App\Enums\Permission::CommentsModerate)))
                                <form method="POST" action="{{ \App\Support\Nav::href('/articles/commentaires/'.$comment->id) }}" class="mt-1">
                                    @csrf
                                    @method('DELETE')
                                    <button class="text-danger text-xs font-bold">{{ __('community.delete') }}</button>
                                </form>
                            @endif
                        </li>
                    @empty
                        <li class="text-muted text-sm">{{ __('community.no_comments') }}</li>
                    @endforelse
                </ul>

                @auth
                    <form method="POST" action="{{ \App\Support\Nav::href($article->path().'/commentaires') }}" class="mt-5">
                        @csrf
                        <textarea name="text" required minlength="2" maxlength="1000" rows="3"
                            placeholder="{{ __('community.comment_placeholder') }}"
                            class="rounded-input border-border w-full border px-3 py-2 text-sm"></textarea>
                        <button class="bg-accent rounded-input mt-2 px-5 py-2.5 text-sm font-bold text-white">
                            {{ __('community.send') }}
                        </button>
                    </form>
                @else
                    <p class="text-muted mt-5 text-sm">
                        <a href="{{ \App\Support\Nav::href('/connexion') }}" class="text-primary font-bold underline">
                            {{ __('article.sign_in_to_comment') }}
                        </a>
                    </p>
                @endauth
            </section>
        </x-layout.container>
    </main>
</x-layout.app>
