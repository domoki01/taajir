<?php

declare(strict_types=1);

namespace Tests\Feature;

use Tests\TestCase;

final class StaticPagesTest extends TestCase
{
    /**
     * The URL scheme is the contract with Google and with every WhatsApp message
     * ever sent. These five paths are what the Next app serves today.
     */
    public function test_every_content_page_answers_at_its_own_path(): void
    {
        foreach (['/a-propos', '/aide', '/cgu', '/confidentialite', '/securite'] as $path) {
            $this->get($path)->assertOk();
        }
    }

    public function test_the_document_is_arabic_and_right_to_left(): void
    {
        $this->get('/cgu')
            ->assertOk()
            ->assertSee('<html lang="ar" dir="rtl"', false);
    }

    public function test_a_page_title_carries_the_site_name(): void
    {
        $this->get('/cgu')->assertSee('<title>شروط الاستعمال | تأجير</title>', false);
    }

    public function test_the_home_page_title_carries_the_tagline(): void
    {
        $this->get('/')->assertSee('<title>تأجير — عقارات الجزائر</title>', false);
    }

    public function test_the_verification_tag_is_emitted_only_when_configured(): void
    {
        // An empty `content` reads to a crawler as a failed claim of ownership,
        // which is worse than no tag at all.
        config(['taajir.google_site_verification' => '']);
        $this->get('/cgu')->assertDontSee('google-site-verification', false);

        config(['taajir.google_site_verification' => 'abc123']);
        $this->get('/cgu')
            ->assertSee('<meta name="google-site-verification" content="abc123">', false);
    }

    public function test_the_content_pages_are_reachable_from_the_side_menu(): void
    {
        // Removing the footer took the last link to the legal pages with it; the
        // panel is what replaced it, and it is on every screen.
        $response = $this->get('/');

        foreach (['/a-propos', '/aide', '/securite', '/cgu', '/confidentialite'] as $path) {
            $response->assertSee('href="'.$path.'"', false);
        }
    }

    public function test_an_unknown_path_is_a_404(): void
    {
        $this->get('/pas-une-page')->assertNotFound();
    }
}
