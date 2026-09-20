<?php

declare(strict_types=1);

return [
    'subtitle' => 'Un message à tous les comptes.',
    'nothing_sends_yet' => 'Aucun canal n’est encore branché : le message est écrit dans la file d’envoi et y attend. C’est voulu — une ligne en attente est un message qui attend des identifiants, pas un message perdu, et le jour où un canal arrive, la liste de qui devait être prévenu existe déjà.',
    'title_label' => 'Titre',
    'body_label' => 'Texte',
    'body_hint' => 'Deux lignes au plus — Android comme iPhone coupent le reste.',
    'url_label' => 'Lien',
    'url_hint' => 'Un chemin interne uniquement, commençant par / . Une notification arrive avec le nom et l’icône du site sur un écran verrouillé : elle ne doit pas pouvoir emmener quelqu’un ailleurs.',
    'queue_it' => 'Mettre en file',
    'queued' => 'Écrit pour :count destinataires',
    'internal_only' => 'Le lien doit être interne au site et commencer par /',
    'no_links' => 'Pas de lien dans le texte — mettez-le dans le champ prévu.',
    'waiting_title' => 'Canaux',
    'waiting' => ':count en attente',
    'ready' => 'branché',
    'not_wired' => 'pas encore branché',
    'recent' => 'Derniers messages',
    'recipients' => ':count destinataires',
    'channels' => [
        'email' => 'E-mail',
        'sms' => 'SMS',
        'push' => 'Notification',
    ],
];
