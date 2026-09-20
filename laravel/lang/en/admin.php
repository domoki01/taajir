<?php

declare(strict_types=1);

return [
    'overview' => 'Overview',
    'overview_subtitle' => 'How the platform stands, and what just happened on it.',
    'back_to_panel' => 'Back to the admin panel',

    'tiles' => [
        'pending' => 'Awaiting review',
        'published' => 'Published',
        'users' => 'Accounts',
        'banned' => 'Suspended',
    ],

    'groups' => [
        'content' => 'Content',
        'people' => 'People',
        'growth' => 'Growth',
        'platform' => 'Platform',
    ],

    'nav' => [
        'queue' => 'Review queue',
        'comments' => 'Comments',
        'articles' => 'Articles',
        'taxonomy' => 'Categories and filters',
        'users' => 'Accounts',
        'roles' => 'Roles',
        'promos' => 'Promotions',
        'affiliate' => 'Referral programme',
        'push' => 'Broadcast',
        'launch' => 'Launch',
        'branding' => 'Branding',
        'audit' => 'Audit log',
    ],

    'hints' => [
        'queue' => 'Listings waiting on a decision',
        'comments' => 'Review and hide comments',
        'articles' => 'Write and publish articles',
        'taxonomy' => 'The categories and the search filters',
        'users' => 'Roles, quotas and suspensions',
        'roles' => 'Who is allowed to do what',
        'promos' => 'The banners across the site',
        'affiliate' => 'Points, the contest and the prizes',
        'push' => 'Send a notification to everyone',
        'launch' => 'Holding the site closed, the countdown and the switch',
        'branding' => 'The name, the logo and the colours',
        'audit' => 'Every decision, with who made it and when',
    ],

    'recent' => 'Latest actions',
    'audit_count' => 'Last :count actions',
    'audit_note' => 'Every moderation decision is recorded here against the person who made it. The log is written by the server alone and is never edited or deleted — which is what makes it mean anything.',
    'audit_unavailable' => 'The log could not be loaded.',
    'audit_empty' => 'Nothing has happened yet.',

    'audit' => [
        'actions' => [
            'listing' => [
                'approve' => 'approved a listing',
                'approve_for_launch' => 'approved a listing ahead of launch',
                'reject' => 'rejected a listing',
                'feature' => 'featured a listing',
                'unfeature' => 'removed a listing from featured',
                'archive' => 'archived a listing',
            ],
        ],
        'targets' => [
            'listing' => 'listing',
            'user' => 'account',
            'promo' => 'promotion',
            'role' => 'role',
            'comment' => 'comment',
            'article' => 'article',
            'settings' => 'settings',
        ],
    ],

    'moderation' => 'Moderation',
    'approve' => 'Approve',
    'reject' => 'Reject',
    'reject_reason' => 'Reason for rejection',
    'archive' => 'Archive',
    'approved' => 'Listing approved',
    'rejected' => 'Listing rejected',
    'archived' => 'Listing archived',
    'queue_empty' => 'No listings are waiting for review.',
];
