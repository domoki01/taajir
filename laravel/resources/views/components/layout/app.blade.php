{{-- ── THE SHELL ────────────────────────────────────────────────────────────
     Every page renders inside this. The two bars are mounted here rather than
     per page: they are the site's navigation on a phone, so they have to cover
     the dashboard and the admin section too. The back bar comes first because it
     is `sticky top-0` and has to sit ahead of the content it sticks above. --}}
@props([
    'title' => null,
    'description' => null,
])

@php
    $locale = \App\Enums\Locale::current();
    $siteName = __('brand.name');
    $tagline = __('brand.tagline');
    $description ??= __('brand.description');

    // A page's own title is suffixed with the site name, and the home page
    // carries the tagline instead. Matches the Next app's metadata template.
    $documentTitle = $title ? $title.' | '.$siteName : $siteName.' — '.$tagline;

    // The same page, unprefixed, so every locale's URL for it can be built.
    $path = \App\Support\Nav::currentPath();
@endphp

<!DOCTYPE html>
<html lang="{{ $locale->htmlLang() }}" dir="{{ $locale->direction() }}" class="h-full antialiased">
<head>
    <meta charset="utf-8">
    {{-- viewport-fit=cover is required by the bottom nav: without it
         `env(safe-area-inset-bottom)` is always 0 and the bar sits underneath the
         iPhone home indicator.

         Deliberately NOT maximum-scale=1 / user-scalable=no. The sibling app
         disabled pinch zoom, which fails WCAG 1.4.4 and hurts users reading
         property details on small screens. --}}
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#0f172a">

    <title>{{ $documentTitle }}</title>
    <meta name="description" content="{{ $description }}">
    <meta name="application-name" content="{{ $siteName }}">

    {{-- Three URLs serve the same page, so each has to say so or Google picks
         one and drops the other two as duplicates. x-default points at Arabic:
         it is the site's own language and the version every existing inbound
         link already resolves to. --}}
    <link rel="canonical" href="{{ url($locale->path($path)) }}">
    @foreach (\App\Enums\Locale::cases() as $alternate)
        <link rel="alternate" hreflang="{{ $alternate->htmlLang() }}" href="{{ url($alternate->path($path)) }}">
    @endforeach
    <link rel="alternate" hreflang="x-default" href="{{ url(\App\Enums\Locale::default()->path($path)) }}">

    <meta property="og:type" content="website">
    <meta property="og:locale" content="{{ $locale->openGraphLocale() }}">
    @foreach (\App\Enums\Locale::cases() as $alternate)
        @if ($alternate !== $locale)
            <meta property="og:locale:alternate" content="{{ $alternate->openGraphLocale() }}">
        @endif
    @endforeach
    <meta property="og:site_name" content="{{ $siteName }}">
    <meta property="og:title" content="{{ $documentTitle }}">
    <meta property="og:description" content="{{ $description }}">
    <meta property="og:url" content="{{ url($locale->path($path)) }}">

    {{-- Emitted only when a token is configured: an empty `content` reads to a
         crawler as a failed claim of ownership, which is worse than no tag. --}}
    @if (config('taajir.google_site_verification'))
        <meta name="google-site-verification" content="{{ config('taajir.google_site_verification') }}">
    @endif

    {{-- Cairo, self-hosted: @fonts emits the @font-face block and preloads the
         weights the build downloaded, so nothing is fetched from a font CDN at
         runtime. It carries Latin as well as Arabic, so French and English cost
         no extra request. --}}
    @fonts
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="flex min-h-full flex-col">
    <x-layout.mobile-top-bar />

    {{ $slot }}

    <x-layout.bottom-nav />

    {{-- Rendered once, opened by the header's trigger and the phone bar's. Its
         browse links come from the *live* taxonomy rather than a constant: a
         hard-coded list would offer a category an admin had hidden, which is a
         link to a page they deliberately took down. --}}
    <x-layout.side-menu :deals="\App\Services\Taxonomy::current()->visibleOptions()['transactionTypes']" />
</body>
</html>
