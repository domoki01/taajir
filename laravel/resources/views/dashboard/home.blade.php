{{-- Where signing in lands.

     A shell: phase 3's job is that Google and phone sign-in both reach a page
     that knows who you are. The screens it links to arrive with the features
     they list, from phase 5 on. --}}
<x-layout.app :title="__('nav.account_links.dashboard')">
    <x-layout.header />

    <main class="flex-1 py-8">
        <x-layout.container max="max-w-3xl">
            <h1 class="text-2xl font-black">{{ $user->display_name }}</h1>
            <p class="text-dim ltr-nums mt-1 text-sm">{{ $user->email ?? $user->phone }}</p>

            @unless ($user->approved)
                <p class="rounded-card bg-warning/10 text-warning mt-5 px-4 py-3 text-sm font-semibold leading-relaxed">
                    {{ __('auth.awaiting_approval') }}
                </p>
            @endunless

            <ul class="mt-6 space-y-2">
                @foreach (\App\Support\Nav::accountLinks() as $link)
                    <li>
                        <a
                            href="{{ \App\Support\Nav::href($link['href']) }}"
                            class="rounded-card border-border bg-surface hover:border-primary block border px-4 py-3 text-sm font-bold transition-colors"
                        >{{ $link['label'] }}</a>
                    </li>
                @endforeach
            </ul>

            <form method="POST" action="{{ \App\Support\Nav::href('/auth/session') }}" class="mt-8">
                @csrf
                @method('DELETE')
                <button type="submit" class="text-danger text-sm font-bold">{{ __('auth.sign_out') }}</button>
            </form>
        </x-layout.container>
    </main>
</x-layout.app>
