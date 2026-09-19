<?php

declare(strict_types=1);

return [
    'property_types' => [
        'appartement' => 'Apartment',
        'villa' => 'Villa',
        'maison' => 'House',
        'niveau-villa' => 'Villa floor',
        'studio' => 'Studio',
        'duplex' => 'Duplex',
        'terrain' => 'Land',
        'terrain-agricole' => 'Farmland',
        'local' => 'Commercial space',
        'bureau' => 'Office',
        'hangar' => 'Warehouse',
        'garage' => 'Garage',
        'immeuble' => 'Building',
    ],

    'deals' => [
        'vente' => 'Sale',
        'location' => 'Rent',
        'vacances' => 'Short-term rental',
        'echange' => 'Exchange',
    ],

    'deal_filters' => [
        'vente' => 'For sale / buy',
        'location' => 'For rent',
        'vacances' => 'Short-term rental',
        'echange' => 'Exchange',
    ],

    'deal_headings' => [
        'vente' => 'for sale',
        'location' => 'for rent',
        'vacances' => 'for short-term rent',
        'echange' => 'for exchange',
        'fallback' => ':label',
    ],

    'price_units' => [
        'total' => 'Total price',
        'mois' => 'per month',
        'annee' => 'per year',
        'nuit' => 'per night',
        'm2' => 'per m²',
    ],
];
