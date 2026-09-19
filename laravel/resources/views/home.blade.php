{{-- Placeholder. The real home page — featured ads, latest ads, the promo
     carousel and the wilaya tiles — is phase 4, once listings have a read path.
     Until then this renders the shell, which is what phase 1 is for: the header,
     the phone bars and the side menu are the same on every screen, and this is
     where they get looked at. --}}
<x-layout.app>
    <x-layout.header />

    <main class="flex-1 py-16">
        <x-layout.container max="max-w-3xl" class="text-center">
            <h1 class="text-3xl font-black">{{ __('brand.name') }}</h1>
            <p class="text-muted mt-2">{{ __('brand.tagline') }}</p>
        </x-layout.container>
    </main>
</x-layout.app>
