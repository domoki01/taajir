<?php

declare(strict_types=1);

return [
    'title' => 'Update the site',
    'subtitle' => 'Upload a release and apply it.',
    'file_label' => 'Release file (.zip)',
    'limit' => 'Maximum size: :size MB',
    'apply' => 'Apply the update',
    'applying' => 'Applying…',
    'patience' => 'This can take a minute. Do not close the page or press twice.',
    'applied' => 'Update applied. :app files in the application, :docroot in the document root.',
    'migrations_ran' => 'Tables added',

    'what_it_does' => 'What it does',
    'step_extract' => 'Unpacks the release and replaces every code file.',
    'step_keep' => 'Leaves .env, storage, vendor and index.php alone — replacing any one of them would take the site down.',
    'step_cache' => 'Clears the caches and the compiled views, which are what keep old code running after an update.',
    'step_migrate' => 'Runs the migrations and the seeds, then rebuilds the caches.',

    'exposed' => 'The application folder is inside public_html. An .htaccess closes it, but move it above the document root when you can — an .htaccess that stops being read re-exposes everything.',

    'no_zip_extension' => 'The zip extension is not enabled in PHP.',
    'unreadable' => 'The file could not be opened — the upload may have been cut short. Try again.',
    'no_staging' => 'Could not create a temporary folder — check disk space and permissions.',
    'extract_failed' => 'Unpacking failed — the disk may be full.',
    'not_a_release' => 'That is not a تأجير release — it has to contain taajir-app/ and public_html/.',
    'command_failed' => 'The :command command failed',
];
