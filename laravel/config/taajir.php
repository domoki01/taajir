<?php

// ── APP CONSTANTS ────────────────────────────────────────────────────────────
// Ported from the Next app's src/lib/constants.ts. Values that are part of the
// product definition rather than configuration; anything that differs per
// environment reads from .env below rather than being edited here.

return [

    'site_name' => 'تأجير',
    'site_tagline' => 'عقارات الجزائر',

    /*
     * Absolute origin, needed by canonical URLs, the sitemap and OG tags.
     * Laravel's own APP_URL is the same value, kept separate so a future
     * split (app on a subdomain, canonical on the apex) stays expressible.
     */
    'site_url' => env('TAAJIR_SITE_URL', env('APP_URL', 'http://localhost:8000')),

    /*
     * Whether a *new* account may be opened with a phone number.
     *
     * Firebase's SMS backend started refusing this project's verification codes —
     * a valid reCAPTCHA token passes the captcha check and the send then answers
     * HTTP 503 `backendError`, which the SDK surfaces as an unmapped number. It is
     * outside this codebase, so the only thing to decide here is what somebody
     * standing in front of the form should be offered meanwhile.
     *
     * Signing *in* by phone is never hidden by this. Thirty-five accounts have no
     * email and no password; hiding their only door would strand them, and it costs
     * nothing to leave a door that works again the moment Google's does.
     *
     * An environment variable rather than an admin setting on purpose: the day this
     * is switched back is the day somebody watches it work, not a day it should
     * flip on its own.
     */
    'phone_signup_enabled' => env('TAAJIR_PHONE_SIGNUP', 'off') !== 'off',

    /*
     * The picture a shared link shows when the thing being shared has none.
     *
     * Demands never have a photo and plenty of ads are posted without one. A link
     * preview with no image is a grey rectangle in a WhatsApp group, next to
     * everybody else's pictures — this is the difference between a link that gets
     * tapped and one that gets scrolled past.
     */
    'default_share_image' => '/og-default.png',

    /** Photos per listing. Real-estate ads live on their gallery. */
    'max_images' => 20,

    /** Free listings an individual may keep active (pending + published). */
    'free_listing_quota' => 3,

    /** Days a listing stays published before it needs renewing. */
    'listing_lifetime_days' => 60,

    /*
     * Saved searches one account may keep. Generous for a person, and low enough
     * that approving an ad fans out to a bounded number of pushes.
     */
    'max_saved_searches' => 10,

    /*
     * Open property requests one account may have on the feed.
     *
     * Nothing moderates the demand feed before it appears, so the cap is what stops
     * one person from owning the first screen. Five is more demands than anyone
     * genuinely has at once.
     */
    'max_open_requests' => 5,

    /*
     * Algerians quote property prices in "ملايين" — millions of centimes.
     * 1 مليون = 100 * 10_000 centimes = 10_000 DZD. A flat advertised at
     * "800 مليون" costs 8_000_000 DZD. Prices are ALWAYS stored as whole dinars;
     * mixing the two units up is a 10_000x error, so the conversion lives in
     * exactly one place (App\Support\Price) and nowhere else.
     */
    'dinars_per_million' => 10_000,

    /*
     * Search Console's ownership token, emitted as a `<meta>` tag.
     *
     * Google will not show a single impression, query or indexing error for a site
     * whose ownership is unproven, so this is the gate in front of every SEO number
     * the site will ever have. Empty is a valid state — the tag is simply not
     * emitted, which is better than emitting an empty `content`.
     *
     * Search Console shows the DNS value as the whole record — the name and the
     * token joined by "=" — and that is what gets copied. The meta tag wants the
     * token alone; the prefix is stripped so pasting the record verbatim still
     * produces a tag that verifies.
     */
    'google_site_verification' => preg_replace(
        '/^google-site-verification\s*=\s*/i',
        '',
        trim((string) env('TAAJIR_GOOGLE_SITE_VERIFICATION', '')),
    ),

];
