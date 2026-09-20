{{-- ── BANNERS ──────────────────────────────────────────────────────────────
     The home-page carousel. Ten at most: past that the carousel is a place
     adverts go to not be seen, which is not what an agency paid for. --}}
<x-admin.page :root="false" :title="__('admin.nav.promos')"
    :subtitle="__('admin.promos.count', ['count' => $promos->count(), 'max' => $max])">

    <form method="POST" action="{{ \App\Support\Nav::href('/admin/publicites') }}" enctype="multipart/form-data"
        class="rounded-card border-border bg-surface shadow-soft mt-4 border p-4">
        @csrf

        <h2 class="text-sm font-black">{{ __('admin.promos.new') }}</h2>

        <label class="mt-3 block">
            <span class="text-xs font-bold">{{ __('admin.promos.image') }}</span>
            <input type="file" name="image" accept="image/jpeg,image/png,image/webp" required
                class="mt-1 w-full text-xs">
        </label>

        <label class="mt-3 block">
            {{-- The title is the alt text as well as the label, so it describes
                 the advert rather than naming it. --}}
            <span class="text-xs font-bold">{{ __('admin.promos.title') }}</span>
            <input name="title" required minlength="2" maxlength="140" placeholder="{{ __('admin.promos.title_placeholder') }}"
                class="rounded-input border-border mt-1 w-full border px-3 py-2 text-sm">
        </label>

        <label class="mt-3 block">
            <span class="text-xs font-bold">{{ __('admin.promos.link') }}</span>
            <input name="link_url" dir="ltr" required maxlength="500" placeholder="/vente/appartement/alger"
                class="rounded-input border-border mt-1 w-full border px-3 py-2 text-start text-sm">
            <span class="text-dim mt-1 block text-[11px]">{{ __('admin.promos.link_hint') }}</span>
        </label>

        <button class="bg-accent rounded-input mt-3 w-full px-5 py-3 text-sm font-bold text-white"
            @disabled($promos->count() >= $max)>
            {{ __('admin.promos.add') }}
        </button>
    </form>

    <ul class="mt-4 space-y-3">
        @foreach ($promos as $promo)
            @php($action = fn (string $path) => \App\Support\Nav::href('/admin/publicites/'.$promo->id.$path))

            <li class="rounded-card border-border bg-surface shadow-soft border p-4 {{ $promo->is_active ? '' : 'opacity-60' }}">
                <img src="{{ $promo->image_url }}" alt="{{ $promo->title }}"
                    width="{{ $promo->width }}" height="{{ $promo->height }}"
                    class="rounded-input w-full object-cover">

                <form method="POST" action="{{ $action('') }}" class="mt-3 space-y-2">
                    @csrf
                    @method('PATCH')
                    <input name="title" required minlength="2" maxlength="140" value="{{ $promo->title }}"
                        aria-label="{{ __('admin.promos.title') }}"
                        class="rounded-input border-border w-full border px-3 py-2 text-xs">
                    <div class="flex flex-wrap items-center gap-2">
                        <input name="link_url" dir="ltr" required maxlength="500" value="{{ $promo->link_url }}"
                            aria-label="{{ __('admin.promos.link') }}"
                            class="rounded-input border-border min-w-0 flex-1 border px-3 py-2 text-start text-xs">
                        <button class="text-primary rounded-input border-border border px-4 py-2 text-xs font-bold">
                            {{ __('admin.promos.save') }}
                        </button>
                    </div>
                </form>

                <div class="mt-2 flex flex-wrap items-center gap-2">
                    <form method="POST" action="{{ $action('/visibilite') }}">
                        @csrf
                        <input type="hidden" name="active" value="{{ $promo->is_active ? 0 : 1 }}">
                        <button class="text-muted rounded-input border-border border px-4 py-2 text-xs font-bold">
                            {{ $promo->is_active ? __('admin.promos.hide') : __('admin.promos.show') }}
                        </button>
                    </form>

                    {{-- Order is rewritten by position on every move, so two
                         banners can never end up sharing a slot — which is
                         exactly the complaint whoever paid for the first one
                         would make. --}}
                    <form method="POST" action="{{ $action('/ordre') }}">
                        @csrf
                        <input type="hidden" name="direction" value="up">
                        <button class="text-muted rounded-input border-border border px-3 py-2 text-xs font-bold"
                            aria-label="{{ __('admin.promos.move_up') }}" @disabled($loop->first)>↑</button>
                    </form>

                    <form method="POST" action="{{ $action('/ordre') }}">
                        @csrf
                        <input type="hidden" name="direction" value="down">
                        <button class="text-muted rounded-input border-border border px-3 py-2 text-xs font-bold"
                            aria-label="{{ __('admin.promos.move_down') }}" @disabled($loop->last)>↓</button>
                    </form>

                    <form method="POST" action="{{ $action('') }}" class="ms-auto">
                        @csrf
                        @method('DELETE')
                        <button class="text-danger rounded-input border-danger/40 border px-4 py-2 text-xs font-bold">
                            {{ __('admin.promos.delete') }}
                        </button>
                    </form>
                </div>
            </li>
        @endforeach
    </ul>

    @if ($promos->isEmpty())
        <p class="rounded-card border-border bg-surface mt-4 border border-dashed px-6 py-12 text-center font-bold">
            {{ __('admin.promos.none') }}
        </p>
    @endif
</x-admin.page>
