{{-- ── IDENTITY ─────────────────────────────────────────────────────────────
     Six colours, not sixty. Every token in app.css could in principle be
     editable, but the surface greys and the two secondary text greys are what
     hold the site's contrast at AA — handing those over is handing over the
     ability to make the whole site unreadable in one save. --}}
<x-admin.page :root="false" :title="__('admin.nav.branding')" :subtitle="__('admin.branding.subtitle')">

    <form method="POST" action="{{ \App\Support\Nav::href('/admin/identite') }}" class="mt-4 space-y-4">
        @csrf

        <div class="rounded-card border-border bg-surface shadow-soft border p-4">
            <label class="block">
                <span class="text-xs font-bold">{{ __('admin.branding.site_name') }}</span>
                <input name="site_name" required minlength="2" maxlength="30"
                    value="{{ old('site_name', $branding->siteName) }}"
                    class="rounded-input border-border mt-1 w-full border px-3 py-2 text-sm">
            </label>

            <label class="mt-3 block">
                <span class="text-xs font-bold">{{ __('admin.branding.tagline') }}</span>
                <input name="tagline" required minlength="3" maxlength="60"
                    value="{{ old('tagline', $branding->tagline) }}"
                    class="rounded-input border-border mt-1 w-full border px-3 py-2 text-sm">
            </label>

            <label class="mt-3 block">
                <span class="text-xs font-bold">{{ __('admin.branding.logo') }}</span>
                {{-- Latin run: an https URL inside an Arabic page reorders
                     around its slashes without dir="ltr". --}}
                <input name="logo_url" type="url" dir="ltr" maxlength="500" placeholder="https://…"
                    value="{{ old('logo_url', $branding->logoUrl) }}"
                    class="rounded-input border-border mt-1 w-full border px-3 py-2 text-start text-sm">
                <span class="text-dim mt-1 block text-[11px]">{{ __('admin.branding.logo_hint') }}</span>
            </label>
        </div>

        <div class="rounded-card border-border bg-surface shadow-soft border p-4">
            <h2 class="text-sm font-black">{{ __('admin.branding.colours') }}</h2>
            {{-- The split is load-bearing: navy carries structure, emerald
                 carries the things you press. The first price or link that
                 borrows the button colour is the point the buttons stop reading
                 as buttons. --}}
            <p class="text-muted mt-1 text-xs leading-relaxed">{{ __('admin.branding.colours_note') }}</p>

            <div class="mt-3 space-y-3">
                @foreach (\App\Services\Branding::VARIABLES as $key => $variable)
                    @php($value = old('colors.'.$key, $branding->colors[$key] ?? ''))
                    {{-- A colour well and a text field bound to one value. The
                         well is for picking; the field is for pasting a hex
                         somebody sent you, and for clearing it back to the
                         build's colour — which a colour input cannot express,
                         since it has no empty state. The `name` is on the text
                         field alone, so an emptied field posts empty.

                         x-data is on the wrapper: $refs only reaches inside the
                         component that declared them, so declaring it on the
                         well would leave the field out of scope. --}}
                    <div class="flex items-center gap-3" x-data="{ hex: @js($value) }">
                        <input type="color" aria-hidden="true" tabindex="-1"
                            :value="hex || '#000000'" x-on:input="hex = $event.target.value"
                            class="size-9 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0">
                        <label class="min-w-0 flex-1">
                            <span class="block text-xs font-bold">{{ __('admin.branding.colour_names.'.$key) }}</span>
                            <input name="colors[{{ $key }}]" x-model="hex" dir="ltr" placeholder="#rrggbb"
                                pattern="#[0-9a-fA-F]{6}"
                                class="rounded-input border-border ltr-nums mt-1 w-32 border px-3 py-2 text-start text-xs">
                        </label>
                    </div>
                @endforeach
            </div>

            <p class="text-dim mt-3 text-[11px]">{{ __('admin.branding.clear_hint') }}</p>
        </div>

        <button class="bg-accent rounded-input w-full px-5 py-3 text-sm font-bold text-white">
            {{ __('admin.branding.save') }}
        </button>
    </form>

    <form method="POST" action="{{ \App\Support\Nav::href('/admin/identite/defaut') }}" class="mt-3">
        @csrf
        @method('DELETE')
        <button class="text-muted rounded-input border-border w-full border px-5 py-3 text-xs font-bold">
            {{ __('admin.branding.reset', ['name' => $defaults['siteName']]) }}
        </button>
    </form>
</x-admin.page>
