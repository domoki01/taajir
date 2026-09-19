@props(['listings'])

@if (count($listings) === 0)
    <div class="rounded-card border-border bg-surface border border-dashed px-6 py-12 text-center">
        <p class="font-bold">{{ __('listing.none') }}</p>
        <p class="text-dim mt-1 text-sm">{{ __('listing.none_hint') }}</p>
    </div>
@else
    <div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        @foreach ($listings as $listing)
            <x-listing.card :listing="$listing" />
        @endforeach
    </div>
@endif
