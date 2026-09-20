<x-layout.app :title="__('community.requests')">
    <x-layout.header />

    <main class="flex-1 py-6">
        <x-layout.container max="max-w-3xl">
            <div class="flex items-center justify-between">
                <h1 class="text-xl font-black">{{ __('community.requests') }}</h1>
                <a href="{{ \App\Support\Nav::href('/demandes/nouvelle') }}"
                    class="bg-accent rounded-input px-4 py-2.5 text-sm font-bold text-white">{{ __('community.new_request') }}</a>
            </div>

            <ul class="mt-5 space-y-3">
                @forelse ($requests as $item)
                    <li class="rounded-card border-border bg-surface shadow-soft border p-4">
                        <a href="{{ \App\Support\Nav::href($item->path()) }}" class="block">
                            <p class="text-dim text-xs font-bold">{{ __('community.intent_'.$item->intent) }}</p>
                            <h2 class="mt-0.5 text-sm font-bold">{{ $item->title }}</h2>
                            <p class="text-dim mt-1 text-xs">{{ $item->placeLabel() }} · {{ $item->owner_name }}</p>
                            <p class="text-muted ltr-nums mt-2 text-xs font-semibold">{{ $item->reply_count }}</p>
                        </a>
                    </li>
                @empty
                    <li class="rounded-card border-border bg-surface border border-dashed px-6 py-12 text-center font-bold">
                        {{ __('community.no_requests') }}
                    </li>
                @endforelse
            </ul>

            <div class="mt-6">{{ $requests->links() }}</div>
        </x-layout.container>
    </main>
</x-layout.app>
