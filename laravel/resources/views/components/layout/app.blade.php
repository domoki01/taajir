{{-- ── THE SHELL ────────────────────────────────────────────────────────────
     Every page renders inside this. The two bars are mounted here rather than
     per page: they are the site's navigation on a phone, so they have to cover
     the dashboard and the admin section too. The back bar comes first because it
     is `sticky top-0` and has to sit ahead of the content it sticks above. --}}
@props([
    'title' => null,
    'description' => 'منصة جزائرية لكراء وبيع العقارات: شقق، فيلات، أراضي ومحلات تجارية في كل ولايات الوطن. ابحث حسب الولاية والبلدية والسعر، وانشر إعلانك مجاناً.',
])

@php
    $siteName = config('taajir.site_name');
    $tagline = config('taajir.site_tagline');

    // Matches the Next app's metadata template exactly: a page's own title is
    // suffixed with the site name, and the home page carries the tagline.
    $documentTitle = $title ? $title.' | '.$siteName : $siteName.' — '.$tagline;
@endphp

<!DOCTYPE html>
<html lang="ar" dir="rtl" class="h-full antialiased">
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

    <meta property="og:type" content="website">
    <meta property="og:locale" content="ar_DZ">
    <meta property="og:site_name" content="{{ $siteName }}">
    <meta property="og:title" content="{{ $documentTitle }}">
    <meta property="og:description" content="{{ $description }}">

    {{-- Emitted only when a token is configured: an empty `content` reads to a
         crawler as a failed claim of ownership, which is worse than no tag. --}}
    @if (config('taajir.google_site_verification'))
        <meta name="google-site-verification" content="{{ config('taajir.google_site_verification') }}">
    @endif

    {{-- Cairo, self-hosted: @fonts emits the @font-face block and preloads the
         weights the build downloaded, so nothing is fetched from a font CDN at
         runtime. --}}
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
