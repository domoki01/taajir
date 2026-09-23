<?php

declare(strict_types=1);

return [
    'subtitle' => 'One message to every account.',
    'nothing_sends_yet' => 'No channel is wired yet, so the message is written to the outbox and waits there. That is deliberate — a queued row is a message waiting for credentials, not a message lost, and when a channel does arrive the record of who should have been told already exists.',
    'title_label' => 'Title',
    'body_label' => 'Text',
    'body_hint' => 'Two lines at most — Android and iPhone both cut the rest.',
    'url_label' => 'Link',
    'url_hint' => 'An internal path only, starting with / . A notification arrives wearing the site’s name and icon on a lock screen; it must not be able to carry anyone off it.',
    'queue_it' => 'Write it to the outbox',
    'queued' => 'Written for :count recipients',
    'internal_only' => 'The link has to be internal and start with /',
    'no_links' => 'No links in the text — put it in the link field.',
    'waiting_title' => 'Channels',
    'waiting' => ':count waiting',
    'ready' => 'wired',
    'not_wired' => 'not wired yet',
    'recent' => 'Recent messages',
    'recipients' => ':count recipients',
    'channels' => [
        'email' => 'Email',
        'sms' => 'SMS',
        'push' => 'Push',
    ],
];
