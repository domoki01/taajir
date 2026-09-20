<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Article;
use App\Models\ArticleComment;
use App\Models\User;
use App\Services\Geo;
use App\Support\ArticleBody;
use Database\Seeders\GeographySeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The masthead: the editor, the public pages, and the rule that nothing an
 * editor types ever becomes markup.
 */
final class ArticlesTest extends TestCase
{
    use RefreshDatabase;

    private User $editor;

    private User $reader;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(GeographySeeder::class);
        Geo::forget();

        // The moderator role holds articles.manage by default: the point of the
        // articles is that somebody actually writes them.
        $this->editor = User::factory()->create(['role_id' => 'moderator']);
        $this->reader = User::factory()->create(['role_id' => 'user']);
    }

    /** @param array<string, mixed> $overrides */
    private function draft(array $overrides = []): array
    {
        return [
            'slug' => 'marche-immobilier-algerie',
            'title' => 'كيفاش تكري دار في الجزائر بلا سمسار',
            'excerpt' => 'شرح مبسّط على الكراء في الجزائر: الأوراق، الضمان، والأخطاء اللي يديروها الناس.',
            'body' => "## الأوراق\n\nالفقرة الأولى.\n\n- نقطة مهمة\n\n> اقتباس",
            'status' => 'published',
            ...$overrides,
        ];
    }

    public function test_the_editor_needs_articles_manage(): void
    {
        $this->actingAs($this->reader)->get('/admin/articles')->assertForbidden();
        $this->actingAs($this->editor)->get('/admin/articles')->assertOk();
        $this->actingAs($this->reader)->post('/admin/articles', $this->draft())->assertForbidden();
    }

    public function test_the_body_is_stored_as_blocks_and_never_as_markup(): void
    {
        $this->actingAs($this->editor)->post('/admin/articles', $this->draft([
            'body' => "## عنوان\n\n<script>alert(1)</script>\n\n- نقطة\n\n> اقتباس",
        ]))->assertSessionHasNoErrors();

        $article = Article::query()->firstOrFail();

        $this->assertSame(
            ['h2', 'p', 'li', 'quote'],
            array_column($article->body, 'type'),
        );

        // Stored as text, and printed as text: the page escapes it, so the
        // script tag is visible rather than executable.
        $html = $this->get('/articles/marche-immobilier-algerie')->assertOk()->getContent();
        $this->assertStringNotContainsString('<script>alert(1)</script>', $html);
        $this->assertStringContainsString('&lt;script&gt;alert(1)&lt;/script&gt;', $html);
    }

    public function test_an_article_needs_three_paragraphs(): void
    {
        $this->actingAs($this->editor)
            ->post('/admin/articles', $this->draft(['body' => "سطر واحد\n\nوسطر ثاني"]))
            ->assertSessionHasErrors('body');
    }

    public function test_the_slug_is_latin_and_never_invented_from_an_arabic_title(): void
    {
        // A transliteration would put "sok-alaakar" in a URL. Latin and
        // French-derived is the rule; telling the editor is the better answer.
        $this->actingAs($this->editor)
            ->post('/admin/articles', $this->draft(['slug' => 'سوق العقار']))
            ->assertSessionHasErrors('slug');

        // An accented Latin slug folds rather than being refused.
        $this->actingAs($this->editor)
            ->post('/admin/articles', $this->draft(['slug' => 'Le marché immobilier']))
            ->assertSessionHasNoErrors();

        $this->assertSame('le-marche-immobilier', Article::query()->firstOrFail()->slug);
    }

    public function test_a_slug_cannot_shadow_the_editor_or_another_article(): void
    {
        $this->actingAs($this->editor)
            ->post('/admin/articles', $this->draft(['slug' => 'nouveau']))
            ->assertSessionHasErrors('slug');

        $this->actingAs($this->editor)->post('/admin/articles', $this->draft())->assertSessionHasNoErrors();
        $this->actingAs($this->editor)->post('/admin/articles', $this->draft(['title' => 'عنوان آخر طويل بزاف']))
            ->assertSessionHasErrors('slug');

        $this->assertSame(1, Article::query()->count());
    }

    public function test_a_draft_is_not_a_page(): void
    {
        Article::factory()->draft()->create(['slug' => 'brouillon']);

        // 404, not 403: "this does not exist yet" is the truth, and 403 would
        // confirm that it does.
        $this->get('/articles/brouillon')->assertNotFound();
        $this->get('/articles')->assertOk()->assertDontSee('brouillon');
    }

    public function test_republishing_does_not_move_a_piece_back_to_the_top(): void
    {
        $this->actingAs($this->editor)->post('/admin/articles', $this->draft());
        $article = Article::query()->firstOrFail();

        $first = $article->published_at;
        $this->travel(2)->days();

        $this->actingAs($this->editor)
            ->patch("/admin/articles/{$article->id}", $this->draft(['excerpt' => 'ملخّص جديد بعد تصحيح خطأ مطبعي في النص.']))
            ->assertSessionHasNoErrors();

        $this->assertTrue($first->equalTo($article->fresh()->published_at));
    }

    public function test_the_first_publisher_keeps_the_byline(): void
    {
        $this->actingAs($this->editor)->post('/admin/articles', $this->draft());
        $article = Article::query()->firstOrFail();

        $second = User::factory()->create(['role_id' => 'moderator', 'display_name' => 'محرّر آخر']);
        $this->actingAs($second)->patch("/admin/articles/{$article->id}", $this->draft());

        // An editor fixing a typo three months later does not become the
        // author of the piece.
        $this->assertSame($this->editor->uid, $article->fresh()->author_uid);
    }

    public function test_a_cover_url_is_https_or_same_origin_and_nothing_else(): void
    {
        // og:image is fetched by other people's servers on every shared link,
        // so a hostile host there is a beacon aimed at our own readers.
        foreach (['http://evil.dz/x.png', 'javascript:alert(1)', 'data:image/svg+xml,<svg>', '//evil.dz/x.png'] as $url) {
            $this->assertNull(ArticleBody::safeCoverUrl($url), $url);
        }

        $this->assertSame('/storage/a.png', ArticleBody::safeCoverUrl('/storage/a.png'));
        $this->assertSame('https://cdn.dz/a.png', ArticleBody::safeCoverUrl('https://cdn.dz/a.png'));
    }

    public function test_the_reading_time_rounds_up(): void
    {
        $blocks = [['type' => 'p', 'text' => str_repeat('كلمة ', 200)]];

        // 200 words at 180 a minute is not one minute.
        $this->assertSame(2, ArticleBody::readingMinutes($blocks));
        $this->assertSame(1, ArticleBody::readingMinutes([['type' => 'p', 'text' => 'كلمة']]));
    }

    public function test_half_a_bold_run_stays_a_typo(): void
    {
        // An odd number of markers is literal text: half a bold run should look
        // like the typo it is, not eat the rest of the paragraph.
        $this->assertSame(
            [['text' => 'نص **ناقص', 'bold' => false]],
            ArticleBody::runs('نص **ناقص'),
        );

        $this->assertSame(
            [['text' => 'نص ', 'bold' => false], ['text' => 'غليظ', 'bold' => true]],
            ArticleBody::runs('نص **غليظ**'),
        );
    }

    public function test_the_editor_reopens_what_it_saved(): void
    {
        $raw = "## عنوان\n\nفقرة.\n\n- نقطة\n\n> اقتباس";

        $this->assertSame($raw, ArticleBody::toRaw(ArticleBody::parse($raw)));
    }

    public function test_a_comment_needs_an_account_and_a_published_article(): void
    {
        $article = Article::factory()->create(['slug' => 'ouvert']);
        $draft = Article::factory()->draft()->create(['slug' => 'ferme']);

        $this->post('/articles/ouvert/commentaires', ['text' => 'مقال مفيد'])
            ->assertRedirectContains('/connexion');

        $this->actingAs($this->reader)
            ->post('/articles/ferme/commentaires', ['text' => 'مقال مفيد'])
            ->assertSessionHasErrors('text');

        $this->actingAs($this->reader)
            ->post('/articles/ouvert/commentaires', ['text' => 'مقال مفيد، شكراً'])
            ->assertSessionHasNoErrors();

        $this->assertSame(1, $article->fresh()->comment_count);
        $this->assertSame($this->reader->display_name, ArticleComment::query()->firstOrFail()->author_name);
    }

    public function test_a_link_in_a_comment_is_refused_not_stripped(): void
    {
        Article::factory()->create(['slug' => 'ouvert']);

        $this->actingAs($this->reader)
            ->post('/articles/ouvert/commentaires', ['text' => 'شوف هنا example.dz/offre'])
            ->assertSessionHasErrors('text');

        $this->assertSame(0, ArticleComment::query()->count());
    }

    public function test_a_hidden_comment_is_still_visible_to_its_author_and_to_staff(): void
    {
        $article = Article::factory()->create(['slug' => 'ouvert']);
        $comment = $article->comments()->create([
            'author_uid' => $this->reader->uid,
            'author_name' => $this->reader->display_name,
            'text' => 'تعليق مخفي هنا',
            'status' => 'hidden',
            'hidden_reason' => 'خارج الموضوع',
            'created_at' => now(),
        ]);

        // A comment that vanishes without a word reads as a bug and gets posted
        // again; a moderator has to be able to review the decision.
        $this->get('/articles/ouvert')->assertDontSee('تعليق مخفي هنا', false);
        $this->actingAs($this->reader)->get('/articles/ouvert')->assertSee('تعليق مخفي هنا', false);
        $this->actingAs($this->editor)->get('/articles/ouvert')->assertSee('تعليق مخفي هنا', false);

        $this->assertNotNull($comment->fresh());
    }

    public function test_the_author_deletes_their_own_and_a_stranger_does_not(): void
    {
        $article = Article::factory()->create(['slug' => 'ouvert', 'comment_count' => 1]);
        $comment = $article->comments()->create([
            'author_uid' => $this->reader->uid,
            'author_name' => $this->reader->display_name,
            'text' => 'تعليقي',
            'created_at' => now(),
        ]);

        $stranger = User::factory()->create(['role_id' => 'user']);
        $this->actingAs($stranger)->delete("/articles/commentaires/{$comment->id}")->assertForbidden();

        $this->actingAs($this->reader)->delete("/articles/commentaires/{$comment->id}")->assertSessionHasNoErrors();
        $this->assertSame(0, ArticleComment::query()->count());
        $this->assertSame(0, $article->fresh()->comment_count);
    }

    public function test_deleting_an_article_takes_its_thread_with_it(): void
    {
        $article = Article::factory()->create(['slug' => 'ouvert']);
        $article->comments()->create([
            'author_uid' => $this->reader->uid,
            'author_name' => 'قارئ',
            'text' => 'تعليق',
            'created_at' => now(),
        ]);

        $this->actingAs($this->editor)->delete("/admin/articles/{$article->id}")->assertSessionHasNoErrors();

        // Left behind, its comments are orphans no screen can reach or
        // moderate.
        $this->assertSame(0, ArticleComment::query()->count());
    }

    public function test_the_sitemap_lists_published_articles_and_declares_the_right_namespace(): void
    {
        Article::factory()->create(['slug' => 'publie']);
        Article::factory()->draft()->create(['slug' => 'brouillon']);
        cache()->forget('sitemap');

        $xml = $this->get('/sitemap.xml')->assertOk()->getContent();

        // sitemaps.org, with the s. A sitemap declaring the wrong namespace is
        // rejected whole, and it fails silently: 200, and nothing crawled.
        $this->assertStringContainsString('http://www.sitemaps.org/schemas/sitemap/0.9', $xml);
        $this->assertStringContainsString('/articles/publie', $xml);
        $this->assertStringNotContainsString('/articles/brouillon', $xml);
    }
}
