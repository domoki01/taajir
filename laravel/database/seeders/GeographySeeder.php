<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * The 69 wilayas and their 1541 communes.
 *
 * Seeded from committed data files, never from Firestore: geography is source,
 * not user data. `database/data/*.json` is generated from the Next app's
 * `src/data/geo/` (itself built by `scripts/build-geo.mjs` from geoalgeria
 * cross-checked against algeria-wilayas-communes), so there is exactly one
 * upstream for both sites and the slugs cannot drift apart.
 *
 * Idempotent: it upserts. Re-running after a boundary change updates names and
 * codes without touching the slugs that URLs depend on.
 */
class GeographySeeder extends Seeder
{
    public function run(): void
    {
        $wilayas = $this->read('wilayas.json');
        $communes = $this->read('communes.json');

        DB::table('wilayas')->upsert(
            array_map(fn (array $w) => [
                'code' => $w['code'],
                'code58' => $w['code58'],
                'name_ar' => $w['nameAr'],
                'name_fr' => $w['nameFr'],
                'slug' => $w['slug'],
                'aliases' => json_encode($w['aliases'], JSON_UNESCAPED_UNICODE),
                'is_new_2026' => $w['isNew2026'],
                'commune_count' => $w['communeCount'],
            ], $wilayas),
            ['code'],
            ['code58', 'name_ar', 'name_fr', 'slug', 'aliases', 'is_new_2026', 'commune_count'],
        );

        $rows = [];
        foreach ($communes as $wilayaCode => $list) {
            foreach ($list as $commune) {
                $rows[] = [
                    'wilaya_code' => (int) $wilayaCode,
                    'slug' => $commune['slug'],
                    'name_ar' => $commune['nameAr'],
                    'name_fr' => $commune['nameFr'],
                    'postal_code' => $commune['postalCode'] ?? null,
                    'lat' => $commune['lat'] ?? null,
                    'lng' => $commune['lng'] ?? null,
                ];
            }
        }

        // Chunked because 1541 rows in one statement is past what a shared
        // host's max_allowed_packet is configured for.
        foreach (array_chunk($rows, 200) as $chunk) {
            DB::table('communes')->upsert(
                $chunk,
                ['wilaya_code', 'slug'],
                ['name_ar', 'name_fr', 'postal_code', 'lat', 'lng'],
            );
        }
    }

    /** @return array<mixed> */
    private function read(string $file): array
    {
        $path = database_path('data/'.$file);
        $json = file_get_contents($path);

        if ($json === false) {
            throw new \RuntimeException("Missing geography dataset: {$path}");
        }

        return json_decode($json, true, flags: JSON_THROW_ON_ERROR);
    }
}
