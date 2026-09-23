<?php

declare(strict_types=1);

return [
    'no_links' => 'Les liens ne sont pas autorisés.',

    'reasons' => [
        'links' => "L'annonce contient un lien. Les liens sont interdits — mettez les détails dans la description ; le contact passe par la plateforme.",
        'profanity' => "L'annonce contient des propos injurieux. Rédigez une description correcte et republiez.",
        'scam' => "L'annonce mentionne un moyen de paiement interdit (transfert à l'étranger ou cryptomonnaie). Les transactions se font directement entre les parties, en Algérie.",
        'offtopic' => "L'annonce ne semble pas porter sur un bien immobilier. Elle est en cours de vérification.",
        'spam' => "L'annonce contient trop de répétitions. Elle est en cours de vérification.",
    ],

    'flags' => [
        'links' => 'Contient un lien',
        'profanity' => 'Propos injurieux',
        'scam' => 'Moyen de paiement interdit',
        'offtopic' => 'Ne semble pas immobilier',
        'spam' => 'Texte très répétitif',
    ],
];
