<?php

declare(strict_types=1);

return [
    'property_types' => [
        'appartement' => 'شقة',
        'villa' => 'فيلا',
        'maison' => 'منزل',
        'niveau-villa' => 'مستوى في فيلا',
        'studio' => 'استوديو',
        'duplex' => 'دوبلكس',
        'terrain' => 'أرض',
        'terrain-agricole' => 'أرض فلاحية',
        'local' => 'محل تجاري',
        'bureau' => 'مكتب',
        'hangar' => 'مستودع',
        'garage' => 'كراج',
        'immeuble' => 'عمارة',
    ],

    // Deals, worded for someone posting.
    'deals' => [
        'vente' => 'بيع',
        'location' => 'كراء',
        'vacances' => 'كراء بالليلة',
        'echange' => 'مبادلة',
    ],

    /*
     * The same deals, worded for someone searching rather than offering.
     *
     * A buyer and a seller are on opposite sides of one set of ads, so "شراء"
     * is not a filter value — filtering by it would ask for ads that do not
     * exist. It is named in the label because that is the word a buyer looks for.
     */
    'deal_filters' => [
        'vente' => 'للبيع / شراء',
        'location' => 'للكراء',
        'vacances' => 'كراء بالليلة',
        'echange' => 'مبادلة',
    ],

    /*
     * The deal as it appears inside a page heading: "شقة للبيع في الجزائر".
     *
     * A phrase rather than the label with a preposition glued on, because the
     * three languages glue differently — Arabic prefixes لل, French says "à
     * vendre", English says "for sale". `fallback` covers a deal an admin
     * invented, which has a label and no phrase.
     */
    'deal_headings' => [
        'vente' => 'للبيع',
        'location' => 'للكراء',
        'vacances' => 'للكراء بالليلة',
        'echange' => 'للمبادلة',
        'fallback' => 'لل:label',
    ],

    'price_units' => [
        'total' => 'السعر الإجمالي',
        'mois' => 'في الشهر',
        'annee' => 'في السنة',
        'nuit' => 'في الليلة',
        'm2' => 'للمتر المربع',
    ],
];
