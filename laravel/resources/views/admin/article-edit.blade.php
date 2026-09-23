{{-- The editor.

     A textarea and three prefixes, which is as much syntax as somebody writing
     Arabic into a form should have to remember. The body is stored as blocks,
     never as markup: rendering stored HTML would put a staff account one
     compromise away from script on every page of the site. --}}
@php
    $isNew = $article === null;
    $action = $isNew
        ? \App\Support\Nav::href('/admin/articles')
        : \App\Support\Nav::href('/admin/articles/'.$article->id);
@endphp

<x-admin.page :root="false" :title="$isNew ? __('article.new') : __('article.edit')">

    <form method="POST" action="{{ $action }}" class="mt-4 space-y-4">
        @csrf
        @unless ($isNew)
            @method('PATCH')
        @endunless

        <div class="rounded-card border-border bg-surface shadow-soft border p-4 space-y-3">
            <label class="block">
                <span class="text-xs font-bold">{{ __('article.title') }}</span>
                <input name="title" required minlength="10" maxlength="120"
                    value="{{ old('title', $article?->title) }}"
                    class="rounded-input border-border mt-1 w-full border px-3 py-2 text-sm">
            </label>

            <label class="block">
                {{-- Latin and hyphenated. An Arabic slug percent-encodes into
                     unreadable bytes and breaks the WhatsApp preview these are
                     shared through, so the field refuses one rather than
                     transliterating it into something nobody can read. --}}
                <span class="text-xs font-bold">{{ __('article.slug') }}</span>
                <input name="slug" dir="ltr" required maxlength="70" placeholder="marche-immobilier-algerie"
                    value="{{ old('slug', $article?->slug) }}"
                    class="rounded-input border-border mt-1 w-full border px-3 py-2 text-start text-sm">
            </label>

            <label class="block">
                <span class="text-xs font-bold">{{ __('article.excerpt') }}</span>
                <textarea name="excerpt" required minlength="20" maxlength="300" rows="2"
                    class="rounded-input border-border mt-1 w-full border px-3 py-2 text-sm">{{ old('excerpt', $article?->excerpt) }}</textarea>
                <span class="text-dim mt-1 block text-[11px]">{{ __('article.excerpt_hint') }}</span>
            </label>
        </div>

        <div class="rounded-card border-border bg-surface shadow-soft border p-4">
            <label class="block">
                <span class="text-xs font-bold">{{ __('article.body') }}</span>
                <textarea name="body" required rows="18"
                    class="rounded-input border-border mt-1 w-full border px-3 py-2 font-mono text-sm leading-relaxed">{{ old('body', $body) }}</textarea>
            </label>
            <p class="text-dim mt-2 text-[11px] leading-relaxed whitespace-pre-line">{{ __('article.syntax') }}</p>
        </div>

        <div class="rounded-card border-border bg-surface shadow-soft border p-4 space-y-3">
            <label class="block">
                <span class="text-xs font-bold">{{ __('article.cover') }}</span>
                <input name="cover_url" dir="ltr" maxlength="500" placeholder="https://…"
                    value="{{ old('cover_url', $article?->cover_url) }}"
                    class="rounded-input border-border mt-1 w-full border px-3 py-2 text-start text-sm">
                <span class="text-dim mt-1 block text-[11px]">{{ __('article.cover_hint') }}</span>
            </label>

            <label class="block">
                <span class="text-xs font-bold">{{ __('article.cover_alt') }}</span>
                <input name="cover_alt" maxlength="140"
                    value="{{ old('cover_alt', $article?->cover_alt) }}"
                    class="rounded-input border-border mt-1 w-full border px-3 py-2 text-sm">
            </label>

            <label class="block">
                <span class="text-xs font-bold">{{ __('article.tags') }}</span>
                <input name="tags" maxlength="200" placeholder="{{ __('article.tags_placeholder') }}"
                    value="{{ old('tags', implode('، ', $article?->tags ?? [])) }}"
                    class="rounded-input border-border mt-1 w-full border px-3 py-2 text-sm">
            </label>

            <label class="block">
                <span class="text-xs font-bold">{{ __('article.status_label') }}</span>
                <select name="status" class="rounded-input border-border bg-surface mt-1 w-full border px-3 py-2 text-sm font-semibold">
                    @foreach (['draft', 'published'] as $status)
                        <option value="{{ $status }}" @selected(old('status', $article?->status ?? 'draft') === $status)>
                            {{ __('article.status.'.$status) }}
                        </option>
                    @endforeach
                </select>
            </label>
        </div>

        <button class="bg-accent rounded-input w-full px-5 py-3 text-sm font-bold text-white">
            {{ __('article.save') }}
        </button>
    </form>

    @unless ($isNew)
        {{-- Deleting takes the thread with it: left behind, its comments are
             orphans no screen can reach or moderate. --}}
        <form method="POST" action="{{ $action }}" class="mt-3">
            @csrf
            @method('DELETE')
            <button class="text-danger rounded-input border-danger/40 w-full border px-5 py-3 text-xs font-bold">
                {{ __('article.delete') }}
            </button>
        </form>
    @endunless
</x-admin.page>
