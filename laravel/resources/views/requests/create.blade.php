<x-layout.app :title="__('community.new_request')">
    <main class="flex-1 py-6">
        <x-layout.container max="max-w-xl">
            <h1 class="text-xl font-black">{{ __('community.new_request') }}</h1>

            @if ($errors->any())
                <div role="alert" class="rounded-card bg-danger/10 text-danger mt-4 px-4 py-3 text-sm font-semibold">
                    <ul class="space-y-1">@foreach ($errors->all() as $error)<li>{{ $error }}</li>@endforeach</ul>
                </div>
            @endif

            <form method="POST" action="{{ \App\Support\Nav::href('/demandes') }}" class="mt-5 space-y-4">
                @csrf

                <div>
                    <label for="intent" class="text-muted block text-sm font-bold">{{ __('community.request_intent') }}</label>
                    <select id="intent" name="intent" class="rounded-input border-border mt-1 w-full border px-3 py-2.5 text-sm">
                        <option value="vente">{{ __('community.intent_vente') }}</option>
                        <option value="location">{{ __('community.intent_location') }}</option>
                    </select>
                </div>

                <div>
                    <label for="wilaya" class="text-muted block text-sm font-bold">{{ __('listing.wilaya_field') }}</label>
                    <select id="wilaya" name="wilaya" required class="rounded-input border-border mt-1 w-full border px-3 py-2.5 text-sm">
                        @foreach ($wilayas as $w)
                            <option value="{{ $w->slug }}" @selected(old('wilaya') === $w->slug)>{{ $w->name() }}</option>
                        @endforeach
                    </select>
                </div>

                <div>
                    <label for="title" class="text-muted block text-sm font-bold">{{ __('listing.title_field') }}</label>
                    <input id="title" name="title" value="{{ old('title') }}" required minlength="10" maxlength="90"
                        class="rounded-input border-border mt-1 w-full border px-3 py-2.5 text-sm">
                </div>

                <div>
                    <label for="description" class="text-muted block text-sm font-bold">{{ __('listing.description_field') }}</label>
                    <textarea id="description" name="description" rows="5" required minlength="20" maxlength="2000"
                        class="rounded-input border-border mt-1 w-full border px-3 py-2.5 text-sm leading-relaxed">{{ old('description') }}</textarea>
                </div>

                <button class="bg-accent rounded-input w-full py-3 text-sm font-bold text-white">{{ __('community.send') }}</button>
            </form>
        </x-layout.container>
    </main>
</x-layout.app>
