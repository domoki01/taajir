{{-- Lucide "chevron-right". Static SVG rather than a package: nine icons do not need a
     dependency, and an inline <svg> inherits currentColor and the size utility
     the same way the React component did.

     No default size class: $attributes->merge() concatenates classes instead of
     replacing them, so a default would ship next to the caller's own size-* and
     leave stylesheet order to decide which one applies. Every call site names
     its size. --}}
<svg
    {{ $attributes->merge(['stroke-width' => '2']) }}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
>
    <path d="m9 18 6-6-6-6" />
</svg>
