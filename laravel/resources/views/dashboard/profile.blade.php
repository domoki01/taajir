<x-layout.app :title="__('profile.title')">
    <x-layout.header />

    <main class="flex-1 py-6">
        <x-layout.container max="max-w-2xl">
            <h1 class="text-xl font-black">{{ __('profile.title') }}</h1>
            <p class="text-dim mt-1 text-sm leading-relaxed">{{ __('profile.lead') }}</p>

            @if (session('status'))
                <p class="rounded-input bg-success/10 text-success mt-4 px-3 py-2 text-sm font-semibold">{{ session('status') }}</p>
            @endif

            {{-- The public page, linked from the private one: "what do other
                 people see?" is the first question this screen raises. --}}
            <a href="{{ \App\Support\Nav::href($user->profileUrl()) }}"
               class="rounded-card border-border bg-surface mt-5 flex items-center justify-between border p-4">
                <span>
                    <span class="block text-sm font-bold">{{ __('profile.public_page') }}</span>
                    <span class="text-dim ltr-nums mt-0.5 block text-xs">{{ __('profile.followers', ['count' => $followerCount]) }}</span>
                </span>
                <span class="text-primary text-xs font-bold">{{ __('profile.view_public') }}</span>
            </a>

            <form method="POST" action="{{ \App\Support\Nav::href('/tableau-de-bord/profil') }}" class="mt-6 space-y-4">
                @csrf

                <div>
                    <label for="display_name" class="text-muted block text-sm font-bold">{{ __('profile.display_name') }}</label>
                    <input id="display_name" name="display_name" required maxlength="80"
                           value="{{ old('display_name', $user->display_name) }}"
                           class="rounded-input border-border mt-1 w-full border px-3 py-2.5 text-sm">
                    @error('display_name')<p class="text-danger mt-1 text-xs font-semibold">{{ $message }}</p>@enderror
                </div>

                <div>
                    <label for="phone" class="text-muted block text-sm font-bold">{{ __('profile.phone') }}</label>
                    <input id="phone" name="phone" type="tel" inputmode="tel" dir="ltr" maxlength="20"
                           value="{{ old('phone', $user->phone) }}"
                           class="rounded-input border-border ltr-nums mt-1 w-full border px-3 py-2.5 text-sm">
                    <p class="text-dim mt-1 text-xs">{{ __('profile.phone_hint') }}</p>
                    @error('phone')<p class="text-danger mt-1 text-xs font-semibold">{{ $message }}</p>@enderror
                </div>

                <div>
                    <label for="wilaya" class="text-muted block text-sm font-bold">{{ __('profile.wilaya') }}</label>
                    <select id="wilaya" name="wilaya"
                            class="rounded-input border-border mt-1 w-full border px-3 py-2.5 text-sm">
                        <option value="">{{ __('profile.wilaya_none') }}</option>
                        @foreach ($wilayas as $w)
                            <option value="{{ $w->slug }}" @selected(old('wilaya', $user->wilaya_code) === $w->code || old('wilaya') === $w->slug)>{{ $w->name() }}</option>
                        @endforeach
                    </select>
                </div>

                <fieldset class="rounded-card border-border bg-surface border p-4">
                    <legend class="px-1 text-sm font-bold">{{ __('profile.notifications') }}</legend>

                    <label class="mt-2 flex items-center gap-2 text-sm">
                        <input type="checkbox" name="notify_on_message" value="1" @checked($user->notify_on_message)>
                        {{ __('profile.notify_on_message') }}
                    </label>

                    <label class="mt-2 flex items-center gap-2 text-sm">
                        <input type="checkbox" name="notify_on_saved_search" value="1" @checked($user->notify_on_saved_search)>
                        {{ __('profile.notify_on_saved_search') }}
                    </label>
                </fieldset>

                <button class="bg-accent rounded-input w-full py-3 text-sm font-bold text-white transition-opacity hover:opacity-90">
                    {{ __('profile.save') }}
                </button>
            </form>
        </x-layout.container>
    </main>
</x-layout.app>
