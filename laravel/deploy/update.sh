#!/bin/sh
#
# The same update update.php does, for an account that has SSH.
#
# Run it from anywhere:  sh ~/taajir-app/deploy/update.sh
#
# It assumes the code is already on the server — pushed by the post-receive
# hook, or uploaded. What it does is everything that has to happen *after* new
# code lands: dependencies, schema, the image link, and the caches.
#
# Safe to run twice. Every step does nothing when there is nothing to do.

set -eu

APP="${TAAJIR_APP:-$HOME/taajir-app}"
DOCROOT="${TAAJIR_DOCROOT:-$HOME/domains/taajirdz.com/public_html}"
PHP="${PHP_BIN:-php}"
COMPOSER="${COMPOSER_BIN:-composer}"

[ -f "$APP/artisan" ] || { echo "!! no Laravel app at $APP — set TAAJIR_APP" >&2; exit 1; }

cd "$APP"

# ext-intl is a hard requirement of the Arabic text fold. Checked before
# anything is written, because the error it otherwise produces at runtime says
# nothing about intl and everything about a stack trace.
$PHP -m | grep -qx intl || {
    echo "!! PHP has no intl extension. Enable it in the PHP selector first." >&2
    exit 1
}

# The writable tree, which is server-owned and therefore never in a push.
#
# Laravel resolves view.compiled with realpath(), which returns false for a
# directory that does not exist — so a missing storage/framework/views does not
# produce "no such directory" but "View path not found" from deep inside
# view:clear, and the deploy stops there. Creating the skeleton is cheaper than
# explaining that sentence.
echo "→ writable tree"
for d in app/public framework/cache/data framework/sessions framework/views logs; do
    mkdir -p "$APP/storage/$d"
done
mkdir -p "$APP/bootstrap/cache"
chmod -R 775 "$APP/storage" "$APP/bootstrap/cache" 2>/dev/null || true

echo "→ dependencies"
# Named before it is run. Composer is frequently not on PATH on a shared
# account — it is a composer.phar in $HOME — and "command not found" partway
# through a deploy is a worse sentence than this one.
command -v "$COMPOSER" >/dev/null 2>&1 || [ -f "$COMPOSER" ] || {
    echo "!! Composer not found at '$COMPOSER'. Set COMPOSER_BIN, e.g. COMPOSER_BIN=\"php \$HOME/composer.phar\"" >&2
    exit 1
}

$COMPOSER install --no-dev --optimize-autoloader --no-interaction --no-progress

# Every artisan call below needs this file. Without the check the next line is
# a raw PHP fatal about failing to open vendor/autoload.php, which says nothing
# about the install that did not happen.
[ -f "$APP/vendor/autoload.php" ] || {
    echo "!! vendor/autoload.php is missing — composer install did not complete." >&2
    exit 1
}

# Cleared before migrating, not after: a config cache written by the previous
# version is read on every boot, so an update that added a config key would run
# the migration against the old configuration.
echo "→ clearing stale caches"
$PHP artisan config:clear
$PHP artisan route:clear
$PHP artisan view:clear

echo "→ schema"
# Every migration in this project creates; none drops. That is what makes an
# unattended --force safe here and would not elsewhere.
$PHP artisan migrate --force

echo "→ seeds"
# Idempotent by construction: the roles seeder upserts and inserts only missing
# permissions, and the geography seeder keys on the slug. Running it on every
# update is how a new wilaya or a new permission arrives without anyone having
# to remember.
$PHP artisan db:seed --force

echo "→ image link"
# artisan storage:link writes into public/storage, and in the split layout
# public/ is not the document root — so the link is made by hand, where the web
# server will actually look for it.
[ -e "$DOCROOT/storage" ] || ln -s "$APP/storage/app/public" "$DOCROOT/storage"

echo "→ caches"
$PHP artisan config:cache
$PHP artisan route:cache
$PHP artisan view:cache

# Not in git and not built on the host: a deploy that forgot them is a site with
# no styling, which looks like a far stranger bug than it is.
[ -f "$DOCROOT/build/manifest.json" ] || \
    echo "!  $DOCROOT/build/manifest.json is missing — run 'npm run build' locally and upload public/build/"

echo "✓ updated"
echo
echo "Cron, once, every minute:"
echo "  * * * * * cd $APP && $PHP artisan schedule:run >/dev/null 2>&1"
