{{-- The work list: drafts included, ordered by when a piece was last touched
     rather than by publication. This is not the feed. --}}
<x-admin.page :root="false" :title="__('admin.nav.articles')" :subtitle="__('article.admin_subtitle')">

    <a href="{{ \App\Support\Nav::href('/admin/articles/nouveau') }}"
        class="bg-accent rounded-input mt-4 inline-block px-5 py-3 text-sm font-bold text-white">
        {{ __('article.new') }}
    </a>

    <ul class="mt-4 space-y-2">
        @forelse ($articles as $article)
            <li class="rounded-card border-border bg-surface shadow-soft border p-4">
                <div class="flex flex-wrap items-center gap-2">
                    <span class="{{ $article->isPublished() ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning' }} rounded-full px-2 py-0.5 text-[11px] font-bold">
                        {{ __('article.status.'.$article->status) }}
                    </span>
                    <span class="text-dim ltr-nums ms-auto text-xs">{{ $article->updated_at?->isoFormat('LLL') }}</span>
                </div>

                <h2 class="mt-1.5 text-sm font-black">{{ $article->title }}</h2>
                <p dir="ltr" class="text-dim text-start text-[11px] break-all">{{ $article->slug }}</p>
                <p class="text-muted mt-1 line-clamp-2 text-xs">{{ $article->excerpt }}</p>

                <div class="mt-3 flex flex-wrap items-center gap-2">
                    <a href="{{ \App\Support\Nav::href('/admin/articles/'.$article->id.'/modifier') }}"
                        class="text-primary rounded-input border-border border px-4 py-2 text-xs font-bold">
                        {{ __('article.edit') }}
                    </a>

                    @if ($article->isPublished())
                        <a href="{{ \App\Support\Nav::href($article->path()) }}"
                            class="text-muted rounded-input border-border border px-4 py-2 text-xs font-bold">
                            {{ __('article.view') }}
                        </a>
                    @endif
                </div>
            </li>
        @empty
            <li class="rounded-card border-border bg-surface border border-dashed px-6 py-12 text-center font-bold">
                {{ __('article.none_admin') }}
            </li>
        @endforelse
    </ul>

    <div class="mt-6">{{ $articles->links() }}</div>
</x-admin.page>
