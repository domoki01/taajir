{{-- Lucide "bell". Static SVG rather than a package: an inline <svg> inherits
     currentColor and the size utility the same way the React component did.

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
    <path d="M10.268 21a2 2 0 0 0 3.464 0" />
    <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
</svg>
