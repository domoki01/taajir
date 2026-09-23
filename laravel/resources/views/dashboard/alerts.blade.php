<x-layout.app :title="__('community.alerts')">
    <x-layout.header />

    <main class="flex-1 py-6">
        <x-layout.container max="max-w-2xl">
            <h1 class="text-xl font-black">{{ __('community.alerts') }}</h1>

            @error('wilaya')<p class="text-danger mt-2 text-sm font-semibold">{{ $message }}</p>@enderror

            <ul class="mt-5 space-y-3">
                @forelse ($searches as $search)
                    <li class="rounded-card border-border bg-surface flex items-center justify-between border p-4">
                        <div>
                            <p class="text-sm font-bold">{{ $search->label }}</p>
                            @unless ($search->notify)
                                <p class="text-dim mt-0.5 text-xs">{{ __('community.notify_on') }} — {{ __('listing.reset') }}</p>
                            @endunless
                        </div>
                        <form method="POST" action="{{ \App\Support\Nav::href('/tableau-de-bord/alertes/'.$search->id) }}">
                            @csrf @method('DELETE')
                            <button class="text-danger text-xs font-bold">{{ __('community.delete') }}</button>
                        </form>
                    </li>
                @empty
                    <li class="rounded-card border-border bg-surface border border-dashed px-6 py-12 text-center font-bold">
                        {{ __('community.no_alerts') }}
                    </li>
                @endforelse
            </ul>
        </x-layout.container>
    </main>
</x-layout.app>
