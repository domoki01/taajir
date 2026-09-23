<?php

// ── FIREBASE ─────────────────────────────────────────────────────────────────
// The project is taajir-a11c4, which replaced newmokit — a project this site
// shared with an unrelated one, carrying its Hosting, its Analytics and its
// accounts. Sign-in is all that was kept.
//
// Accounts do not cross between Firebase projects. A uid is minted per project,
// so everyone who signed in under newmokit gets a new one here, and the users
// row keyed by the old uid is not theirs any more — it is unreachable. That is
// a migration, not a config change; see docs/laravel-port.md §9.
//
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
 *
 * So does a redacted paste. Google Cloud Console shows an API key partly
 * hidden, and copying what is on screen gives back the mask rather than the
 * key: AIza, eight real characters, then thirty-one U+2022 bullets. That is not
 * blank, so it reads as a deliberate value, and it fails a long way from here —
 * Google answers API_KEY_INVALID, the browser SDK reports a generic failure,
 * and the server log stays empty because no request ever reached it. This
 * install lost an evening to exactly that.
 *
 * All five of these values are ASCII by construction: ids, a domain, a sender
 * number, and a key Google documents as [A-Za-z0-9_-]. A byte above 0x7E is
 * therefore never something a person meant to type — it is a mask, a smart
 * quote, or an en-dash a chat client substituted for the hyphen. Treating it as
 * unset puts the working default back rather than passing the damage on.
 */
$or = function (string $key, string $default): string {
    $value = env($key);

    if (! is_string($value) || $value === '' || preg_match('/[^\x20-\x7E]/', $value) === 1) {
        return $default;
    }

    return $value;
};

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
    'project_id' => $or('FIREBASE_PROJECT_ID', 'taajir-a11c4'),

    // What the browser SDK needs to run the sign-in widget.
    'api_key' => $or('FIREBASE_API_KEY', 'AIzaSyAgaUBu1Bl7Ss-vSZdEey2eGzGBJRskWEE'),
    'auth_domain' => $or('FIREBASE_AUTH_DOMAIN', 'taajir-a11c4.firebaseapp.com'),
    // Must match a web app that actually exists in the project. Auth keys off
    // apiKey and projectId and would not notice a wrong id; App Check and FCM
    // mint per app and do.
    'app_id' => $or('FIREBASE_APP_ID', '1:366248199365:web:87e33d265dfed019145cac'),
    'messaging_sender_id' => $or('FIREBASE_MESSAGING_SENDER_ID', '366248199365'),

];
