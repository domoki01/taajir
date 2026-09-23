<x-layout.app :title="__('follow.notifications_title')">
    <x-layout.header />

    <main class="flex-1 py-6">
        <x-layout.container max="max-w-2xl">
            <div class="flex items-center justify-between">
                <h1 class="text-xl font-black">{{ __('follow.notifications_title') }}</h1>

                @if ($unread > 0)
                    <form method="POST" action="{{ \App\Support\Nav::href('/tableau-de-bord/notifications/lues') }}">
                        @csrf
                        <button class="text-primary text-xs font-bold">{{ __('follow.mark_read') }}</button>
                    </form>
                @endif
            </div>

            <ul class="mt-5 space-y-2">
                @forelse ($notifications as $notification)
                    {{-- Unread carries a tinted surface and a navy rule, never
                         the accent: accent is for things you press, and a list
                         of unread rows would swamp the buttons on the page. --}}
                    <li class="rounded-card border-border {{ $notification->isUnread() ? 'bg-primary/5 border-primary/30' : 'bg-surface' }} border">
                        <a href="{{ \App\Support\Nav::href($notification->url) }}" class="block p-4">
                            <p class="text-sm font-bold">{{ $notification->title }}</p>
                            @if ($notification->body)
                                <p class="text-dim mt-1 text-sm leading-relaxed">{{ $notification->body }}</p>
                            @endif
                            <p class="text-dim ltr-nums mt-1 text-xs">{{ $notification->created_at?->diffForHumans() }}</p>
                        </a>
                    </li>
                @empty
                    <li class="rounded-card border-border bg-surface text-dim border border-dashed px-6 py-12 text-center text-sm font-bold">
                        {{ __('follow.notifications_empty') }}
                    </li>
                @endforelse
            </ul>

            <div class="mt-6">{{ $notifications->links() }}</div>
        </x-layout.container>
    </main>
</x-layout.app>
