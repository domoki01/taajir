{{-- ── THE SHELL ────────────────────────────────────────────────────────────
     Every page renders inside this. The two bars are mounted here rather than
     per page: they are the site's navigation on a phone, so they have to cover
     the dashboard and the admin section too. The back bar comes first because it
     is `sticky top-0` and has to sit ahead of the content it sticks above. --}}
@props([
    'title' => null,
    'description' => null,
    // A page that is the whole site for as long as it is showing. The closed
    // door is the only one: every destination the bars offer is behind the
    // hold, so drawing them would be four links that bounce the visitor
    // straight back here, plus a menu of the same.
    'bare' => false,
])

@php
    $locale = \App\Enums\Locale::current();

    // The name and the tagline come from the branding screen when an admin has
    // saved it, and from the lang files otherwise — a failed or empty read
    // leaves the site named rather than blank.
    $branding = \App\Services\Branding::current();
    $siteName = $branding->siteName;
    $tagline = $branding->tagline;
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
    <meta name="csrf-token" content="{{ csrf_token() }}">
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
    {{-- Per-page <head> additions, e.g. the noindex on /recherche. --}}
    @stack('head')

    @fonts
    @vite(['resources/css/app.css', 'resources/js/app.js'])

    {{-- The admin's palette, layered over the build's rather than replacing it:
         only the tokens they actually changed are emitted, and nothing at all
         when they changed none, so the common case costs no bytes.

         Safe to print unescaped — every value has been matched against
         `#rrggbb` both on the way in and on the way out, so no quote, brace or
         angle bracket can reach the document. After @vite, or the stylesheet
         would redefine the tokens this overrides. --}}
    @if ($style = $branding->style())
        <style>{!! $style !!}</style>
    @endif
</head>
<body class="flex min-h-full flex-col">
    @unless ($bare)
        <x-layout.mobile-top-bar />
    @endunless

    {{ $slot }}

    @unless ($bare)
        <x-layout.bottom-nav />
    @endunless

    {{-- Rendered once, opened by the header's trigger and the phone bar's. Its
         browse links come from the *live* taxonomy rather than a constant: a
         hard-coded list would offer a category an admin had hidden, which is a
         link to a page they deliberately took down. --}}
    @unless ($bare)
        <x-layout.side-menu :deals="\App\Services\Taxonomy::current()->visibleOptions()['transactionTypes']" />
    @endunless

    {{-- Page-specific scripts, after Alpine has been started by app.js. The
         sign-in page is the only user of this so far, and it needs the Firebase
         SDK, which no other page should pay for. --}}
    {{-- The handful of strings the scripts need. Emitted rather than fetched:
         they are three lines, and a sign-in page that has to wait on a request
         before it can tell you what went wrong is worse than one that cannot. --}}
    @php
        // Built here rather than inline: Blade's directive parser reads a
        // directive's argument up to the first unbalanced bracket on the line,
        // so a multi-line array inside @json is a parse error.
        $scriptMessages = [
            'failed' => __('auth.failed'),
            'passwordDisabled' => __('auth.password_disabled'),
            'phoneDisabled' => __('auth.phone_disabled'),
            'banned' => __('auth.banned'),
            'tooMany' => __('auth.too_many'),
        ];
    @endphp
    <script>
        window.taajirMessages = {!! json_encode($scriptMessages, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) !!};
    </script>

    @stack('scripts')
</body>
</html>
