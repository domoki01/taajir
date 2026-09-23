<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Article;
use App\Services\CoverImage;
use App\Support\ArticleBody;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * The guides section: the writing and the covers that go with it.
 */
final class ArticleSeedTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        Storage::fake('public');
    }

    /** @return list<array<string, mixed>> */
    private function rows(): array
    {
        return require database_path('demo/articles.php');
    }

    public function test_it_writes_every_article_with_a_cover(): void
    {
        $this->artisan('taajir:articles')->assertSuccessful();

        $this->assertSame(count($this->rows()), Article::count());

        foreach (Article::all() as $article) {
            $this->assertNotNull($article->cover_url, "{$article->slug} has no cover");
            Storage::disk('public')->assertExists("articles/{$article->slug}.webp");
        }
    }

    public function test_the_covers_are_real_webp_at_the_right_shape(): void
    {
        // A cover that is not an image, or is portrait, is only visible once it
        // is on the page — and by then it is on every card in the section.
        $bytes = CoverImage::render(208, 'louer-sans-agence');
        $image = imagecreatefromstring($bytes);

        $this->assertNotFalse($image, 'the cover is not a decodable image');
        $this->assertSame(1600, imagesx($image));
        $this->assertSame(900, imagesy($image));
        $this->assertStringContainsString('WEBP', substr($bytes, 0, 16));
    }

    public function test_the_same_slug_always_draws_the_same_cover(): void
    {
        // Re-running the seeder must not reshuffle the section: a reader coming
        // back to an article should find the picture they remember.
        $this->assertSame(
            CoverImage::render(208, 'louer-sans-agence'),
            CoverImage::render(208, 'louer-sans-agence'),
        );

        $this->assertNotSame(
            CoverImage::render(208, 'louer-sans-agence'),
            CoverImage::render(208, 'papiers-achat-immobilier'),
        );
    }

    public function test_running_it_twice_does_not_duplicate_anything(): void
    {
        $this->artisan('taajir:articles')->assertSuccessful();
        $this->artisan('taajir:articles')->assertSuccessful();

        $this->assertSame(count($this->rows()), Article::count());
    }

    public function test_the_urls_are_latin_and_the_writing_is_arabic(): void
    {
        /*
         * URL segments are Latin and French-derived by decision: Arabic in a
         * URL percent-encodes into unreadable bytes and breaks the WhatsApp
         * preview, which is the main way anything is shared here. The prose is
         * the other way round.
         */
        foreach ($this->rows() as $row) {
            $this->assertMatchesRegularExpression('/^[a-z0-9-]+$/', $row['slug'], "{$row['slug']} is not a Latin slug");
            $this->assertMatchesRegularExpression('/\p{Arabic}/u', $row['title'], "{$row['slug']} has no Arabic title");
            $this->assertMatchesRegularExpression('/\p{Arabic}/u', $row['excerpt']);
        }
    }

    public function test_every_block_is_a_type_the_page_can_render(): void
    {
        // The renderer falls back to a paragraph for anything it does not know,
        // so a typo in a type is silent: a heading that quietly stops being a
        // heading.
        foreach ($this->rows() as $row) {
            foreach ($row['body'] as $block) {
                $this->assertContains(
                    $block['type'],
                    ['p', 'h2', 'li', 'quote'],
                    "{$row['slug']} uses an unknown block type [{$block['type']}]",
                );
                $this->assertNotSame('', trim($block['text']));
            }
        }
    }

    public function test_no_article_has_half_a_bold_marker(): void
    {
        // An odd number of ** is rendered as literal text, so the asterisks
        // appear on the page — the kind of thing nobody notices in review.
        foreach ($this->rows() as $row) {
            foreach ($row['body'] as $block) {
                $this->assertSame(
                    0,
                    substr_count($block['text'], '**') % 2,
                    "{$row['slug']} has an unclosed ** in: ".mb_substr($block['text'], 0, 40),
                );
            }
        }
    }

    public function test_bold_runs_survive_the_renderer(): void
    {
        $runs = ArticleBody::runs('الاسم **مهم** هنا');

        $this->assertTrue(collect($runs)->contains(fn (array $r) => $r['bold'] && $r['text'] === 'مهم'));
    }

    public function test_the_articles_page_lists_them(): void
    {
        $this->artisan('taajir:articles')->assertSuccessful();

        $this->get('/articles')
            ->assertOk()
            ->assertSee('كيفاش تكري دار بلا سمسار');

        $this->get('/articles/louer-sans-agence')
            ->assertOk()
            ->assertSee('الضمان')
            ->assertSee('تحرير تأجير');
    }
}
