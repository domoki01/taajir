<?php

declare(strict_types=1);

return [
    'overview' => 'Vue d’ensemble',
    'overview_subtitle' => 'L’état de la plateforme, et ce qui vient de s’y passer.',
    'back_to_panel' => 'Retour au panneau',

    'tiles' => [
        'pending' => 'En attente',
        'published' => 'Publiées',
        'users' => 'Comptes',
        'banned' => 'Suspendus',
    ],

    'groups' => [
        'content' => 'Contenu',
        'people' => 'Personnes',
        'growth' => 'Croissance',
        'platform' => 'Plateforme',
    ],

    'nav' => [
        'queue' => 'File de modération',
        'comments' => 'Commentaires',
        'articles' => 'Articles',
        'taxonomy' => 'Catégories et filtres',
        'users' => 'Comptes',
        'roles' => 'Rôles',
        'promos' => 'Publicités',
        'affiliate' => 'Programme de parrainage',
        'push' => 'Notification générale',
        'launch' => 'Lancement',
        'branding' => 'Identité',
        'audit' => 'Journal',
    ],

    'hints' => [
        'queue' => 'Les annonces qui attendent une décision',
        'comments' => 'Relire et masquer les commentaires',
        'articles' => 'Rédiger et publier des articles',
        'taxonomy' => 'Les catégories et les filtres de recherche',
        'users' => 'Rôles, quotas et suspensions',
        'roles' => 'Qui a le droit de faire quoi',
        'promos' => 'Les bannières sur les pages',
        'affiliate' => 'Les points, le concours et les lots',
        'push' => 'Envoyer une notification à tout le monde',
        'launch' => 'Fermeture du site, compte à rebours et ouverture',
        'branding' => 'Le nom, le logo et les couleurs',
        'audit' => 'Chaque décision, avec son auteur et son heure',
    ],

    'recent' => 'Dernières opérations',
    'audit_count' => ':count dernières opérations',
    'audit_note' => 'Chaque décision de modération est enregistrée ici avec son auteur. Le journal n’est écrit que par le serveur : il ne se modifie pas et ne s’efface pas — c’est ce qui lui donne sa valeur.',
    'audit_unavailable' => 'Impossible de charger le journal.',
    'audit_empty' => 'Rien ne s’est encore passé.',

    'audit' => [
        'actions' => [
            'listing' => [
                'approve' => 'a approuvé une annonce',
                'approve_for_launch' => 'a approuvé une annonce avant le lancement',
                'reject' => 'a refusé une annonce',
                'feature' => 'a mis une annonce en avant',
                'unfeature' => 'a retiré la mise en avant',
                'archive' => 'a archivé une annonce',
            ],
        ],
        'targets' => [
            'listing' => 'annonce',
            'user' => 'compte',
            'promo' => 'publicité',
            'role' => 'rôle',
            'comment' => 'commentaire',
            'article' => 'article',
            'settings' => 'réglages',
        ],
    ],

    'moderation' => 'Modération',
    'approve' => 'Approuver',
    'reject' => 'Refuser',
    'reject_reason' => 'Motif du refus',
    'archive' => 'Archiver',
    'approved' => 'Annonce approuvée',
    'rejected' => 'Annonce refusée',
    'archived' => 'Annonce archivée',
    'queue_empty' => 'Aucune annonce en attente de vérification.',
];
