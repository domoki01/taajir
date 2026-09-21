<?php

declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

/**
 * config/firebase.php decides whether anybody can sign in at all, and it is
 * read once at boot where nothing watches it. This pins the one case that
 * actually went wrong: the live .env was copied from .env.example, which shipped
 * all five keys with nothing after the '=', and a default that only answers to
 * an *absent* key never fired. The site returned a generic "try again" and the
 * server log stayed empty, because the browser SDK refuses an empty apiKey
 * before a request is ever made.
 *
 * The file is required directly rather than read through config(): the
 * framework's env() reads $_ENV, $_SERVER and getenv(), and a booted app has
 * already resolved and possibly cached the value.
 */
final class FirebaseConfigTest extends TestCase
{
    private const KEYS = [
        'FIREBASE_PROJECT_ID',
        'FIREBASE_API_KEY',
        'FIREBASE_AUTH_DOMAIN',
        'FIREBASE_APP_ID',
        'FIREBASE_MESSAGING_SENDER_ID',
    ];

    /** @var array<string, string|false> */
    private array $saved = [];

    protected function setUp(): void
    {
        parent::setUp();
        foreach (self::KEYS as $key) {
            $this->saved[$key] = getenv($key);
        }
    }

    protected function tearDown(): void
    {
        foreach (self::KEYS as $key) {
            $this->set($key, $this->saved[$key] === false ? null : $this->saved[$key]);
        }
        parent::tearDown();
    }

    private function set(string $key, ?string $value): void
    {
        if ($value === null) {
            putenv($key);
            unset($_ENV[$key], $_SERVER[$key]);

            return;
        }

        putenv("{$key}={$value}");
        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
    }

    /** @return array<string, string> */
    private function config(): array
    {
        return require __DIR__.'/../../config/firebase.php';
    }

    /**
     * The config as an .env that says nothing about Firebase resolves it.
     *
     * Tests compare against this rather than against the project's literal
     * values: which Firebase project the site uses is a decision that changes —
     * newmokit became taajir-a11c4 — and a test that hardcodes it fails for the
     * one reason that is not a bug, while testing nothing about the guard.
     *
     * @return array<string, string>
     */
    private function defaults(): array
    {
        $saved = [];
        foreach (self::KEYS as $key) {
            $saved[$key] = getenv($key);
            $this->set($key, null);
        }

        $config = $this->config();

        foreach (self::KEYS as $key) {
            $this->set($key, $saved[$key] === false ? null : $saved[$key]);
        }

        return $config;
    }

    public function test_an_env_that_never_mentions_firebase_still_signs_people_in(): void
    {
        foreach (self::KEYS as $key) {
            $this->set($key, null);
        }

        $config = $this->config();

        foreach ($config as $name => $value) {
            $this->assertNotSame('', $value, "{$name} has no usable default");
        }
        // Shape, not identity: a web API key is AIza plus 35 more.
        $this->assertMatchesRegularExpression('/^AIza[0-9A-Za-z_-]{35}$/', $config['api_key']);
    }

    public function test_a_key_present_but_empty_is_treated_as_unset(): void
    {
        // This is the live install: five lines copied from the template with
        // nothing typed after them. Nobody chose that, so it cannot mean
        // "refuse everything" — it means the question went unanswered.
        foreach (self::KEYS as $key) {
            $this->set($key, '');
        }

        $config = $this->config();

        foreach ($config as $name => $value) {
            $this->assertNotSame('', $value, "{$name} came out empty; the sign-in widget cannot start");
        }
        $this->assertSame($this->defaults(), $config);
    }

    public function test_a_key_copied_from_the_console_mask_is_treated_as_unset(): void
    {
        // What the live install actually had. Google Cloud Console shows the key
        // partly hidden and copying the screen gives back the mask: AIza, eight
        // real characters, thirty-one bullets. Exactly 39 characters, the right
        // prefix, and rejected by Google with API_KEY_INVALID — while the
        // browser shows a generic "try again" and the server log stays empty.
        $masked = 'AIzaSyAK'.str_repeat("\u{2022}", 31);
        $this->assertSame(39, mb_strlen($masked), 'the mask is the length of a real key, which is why it fools everything');

        $this->set('FIREBASE_API_KEY', $masked);

        $this->assertSame($this->defaults()['api_key'], $this->config()['api_key']);
    }

    public function test_a_hyphen_a_chat_client_turned_into_a_dash_is_treated_as_unset(): void
    {
        // The same failure by another route: the key travels through a message,
        // something substitutes an en-dash for the hyphen, and it is pasted in
        // looking correct. Every one of these five values is ASCII by
        // construction, so a byte above 0x7E was never typed on purpose.
        $this->set('FIREBASE_API_KEY', 'AIzaSyAgaUBu1Bl7Ss'."\u{2013}".'vSZdEey2eGzGBJRskWEE');

        $this->assertSame($this->defaults()['api_key'], $this->config()['api_key']);
    }

    public function test_a_legitimate_ascii_value_is_not_mistaken_for_damage(): void
    {
        // The guard must not swallow the case it exists to protect: a real key
        // for another project, hyphens, underscores and all.
        $this->set('FIREBASE_API_KEY', 'AIzaSyB1_cD-efGH2ijKLmn3OpQR4stUV5wXyZ6a');

        $this->assertSame('AIzaSyB1_cD-efGH2ijKLmn3OpQR4stUV5wXyZ6a', $this->config()['api_key']);
    }

    public function test_a_real_value_still_wins(): void
    {
        // The whole point of the env vars: pointing this install at another
        // project — a staging one — without touching code.
        $this->set('FIREBASE_PROJECT_ID', 'taajir-staging');

        $this->assertSame('taajir-staging', $this->config()['project_id']);
    }

    public function test_the_committed_app_id_belongs_to_the_committed_sender(): void
    {
        // An appId is 1:<messagingSenderId>:web:<hash>. They were mismatched
        // once in the Next app and Auth never noticed, because it keys off the
        // api key and the project; App Check and FCM mint per app and do.
        foreach (self::KEYS as $key) {
            $this->set($key, null);
        }

        $config = $this->config();

        $this->assertStringStartsWith("1:{$config['messaging_sender_id']}:web:", $config['app_id']);
    }
}
