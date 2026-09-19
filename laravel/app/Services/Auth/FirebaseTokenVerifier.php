<?php

declare(strict_types=1);

namespace App\Services\Auth;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Verify a Firebase ID token, server-side, without the Admin SDK.
 *
 * This is the one thing the application still asks of Firebase, and §5 of the
 * roadmap picks the lean option deliberately: the service-account JSON is the
 * credential you least want sitting on a shared host, and verifying a login is
 * all we need. Google publishes the public half of its signing keys; that is
 * enough to check a signature.
 *
 * Everything here is a gate. The token arrives from the browser, so every field
 * in it is attacker-controlled until the signature is checked, and the checks
 * after the signature are what stop a validly-signed token from *another*
 * Firebase project being accepted as one of ours.
 */
final class FirebaseTokenVerifier implements VerifiesIdTokens
{
    /**
     * Google's public certificates for the Secure Token service.
     *
     * A fixed URL rather than discovery: it is documented, it is stable, and an
     * attacker who could change where we fetch keys from could mint tokens.
     */
    private const CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

    private const ISSUER_PREFIX = 'https://securetoken.google.com/';

    public function __construct(private readonly string $projectId) {}

    /**
     * @return array<string, mixed> the verified claims
     *
     * @throws InvalidIdToken
     */
    public function verify(string $idToken): array
    {
        if ($this->projectId === '') {
            // Refuse rather than skip the audience check. A missing project id
            // would otherwise turn this into "any Firebase token from anywhere".
            throw new InvalidIdToken('no Firebase project configured');
        }

        // Signature, `exp`, `iat` and `nbf` are checked here. RS256 is pinned:
        // passing the algorithm from the token's own header is how a verifier
        // gets talked into `none`, or into treating a public key as an HMAC
        // secret.
        try {
            $claims = (array) JWT::decode($idToken, $this->keys());
        } catch (\Throwable $e) {
            throw new InvalidIdToken('signature or lifetime rejected: '.$e->getMessage(), previous: $e);
        }

        // ── The claims the signature alone does not settle ────────────────────
        // Google signs every project's tokens with the same keys, so a token
        // from someone else's Firebase project carries a valid signature. `aud`
        // and `iss` are what make it ours.
        if (($claims['aud'] ?? null) !== $this->projectId) {
            throw new InvalidIdToken('audience is not this project');
        }

        if (($claims['iss'] ?? null) !== self::ISSUER_PREFIX.$this->projectId) {
            throw new InvalidIdToken('issuer is not this project');
        }

        $uid = $claims['sub'] ?? null;
        if (! is_string($uid) || $uid === '' || mb_strlen($uid) > 28) {
            throw new InvalidIdToken('no usable subject');
        }

        // Present on every Firebase ID token and in the past on a real one.
        // Its absence means this is some other kind of Google token.
        $authTime = $claims['auth_time'] ?? null;
        if (! is_numeric($authTime) || $authTime > time() + 60) {
            throw new InvalidIdToken('auth_time missing or in the future');
        }

        return $claims;
    }

    /**
     * Google's current signing certificates, cached for exactly as long as
     * Google says they are good for.
     *
     * Caching matters twice: a sign-in should not wait on a round trip to
     * Google, and Google rate-limits this endpoint. Honouring `Cache-Control`
     * rather than picking our own window is what makes key rotation work — the
     * keys change every few days, and a stale cache rejects every login until
     * it expires.
     *
     * @return array<string, Key>
     */
    private function keys(): array
    {
        [$certs, $ttl] = Cache::remember(
            'firebase.securetoken.certs',
            // The outer entry never outlives the inner TTL; see below.
            now()->addHour(),
            function (): array {
                $response = Http::timeout(10)->get(self::CERT_URL);

                if (! $response->successful()) {
                    throw new InvalidIdToken('could not fetch Google signing keys');
                }

                return [$response->json(), $this->maxAge($response->header('Cache-Control'))];
            }
        );

        // Re-store with the TTL Google asked for. Cache::remember cannot know it
        // before the call, and a fixed window either re-fetches far too often or
        // holds keys past their rotation.
        Cache::put('firebase.securetoken.certs', [$certs, $ttl], $ttl);

        $keys = [];
        foreach ($certs as $kid => $certificate) {
            $public = openssl_pkey_get_public($certificate);
            if ($public !== false) {
                $keys[$kid] = new Key($public, 'RS256');
            }
        }

        if ($keys === []) {
            throw new InvalidIdToken('Google returned no usable signing keys');
        }

        return $keys;
    }

    /** Seconds, from a `Cache-Control: public, max-age=19216, must-revalidate` header. */
    private function maxAge(?string $cacheControl): int
    {
        if ($cacheControl !== null && preg_match('/max-age=(\d+)/', $cacheControl, $m) === 1) {
            // Floored at a minute so a hostile or broken header cannot make
            // every request re-fetch, and capped at a day so rotation is never
            // missed by more than that.
            return max(60, min((int) $m[1], 86400));
        }

        return 3600;
    }
}
