{{-- The publish wizard.

     One decision per screen, with the button under the thumb — which is why
     this is an immersive route: the bottom nav stands down so the submit button
     owns the bottom of the viewport.

     The steps are client-side and the form posts once. Nothing between them
     needs the server, and a round trip per step on a 3G connection would buy
     latency for nothing. --}}
@php($maxImages = config('taajir.max_images'))

<x-layout.app :title="__('listing.publish_title')">
    <main class="flex-1 py-6">
        <x-layout.container max="max-w-xl">
            <form
                method="POST"
                action="{{ \App\Support\Nav::href('/publier') }}"
                enctype="multipart/form-data"
                x-data="publishWizard()"
                class="pb-24"
            >
                @csrf

                <div class="flex items-center justify-between">
                    <h1 class="text-xl font-black">{{ __('listing.publish_title') }}</h1>
                    <p class="text-dim ltr-nums text-xs font-bold" x-text="`${step} / ${total}`"></p>
                </div>

                {{-- Progress. Navy, because it is information rather than
                     something you press. --}}
                <div class="bg-surface-soft mt-3 h-1.5 overflow-hidden rounded-full">
                    <div class="bg-primary h-full transition-all" x-bind:style="`width: ${(step / total) * 100}%`"></div>
                </div>

                @if ($errors->any())
                    <div role="alert" class="rounded-card bg-danger/10 text-danger mt-4 px-4 py-3 text-sm font-semibold">
                        <ul class="space-y-1">
                            @foreach ($errors->all() as $error)
                                <li>{{ $error }}</li>
                            @endforeach
                        </ul>
                    </div>
                @endif

                {{-- ── 1. what ─────────────────────────────────────────────── --}}
                <section x-show="step === 1" class="mt-6 space-y-4">
                    <div>
                        <label for="transaction_type" class="text-muted block text-sm font-bold">{{ __('listing.transaction_field') }}</label>
                        <select id="transaction_type" name="transaction_type" x-model="form.transaction_type" required
                            class="rounded-input border-border mt-1 w-full border px-3 py-2.5 text-sm">
                            @foreach ($taxonomy->visibleOptions()['transactionTypes'] as $option)
                                <option value="{{ $option['slug'] }}" @selected(old('transaction_type') === $option['slug'])>{{ $option['label'] }}</option>
                            @endforeach
                        </select>
                    </div>

                    <div>
                        <label for="property_type" class="text-muted block text-sm font-bold">{{ __('listing.type_field') }}</label>
                        <select id="property_type" name="property_type" required
                            class="rounded-input border-border mt-1 w-full border px-3 py-2.5 text-sm">
                            @foreach ($taxonomy->visibleOptions()['propertyTypes'] as $option)
                                <option value="{{ $option['slug'] }}" @selected(old('property_type') === $option['slug'])>{{ $option['label'] }}</option>
                            @endforeach
                        </select>
                    </div>
                </section>

                {{-- ── 2. where ────────────────────────────────────────────── --}}
                <section x-show="step === 2" x-cloak class="mt-6 space-y-4">
                    <div>
                        <label for="wilaya" class="text-muted block text-sm font-bold">{{ __('listing.wilaya_field') }}</label>
                        <select id="wilaya" name="wilaya" x-model="wilaya" x-on:change="loadCommunes()" required
                            class="rounded-input border-border mt-1 w-full border px-3 py-2.5 text-sm">
                            <option value="">—</option>
                            @foreach ($wilayas as $w)
                                <option value="{{ $w->slug }}" @selected(old('wilaya') === $w->slug)>{{ $w->name() }}</option>
                            @endforeach
                        </select>
                    </div>

                    <div>
                        <label for="commune" class="text-muted block text-sm font-bold">{{ __('listing.commune_field') }}</label>
                        {{-- Fetched per wilaya rather than embedded: all 1541
                             communes is a quarter of a megabyte nobody on a
                             phone should download to pick one. --}}
                        <select id="commune" name="commune" x-model="commune" required
                            class="rounded-input border-border mt-1 w-full border px-3 py-2.5 text-sm">
                            <template x-for="c in communes" x-bind:key="c.slug">
                                <option x-bind:value="c.slug" x-text="c.name"></option>
                            </template>
                        </select>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label for="rooms_code" class="text-muted block text-sm font-bold">{{ __('listing.rooms') }}</label>
                            <select id="rooms_code" name="rooms_code" class="rounded-input border-border mt-1 w-full border px-3 py-2.5 text-sm">
                                <option value="">—</option>
                                @foreach (\App\Enums\RoomCode::cases() as $room)
                                    <option value="{{ $room->value }}">{{ $room->label() }}</option>
                                @endforeach
                            </select>
                        </div>
                        <div>
                            <label for="area_built" class="text-muted block text-sm font-bold">{{ __('listing.area_built') }}</label>
                            <input id="area_built" type="number" inputmode="numeric" name="area_built" value="{{ old('area_built') }}"
                                class="rounded-input border-border ltr-nums mt-1 w-full border px-3 py-2.5 text-sm">
                        </div>
                    </div>

                    <div>
                        <label for="paperwork" class="text-muted block text-sm font-bold">{{ __('listing.paperwork_label') }}</label>
                        <select id="paperwork" name="paperwork" class="rounded-input border-border mt-1 w-full border px-3 py-2.5 text-sm">
                            <option value="">—</option>
                            @foreach (\App\Enums\Paperwork::cases() as $paper)
                                <option value="{{ $paper->value }}">{{ $paper->label() }}</option>
                            @endforeach
                        </select>
                    </div>
                </section>

                {{-- ── 3. how much, and what it says ───────────────────────── --}}
                <section x-show="step === 3" x-cloak class="mt-6 space-y-4">
                    <div>
                        <label for="price" class="text-muted block text-sm font-bold">{{ __('listing.price_field') }}</label>
                        <input id="price" type="number" inputmode="numeric" name="price" value="{{ old('price') }}"
                            x-model="price" x-bind:disabled="priceOnRequest"
                            class="rounded-input border-border ltr-nums mt-1 w-full border px-3 py-2.5 text-sm disabled:opacity-50">
                        {{-- Typed in dinars, stored in dinars. The ملايين
                             convention is display only, and an input that
                             accepted it would be the 10 000x error waiting. --}}
                        <p class="text-dim ltr-nums mt-1 text-xs" x-show="price > 0" x-text="millions"></p>
                    </div>

                    <label class="flex items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" name="price_on_request" value="1" x-model="priceOnRequest">
                        {{ __('price.negotiable') }}
                    </label>

                    <div>
                        <label for="title" class="text-muted block text-sm font-bold">{{ __('listing.title_field') }}</label>
                        <input id="title" name="title" value="{{ old('title') }}" maxlength="90" required
                            class="rounded-input border-border mt-1 w-full border px-3 py-2.5 text-sm">
                    </div>

                    <div>
                        <label for="description" class="text-muted block text-sm font-bold">{{ __('listing.description_field') }}</label>
                        <textarea id="description" name="description" rows="6" maxlength="5000" required
                            class="rounded-input border-border mt-1 w-full border px-3 py-2.5 text-sm leading-relaxed">{{ old('description') }}</textarea>
                    </div>
                </section>

                {{-- ── 4. photos and contact ───────────────────────────────── --}}
                <section x-show="step === 4" x-cloak class="mt-6 space-y-4">
                    <div>
                        <label for="photos" class="text-muted block text-sm font-bold">{{ __('listing.photos') }}</label>
                        <p class="text-dim mt-0.5 text-xs">{{ __('listing.photos_hint', ['max' => $maxImages]) }}</p>
                        <input id="photos" type="file" name="photos[]" multiple accept="image/jpeg,image/png,image/webp"
                            x-on:change="countPhotos($event)"
                            class="mt-2 w-full text-sm">
                        <p class="text-dim ltr-nums mt-1 text-xs" x-show="photoCount > 0" x-text="photoCount"></p>
                    </div>

                    <div>
                        <label for="contact_phone" class="text-muted block text-sm font-bold">{{ __('listing.contact_phone_field') }}</label>
                        <input id="contact_phone" type="tel" name="contact_phone" dir="ltr"
                            value="{{ old('contact_phone', $user->phone) }}"
                            class="rounded-input border-border ltr-nums mt-1 w-full border px-3 py-2.5 text-sm">
                    </div>

                    <label class="flex items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" name="show_phone" value="1" checked>
                        {{ __('listing.call') }}
                    </label>

                    <label class="flex items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" name="allow_whatsapp" value="1" checked>
                        {{ __('listing.whatsapp') }}
                    </label>
                </section>

                {{-- Pinned, because this is the only thing on the screen you
                     are here to press. --}}
                <div class="border-border bg-surface/95 fixed inset-x-0 bottom-0 z-40 border-t p-3 backdrop-blur-xl">
                    <div class="mx-auto flex max-w-xl gap-2 px-1">
                        <button type="button" x-show="step > 1" x-on:click="step--"
                            class="rounded-input border-border text-primary border px-5 py-3 text-sm font-bold">
                            {{ __('listing.back') }}
                        </button>

                        <button type="button" x-show="step < total" x-on:click="step++"
                            class="bg-accent rounded-input flex-1 py-3 text-sm font-bold text-white">
                            {{ __('listing.next') }}
                        </button>

                        <button type="submit" x-show="step === total" x-cloak
                            class="bg-accent rounded-input flex-1 py-3 text-sm font-bold text-white">
                            {{ __('listing.submit') }}
                        </button>
                    </div>
                </div>
            </form>
        </x-layout.container>
    </main>
</x-layout.app>
