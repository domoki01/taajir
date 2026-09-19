<?php

// ── FIREBASE ─────────────────────────────────────────────────────────────────
// The only thing this application still asks of Firebase is proving who someone
// is. There is no service-account key here and no Admin SDK: §5 of the roadmap
// takes the lean path, because verifying a login needs nothing but Google's
// public certificates, and the service-account JSON is the credential you least
// want on a shared host.
//
// These values are not secrets. The web API key and the project id are shipped
// to every browser by design — they identify the project, they do not authorise
// anything. The security boundary is the token verification in
// App\Services\Auth\FirebaseTokenVerifier and the policies behind it.

return [

    /*
     * The audience every ID token must carry. An empty value makes the verifier
     * refuse outright rather than skip the check — "any Firebase token from
     * anywhere" is not a degraded mode worth having.
     */
    'project_id' => env('FIREBASE_PROJECT_ID', ''),

    // What the browser SDK needs to run the sign-in widget.
    'api_key' => env('FIREBASE_API_KEY', ''),
    'auth_domain' => env('FIREBASE_AUTH_DOMAIN', ''),
    'app_id' => env('FIREBASE_APP_ID', ''),
    'messaging_sender_id' => env('FIREBASE_MESSAGING_SENDER_ID', ''),

];
