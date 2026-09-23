{{-- The masthead index.

     These pages exist for a reason that is not editorial: a classifieds site
     with nothing but listings has almost no text a search engine can index
     against a question. --}}
<x-layout.app :title="__('article.articles')" :description="__('article.meta_description')">
    <x-layout.header />

    <main class="flex-1 py-6">
        <x-layout.container max="max-w-3xl">
            <h1 class="text-2xl font-black">{{ __('article.articles') }}</h1>
            <p class="text-muted mt-1 text-sm font-semibold">{{ __('article.index_subtitle') }}</p>

            @forelse ($articles as $article)
                <article class="border-border mt-5 border-t pt-5 first:mt-6">
                    <a href="{{ \App\Support\Nav::href($article->path()) }}" class="flex items-start gap-3">
                        @if ($article->cover_url)
                            <img src="{{ $article->cover_url }}" alt="{{ $article->cover_alt }}"
                                loading="lazy" decoding="async"
                                class="rounded-input size-20 shrink-0 object-cover">
                        @endif

                        <div class="min-w-0 flex-1">
                            <h2 class="text-primary text-base font-black">{{ $article->title }}</h2>
                            <p class="text-muted mt-1 line-clamp-2 text-sm leading-relaxed">{{ $article->excerpt }}</p>
                            <p class="text-dim ltr-nums mt-1.5 text-xs font-bold">
                                {{ $article->published_at?->isoFormat('LL') }}
                                · {{ __('article.read_minutes', ['count' => $article->read_minutes]) }}
                            </p>
                        </div>
                    </a>
                </article>
            @empty
                <p class="rounded-card border-border bg-surface mt-6 border border-dashed px-6 py-12 text-center font-bold">
                    {{ __('article.none') }}
                </p>
            @endforelse

            <div class="mt-6">{{ $articles->links() }}</div>
        </x-layout.container>
    </main>
</x-layout.app>
