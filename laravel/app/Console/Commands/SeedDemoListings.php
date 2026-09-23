<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Listing;
use App\Models\PropertyRequest;
use App\Models\User;
use App\Services\Geo;
use App\Services\ListingImageService;
use App\Services\ListingService;
use App\Services\RequestService;
use App\Support\ListingId;
use App\Support\ReferralCode;
use Illuminate\Console\Command;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Ten listings with photos, for trying the site out.
 *
 * Everything goes through ListingService::create and ListingImageService, the
 * same path the publish form takes — so this exercises slug generation, the
 * derived fields, the quota lock and the whole image pipeline rather than
 * writing rows that merely look like the real thing. A demo seeder that
 * inserts straight into the table proves nothing about the site.
 *
 * The photos are generated here rather than shipped: three WebP derivatives
 * per image at 400, 800 and 1600, made by the same encoder a seller's upload
 * meets. Shipping ten JPEGs would add a megabyte to every release and skip the
 * part worth testing.
 *
 * --fresh removes what a previous run made, and nothing else: the demo user
 * owns them all, so there is no guessing about which rows were seeded.
 */
final class SeedDemoListings extends Command
{
    protected $signature = 'taajir:demo {--fresh : delete what a previous run made first}';

    protected $description = 'Create ten demo listings with photos and twenty demands, for trying the site out';

    private const DEMO_UID = 'demo-account-0000000000001';

    /*
     * The demands are spread over these accounts rather than posted by one.
     *
     * A single account may hold five open demands — the cap that keeps the
     * feed from being one person's noticeboard — so twenty from one owner
     * would stop at the sixth. Several posters is also what the feed actually
     * looks like, which is the thing being tried out.
     */
    private const ASKERS = [
        ['uid' => 'demo-asker-00000000000001', 'name' => 'كريم ب.'],
        ['uid' => 'demo-asker-00000000000002', 'name' => 'أمينة ح.'],
        ['uid' => 'demo-asker-00000000000003', 'name' => 'سفيان م.'],
        ['uid' => 'demo-asker-00000000000004', 'name' => 'نادية ز.'],
        ['uid' => 'demo-asker-00000000000005', 'name' => 'رضا ت.'],
    ];

    public function handle(ListingService $listings, ListingImageService $images, RequestService $requests): int
    {
        if (Geo::wilayas()->isEmpty()) {
            $this->error('No geography. Run `php artisan db:seed` first.');

            return self::FAILURE;
        }

        $owner = $this->owner();

        if ($this->option('fresh')) {
            $this->removeExisting($owner);
        }

        $rows = require database_path('demo/listings.php');
        $made = 0;

        foreach ($rows as $row) {
            // A slug that does not resolve is a typo in the data file, and it
            // must stop the run: the alternative is an ad filed in a place
            // that does not exist, found weeks later.
            $wilaya = Geo::wilaya($row['wilaya_slug']);

            if ($wilaya === null) {
                $this->error("Unknown wilaya slug: {$row['wilaya_slug']}");

                return self::FAILURE;
            }

            if (Geo::commune($wilaya->code, $row['commune_slug']) === null) {
                $this->error("Unknown commune slug: {$row['commune_slug']} in {$row['wilaya_slug']}");

                return self::FAILURE;
            }

            // Quota is enforced inside the service, and ten ads is past the
            // free allowance. Raised on the demo account only.
            $owner->update(['listing_quota' => max($owner->listing_quota, count($rows) + 5)]);

            $id = ListingId::mint();
            $photo = $this->photo($row);

            $stored = $images->store([$photo], $owner->uid, $id);
            @unlink($photo->getPathname());

            $listing = $listings->create($owner, $this->fields($row) + ['id' => $id], $stored);

            // Published outright: an ad sitting in the moderation queue shows
            // nothing on the pages this exists to look at.
            $listing->forceFill([
                'status' => 'published',
                'approved_for_launch' => true,
                'published_at' => now()->subDays($made),
            ])->save();

            $this->line("  ✔ {$row['title']}");
            $made++;
        }

        $asked = $this->seedRequests($requests);

        $this->info("\n{$made} listing(s) and {$asked} demand(s) created.");
        $this->line('Remove them with: php artisan taajir:demo --fresh');

        return self::SUCCESS;
    }

    private function seedRequests(RequestService $requests): int
    {
        $rows = require database_path('demo/requests.php');
        $askers = array_map(fn (array $a) => $this->account($a['uid'], $a['name']), self::ASKERS);
        $made = 0;

        /*
         * The posting rate limit is cleared for the demo accounts first.
         *
         * RequestService allows four demands per account per five minutes,
         * which is right for people and wrong for a command that posts twenty
         * at once and may be re-run a minute later to look at something again.
         * Cleared only for these accounts, and only their own keys: the limit
         * that protects the feed from a real person is untouched.
         */
        foreach ($askers as $asker) {
            RateLimiter::clear('request:'.$asker->uid);
        }

        $this->line('');

        foreach ($rows as $index => $row) {
            // Round-robin, so no account passes the five-demand cap and the
            // feed reads as several people rather than one.
            $owner = $askers[$index % count($askers)];

            $request = $requests->create($owner, [
                'intent' => $row['intent'],
                'title' => $row['title'],
                'description' => $row['description'],
                'wilaya' => $row['wilaya'],
                'commune' => $row['commune'] ?? null,
            ]);

            // Visible outright: a demand held in the queue shows nothing on
            // the page this exists to look at.
            $request->forceFill([
                'status' => 'visible',
                'created_at' => now()->subHours($index * 5),
            ])->save();

            $this->line("  ✔ {$row['title']}");
            $made++;
        }

        return $made;
    }

    private function owner(): User
    {
        return $this->account(self::DEMO_UID, 'حساب تجريبي');
    }

    private function account(string $uid, string $name): User
    {
        return User::firstOrCreate(
            ['uid' => $uid],
            [
                'display_name' => $name,
                'role_id' => 'user',
                'approved' => true,
                'phone' => '+213555000000',
                'listing_quota' => 25,
                'referral_code' => ReferralCode::mint(),
                'created_at' => now(),
            ],
        );
    }

    private function removeExisting(User $owner): void
    {
        $gone = 0;

        foreach (Listing::query()->where('owner_uid', $owner->uid)->get() as $listing) {
            $listing->delete();
            $gone++;
        }

        /*
         * The files as well as the rows, and by the path they are actually
         * written to.
         *
         * ListingImageService files a photo under listings/{owner}/{listing},
         * not listings/{listing}. Deleting the latter removed nothing, and two
         * runs of --fresh left sixty-three derivatives behind for ten ads —
         * a leak that is invisible until a shared host runs out of disk.
         * Removing the owner's whole directory also catches the ads whose rows
         * were deleted by an earlier, wronger version of this.
         */
        File::deleteDirectory(storage_path("app/public/listings/{$owner->uid}"));

        // Cascades take the images, amenities and comments; the owner's own
        // counter is not one of them.
        DB::table('users')->where('uid', $owner->uid)->update(['active_listing_count' => 0]);

        // The demands too, and from every demo account: a --fresh that left
        // twenty of them standing would double the feed on the next run.
        $uids = [$owner->uid, ...array_column(self::ASKERS, 'uid')];
        $demands = PropertyRequest::query()->whereIn('owner_uid', $uids)->delete();

        if ($gone > 0 || $demands > 0) {
            $this->line("Removed {$gone} listing(s) and {$demands} demand(s) from a previous run.\n");
        }
    }

    /** @param array<string, mixed> $row */
    private function fields(array $row): array
    {
        $fields = [
            'transaction_type', 'property_type', 'title', 'description',
            'price', 'price_unit', 'price_on_request', 'is_negotiable',
            'area_built', 'area_land', 'bathrooms', 'floor', 'quartier',
        ];

        $input = [];

        foreach ($fields as $field) {
            if (array_key_exists($field, $row)) {
                $input[$field] = $row[$field];
            }
        }

        /*
         * The service takes the form's field names, not the column names.
         *
         * `wilaya` and `commune` are what the publish request sends and what
         * ListingService reads to derive the slug and the denormalised place;
         * wilaya_slug and commune_slug are what it writes. Passing the columns
         * straight through fails on "Undefined array key wilaya", which is how
         * this was found.
         */
        $input['wilaya'] = $row['wilaya_slug'];
        $input['commune'] = $row['commune_slug'];

        $input['contact_phone'] = '+213555000000';
        $input['show_phone'] = true;
        $input['allow_whatsapp'] = true;

        return $input;
    }

    /**
     * A placeholder photo, drawn rather than downloaded.
     *
     * Deliberately not a photograph of a building: a stand-in that could be
     * mistaken for a real property is worse than one that plainly announces
     * itself, both on a screenshot and in someone's memory of what they saw.
     * What it does carry is the thing the pages need — a real 1600×1067 image
     * in the right aspect ratio, so cards, galleries and srcset behave exactly
     * as they will with a seller's upload.
     *
     * @param  array<string, mixed>  $row
     */
    private function photo(array $row): UploadedFile
    {
        [$hue, $saturation, $lightness] = $row['tone'];

        $width = 1600;
        $height = 1067;
        $image = imagecreatetruecolor($width, $height);

        // A vertical gradient, band by band: GD has no gradient of its own and
        // a flat fill reads as a broken image rather than a placeholder.
        for ($y = 0; $y < $height; $y++) {
            [$r, $g, $b] = $this->hsl($hue, $saturation / 100, ($lightness + ($y / $height) * 22) / 100);
            imagefilledrectangle($image, 0, $y, $width, $y + 1, imagecolorallocate($image, $r, $g, $b));
        }

        // A horizon and a roofline: enough shape that a card does not look
        // empty, not so much that it pretends to be a photograph.
        [$r, $g, $b] = $this->hsl($hue, $saturation / 100, ($lightness - 14) / 100);
        $dark = imagecolorallocate($image, $r, $g, $b);
        imagefilledrectangle($image, 0, (int) ($height * 0.72), $width, $height, $dark);
        imagefilledpolygon($image, [
            (int) ($width * 0.30), (int) ($height * 0.72),
            (int) ($width * 0.50), (int) ($height * 0.44),
            (int) ($width * 0.70), (int) ($height * 0.72),
        ], $dark);

        $path = tempnam(sys_get_temp_dir(), 'demo').'.jpg';
        imagejpeg($image, $path, 88);
        imagedestroy($image);

        // test: true keeps UploadedFile from expecting a real upload, which is
        // the only part of this that is not the seller's path.
        return new UploadedFile($path, 'demo.jpg', 'image/jpeg', null, true);
    }

    /** @return array{int, int, int} */
    private function hsl(float $h, float $s, float $l): array
    {
        $c = (1 - abs(2 * $l - 1)) * $s;
        $x = $c * (1 - abs(fmod($h / 60, 2) - 1));
        $m = $l - $c / 2;

        [$r, $g, $b] = match (true) {
            $h < 60 => [$c, $x, 0.0],
            $h < 120 => [$x, $c, 0.0],
            $h < 180 => [0.0, $c, $x],
            $h < 240 => [0.0, $x, $c],
            $h < 300 => [$x, 0.0, $c],
            default => [$c, 0.0, $x],
        };

        return [
            (int) round(($r + $m) * 255),
            (int) round(($g + $m) * 255),
            (int) round(($b + $m) * 255),
        ];
    }
}
