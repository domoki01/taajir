<?php

declare(strict_types=1);

return [
    'title' => 'Mettre à jour le site',
    'subtitle' => 'Envoyez une version et appliquez-la.',
    'file_label' => 'Fichier de version (.zip)',
    'limit' => 'Taille maximale : :size Mo',
    'apply' => 'Appliquer la mise à jour',
    'applying' => 'Application en cours…',
    'patience' => 'Cela peut prendre une minute. Ne fermez pas la page et ne cliquez pas deux fois.',
    'applied' => 'Mise à jour appliquée. :app fichiers dans l’application, :docroot dans le document root.',
    'migrations_ran' => 'Tables ajoutées',

    'what_it_does' => 'Ce qu’elle fait',
    'step_extract' => 'Décompresse la version et remplace tous les fichiers de code.',
    'step_keep' => 'Ne touche ni .env, ni storage, ni vendor, ni index.php — remplacer l’un d’eux mettrait le site à terre.',
    'step_cache' => 'Vide les caches et les vues compilées : c’est ce qui fait tourner l’ancien code après une mise à jour.',
    'step_migrate' => 'Exécute les migrations et les seeds, puis reconstruit les caches.',

    'exposed' => 'Le dossier de l’application est à l’intérieur de public_html. Il est fermé par un .htaccess, mais déplacez-le au-dessus dès que possible : un .htaccess qui cesse d’être lu réexpose tout.',

    'no_zip_extension' => 'L’extension zip n’est pas activée dans PHP.',
    'unreadable' => 'Fichier illisible — l’envoi a peut-être été interrompu. Réessayez.',
    'no_staging' => 'Impossible de créer un dossier temporaire — vérifiez l’espace disque et les permissions.',
    'extract_failed' => 'La décompression a échoué — peut-être un disque plein.',
    'not_a_release' => 'Ce n’est pas une version de تأجير : elle doit contenir taajir-app/ et public_html/.',
    'command_failed' => 'La commande :command a échoué',
];
