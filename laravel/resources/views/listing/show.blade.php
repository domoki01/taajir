{{-- One ad.

     An immersive route: the bottom nav stands down and the phone gets a back
     bar instead, because the price and the call buttons own the bottom of the
     viewport here and two stacked bars would eat a sixth of the screen. --}}
@php
    $images = $listing->images;
    $phone = $listing->show_phone ? $listing->contact_phone : null;
@endphp

<x-layout.app
    :title="$listing->title"
    :description="\Illuminate\Support\Str::limit(strip_tags($listing->description), 160)"
>
    <main class="flex-1 pb-28 md:pb-10">
        <x-layout.container max="max-w-4xl">
            {{-- Gallery. Plain scroll-snap rather than a carousel library: it
                 is a row of photos, and the native behaviour is better than
                 anything worth shipping JavaScript for. --}}
            <div class="rounded-card bg-surface-soft mt-4 overflow-hidden">
                @if (count($images) > 0)
                    <div class="flex snap-x snap-mandatory overflow-x-auto">
                        @foreach ($images as $image)
                            <img
                                src="{{ $image->url }}"
                                alt="{{ $listing->title }}"
                                class="aspect-[4/3] w-full shrink-0 snap-center object-cover"
                                @if (! $loop->first) loading="lazy" @endif
                            >
                        @endforeach
                    </div>
                @else
                    <div class="text-dim grid aspect-[4/3] place-items-center">
                        <x-icon.building-2 class="size-12" stroke-width="1.2" />
                    </div>
                @endif
            </div>

            <div class="mt-5">
                <p class="text-primary ltr-nums text-2xl font-black">{{ $listing->formattedPrice() }}</p>
                @if ($listing->is_negotiable)
                    <p class="text-dim mt-0.5 text-xs font-semibold">{{ __('listing.negotiable') }}</p>
                @endif

                <h1 class="mt-2 text-xl font-black md:text-2xl">{{ $listing->title }}</h1>

                <p class="text-muted mt-2 flex items-center gap-1.5 text-sm font-semibold">
                    <x-icon.map-pin class="size-4 shrink-0" />
                    {{ $listing->placeLabel() }}@if ($listing->quartier), {{ $listing->quartier }}@endif
                </p>
            </div>

            {{-- The facts, as a definition list. An Algerian buyer reads the
                 paperwork row before anything else on this page. --}}
            <section class="rounded-card border-border bg-surface mt-6 border p-4">
                <h2 class="text-base font-extrabold">{{ __('listing.details') }}</h2>
                <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-3">
                    @foreach ([
                        'listing.rooms' => $listing->rooms_code,
                        'listing.area_built' => $listing->area_built ? $listing->area_built.' m²' : null,
                        'listing.area_land' => $listing->area_land ? $listing->area_land.' m²' : null,
                        'listing.bathrooms' => $listing->bathrooms,
                        'listing.floor' => $listing->floor,
                        'listing.condition' => $listing->condition_code ? \App\Enums\Condition::tryFrom($listing->condition_code)?->label() : null,
                        'listing.paperwork_label' => $listing->paperwork ? \App\Enums\Paperwork::tryFrom($listing->paperwork)?->label() : null,
                        'listing.housing_program' => $listing->housing_program ? \App\Enums\HousingProgram::tryFrom($listing->housing_program)?->label() : null,
                        'listing.sale_form' => $listing->sale_form ? \App\Enums\SaleForm::tryFrom($listing->sale_form)?->label() : null,
                    ] as $key => $value)
                        @if ($value !== null && $value !== '')
                            <div>
                                <dt class="text-dim text-xs font-semibold">{{ __($key) }}</dt>
                                <dd class="ltr-nums mt-0.5 font-bold">{{ $value }}</dd>
                            </div>
                        @endif
                    @endforeach
                </dl>
            </section>

            @if (count($listing->amenities) > 0)
                <section class="mt-5">
                    <h2 class="text-base font-extrabold">{{ __('listing.amenities_label') }}</h2>
                    <ul class="mt-3 flex flex-wrap gap-2">
                        @foreach ($listing->amenities as $row)
                            <li class="rounded-input border-border text-muted border px-3 py-1.5 text-xs font-semibold">
                                {{ \App\Enums\Amenity::tryFrom($row->amenity)?->label() ?? $row->amenity }}
                            </li>
                        @endforeach
                    </ul>
                </section>
            @endif

            <section class="mt-5">
                <h2 class="text-base font-extrabold">{{ __('listing.description') }}</h2>
                <p class="text-muted mt-2 leading-loose whitespace-pre-line">{{ $listing->description }}</p>
            </section>

            {{-- Who posted it.

                 The page carried a phone number and no name at all, which is
                 the wrong way round: a buyer decides whether to call partly on
                 who is asking, and "كل إعلانات هذا الناشر" is how they find out
                 whether this is one flat or forty. --}}
            <a href="{{ \App\Support\Nav::href($listing->owner?->profileUrl() ?? '/') }}"
               @class(['rounded-card border-border bg-surface mt-6 flex items-center gap-3 border p-4', 'pointer-events-none' => ! $listing->owner])>
                @if ($listing->owner?->photo_url)
                    <img src="{{ $listing->owner->photo_url }}" alt="" width="40" height="40"
                         class="h-10 w-10 rounded-full object-cover" loading="lazy">
                @else
                    <span class="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full text-sm font-black">
                        {{ mb_substr($listing->owner_name, 0, 1) }}
                    </span>
                @endif

                <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-bold">{{ $listing->owner_name }}</span>
                    @if ($listing->owner)
                        <span class="text-dim mt-0.5 block text-xs">{{ __('follow.see_all') }}</span>
                    @endif
                </span>
            </a>

            <p class="rounded-card bg-warning/10 text-warning mt-6 px-4 py-3 text-sm leading-relaxed font-semibold">
                {{ __('listing.safety_note') }}
            </p>

            <p class="text-dim ltr-nums mt-4 text-xs">
                {{ __('listing.published_on', ['date' => optional($listing->published_at)->isoFormat('LL')]) }}
                ·
                {{ __('listing.views', ['count' => $listing->view_count]) }}
            </p>

            <x-listing.comments :listing="$listing" />

            @if (count($similar) > 0)
                <section class="mt-12">
                    <h2 class="text-base font-extrabold">{{ __('listing.latest') }}</h2>
                    <div class="mt-3">
                        <x-listing.grid :listings="$similar" />
                    </div>
                </section>
            @endif
        </x-layout.container>
    </main>

    {{-- The contact bar. Pinned to the thumb on a phone, inline on a desktop.
         Emerald for the call, WhatsApp's own green for WhatsApp — beside each
         other, anything else would be unrecognisable. --}}
    <div class="border-border bg-surface/95 fixed inset-x-0 bottom-0 z-40 border-t p-3 backdrop-blur-xl md:static md:mt-6 md:border-0 md:bg-transparent md:p-0">
        <x-layout.container max="max-w-4xl">
            @if ($phone)
                <div class="mx-auto flex max-w-md gap-2 md:max-w-none">
                    <a
                        href="tel:{{ $phone }}"
                        class="bg-accent rounded-input flex flex-1 items-center justify-center py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
                    >{{ __('listing.call') }}</a>

                    @if ($listing->allow_whatsapp)
                        <a
                            href="https://wa.me/{{ preg_replace('/\D/', '', $phone) }}"
                            rel="noopener"
                            class="bg-whatsapp rounded-input flex flex-1 items-center justify-center py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
                        >{{ __('listing.whatsapp') }}</a>
                    @endif
                </div>
            @else
                <p class="text-dim text-center text-sm font-semibold">{{ __('listing.phone_hidden') }}</p>
            @endif
        </x-layout.container>
    </div>

    {{-- Structured data, so a result in Google carries the price and the
         place rather than just a title. --}}
    @push('scripts')
        <script type="application/ld+json">{!! $listing->jsonLd() !!}</script>
    @endpush
</x-layout.app>
