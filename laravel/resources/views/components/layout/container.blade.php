{{-- The width the site's content lives in.

     `max` is a prop rather than something a caller passes through `class`,
     because $attributes->merge() concatenates classes instead of replacing them:
     a `class="max-w-3xl"` would ship next to the default `max-w-6xl` and leave
     stylesheet order to decide which one wins. --}}
@props(['max' => 'max-w-6xl'])

<div {{ $attributes->class(['mx-auto w-full px-4', $max]) }}>
    {{ $slot }}
</div>
