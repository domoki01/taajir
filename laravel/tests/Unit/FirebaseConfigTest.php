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

    public function test_an_env_that_never_mentions_firebase_still_signs_people_in(): void
    {
        foreach (self::KEYS as $key) {
            $this->set($key, null);
        }

        $config = $this->config();

        $this->assertSame('newmokit', $config['project_id']);
        $this->assertNotSame('', $config['api_key']);
        $this->assertNotSame('', $config['app_id']);
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
        $this->assertSame('newmokit', $config['project_id']);
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
