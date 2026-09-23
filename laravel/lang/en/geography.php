<?php

declare(strict_types=1);

return [
    /*
     * English names for the wilayas that have one.
     *
     * Almost none do. Algerian place names in English are the French forms —
     * Oran, Constantine, Annaba, Sétif are written that way on every map and
     * every road sign, and inventing transliterations for the other sixty-odd
     * would be worse than useless. Only the capital has an established English
     * exonym, and it is also the most-searched wilaya on the site.
     *
     * Anything not listed here falls back to `wilayas.name_fr`.
     */
    'wilayas' => [
        'alger' => 'Algiers',
    ],
];
