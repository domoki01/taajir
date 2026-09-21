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

/*
 * Blank counts as unset.
 *
 * env() tells an absent key from a present-but-empty one, and it is tempting to
 * make the empty case mean "deliberately refuse everything" — a project id of ''
 * matches no token, which is the right way to fail. It was written that way
 * first. The trouble is that nobody chose it: .env.example shipped these five
 * keys with nothing after the '=', so every .env copied from the template
 * carried five empty strings, and the live install did. Defaults that only
 * apply to a key nobody wrote are defaults that never apply.
 *
 * A blank is the absence of an answer, not an answer. Pointing this install at
 * another project is a value; so is fail-closed, if a made-up id is ever wanted.
 */
$or = fn (string $key, string $default): string => env($key) ?: $default;

return [

    /*
     * The defaults are the live project's, committed here exactly as
     * src/lib/firebase/config.ts commits them for the Next app — and for the
     * same reason: a deployment that forgets these does not degrade, it stops
     * signing anybody in, and the failure gives the visitor a generic "try
     * again" while the server log stays empty, because the browser SDK falls
     * over before it ever reaches us. That is a bad hour to spend, and it is
     * spent for a value Firebase ships inside every client bundle anyway.
     */
    'project_id' => $or('FIREBASE_PROJECT_ID', 'newmokit'),

    // What the browser SDK needs to run the sign-in widget.
    'api_key' => $or('FIREBASE_API_KEY', 'AIzaSyAKonS-qRWyhWOi_sK7chdOf14SiQklTz4'),
    'auth_domain' => $or('FIREBASE_AUTH_DOMAIN', 'newmokit.firebaseapp.com'),
    // Must match a web app that actually exists in the project — the "Taajir"
    // one. Auth keys off apiKey and projectId and would not notice a wrong id;
    // App Check and FCM mint per app and do.
    'app_id' => $or('FIREBASE_APP_ID', '1:224868230062:web:8f2342346aa6ca0bd9de3f'),
    'messaging_sender_id' => $or('FIREBASE_MESSAGING_SENDER_ID', '224868230062'),

];
