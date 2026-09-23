<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Listing;
use App\Models\User;
use App\Services\Geo;
use App\Services\ListingImageService;
use Database\Seeders\GeographySeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * The upload path, exercised against the real image library.
 *
 * Every other publish test posts a listing with no photos, which is why the
 * whole of this service could call an API two major versions old — read() and
 * toWebp(), removed in Intervention 4 — and still show green. Those are
 * method-not-found fatals at exactly the moment a seller attaches a photo, so
 * the one test that matters here is the one that actually hands it a file.
 */
final class ListingImageTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(GeographySeeder::class);
        Geo::forget();
        Storage::fake('public');
        $this->owner = User::factory()->create();
    }

    public function test_an_upload_is_resized_into_three_webp_widths(): void
    {
        $stored = app(ListingImageService::class)->store(
            [UploadedFile::fake()->image('maison.jpg', 2400, 1600)],
            $this->owner->uid,
            'abc123def456',
        );

        $this->assertCount(1, $stored);
        $this->assertStringEndsWith('-1600.webp', $stored[0]['storage_path']);
        $this->assertSame(1600, $stored[0]['width']);

        foreach ([400, 800, 1600] as $width) {
            Storage::disk('public')->assertExists("listings/{$this->owner->uid}/abc123def456/".
                basename(preg_replace('/-\d+\.webp$/', "-{$width}.webp", $stored[0]['storage_path'])));
        }
    }

    public function test_a_small_upload_writes_no_file_it_cannot_fill(): void
    {
        $stored = app(ListingImageService::class)->store(
            [UploadedFile::fake()->image('petit.jpg', 600, 400)],
            $this->owner->uid,
            'abc123def456',
        );

        $directory = "listings/{$this->owner->uid}/abc123def456";
        $base = basename($stored[0]['storage_path'], '-800.webp');

        Storage::disk('public')->assertExists("{$directory}/{$base}-400.webp");
        Storage::disk('public')->assertExists("{$directory}/{$base}-800.webp");
        Storage::disk('public')->assertMissing("{$directory}/{$base}-1600.webp");
    }

    public function test_a_small_photo_is_never_upscaled(): void
    {
        // A 600px photo rendered at 1600 is a blurrier file that costs more to
        // download than the original.
        $stored = app(ListingImageService::class)->store(
            [UploadedFile::fake()->image('petit.jpg', 600, 400)],
            $this->owner->uid,
            'abc123def456',
        );

        $this->assertSame(600, $stored[0]['width']);
    }

    public function test_a_file_that_is_not_an_image_is_skipped_rather_than_fatal(): void
    {
        $stored = app(ListingImageService::class)->store(
            [UploadedFile::fake()->create('contrat.pdf', 100, 'application/pdf')],
            $this->owner->uid,
            'abc123def456',
        );

        $this->assertSame([], $stored);
    }

    public function test_publishing_with_a_photo_files_it_under_the_listing(): void
    {
        $response = $this->actingAs($this->owner)->post('/publier', [
            'title' => 'شقة F3 في باب الزوار قرب الترامواي',
            'description' => 'شقة في الطابق الثالث، مساحة 90 متر مربع، عقد موثق، قريبة من كل المرافق.',
            'transaction_type' => 'vente',
            'property_type' => 'appartement',
            'wilaya' => 'alger',
            'commune' => 'bab-ezzouar',
            'price' => 8_000_000,
            'price_unit' => 'total',
            'contact_phone' => '0550112233',
            'photos' => [UploadedFile::fake()->image('salon.jpg', 1200, 900)],
        ]);

        $response->assertSessionHasNoErrors();

        $listing = Listing::query()->with('images')->firstOrFail();
        $this->assertCount(1, $listing->images);
        Storage::disk('public')->assertExists($listing->images[0]->storage_path);
        $this->assertNotNull($listing->cover_url);
    }

    public function test_the_srcset_names_only_the_files_that_exist(): void
    {
        $set = ListingImageService::srcset('/storage/listings/u/l/abcd-1600.webp', 1600);

        $this->assertStringContainsString('abcd-400.webp 400w', $set);
        $this->assertStringContainsString('abcd-800.webp 800w', $set);
        $this->assertStringContainsString('abcd-1600.webp 1600w', $set);
    }

    public function test_the_srcset_of_a_small_upload_describes_what_was_written(): void
    {
        // A 600px upload has two files. The larger is called -800.webp because
        // 800 is the step that covered it, but it is 600 pixels across — a
        // browser told 800 picks the wrong one on a narrow screen — and there
        // is no -1600.webp at all.
        $set = ListingImageService::srcset('/storage/listings/u/l/abcd-800.webp', 600);

        $this->assertStringContainsString('abcd-400.webp 400w', $set);
        $this->assertStringContainsString('abcd-800.webp 600w', $set);
        $this->assertStringNotContainsString('-1600.webp', $set);
    }
}
