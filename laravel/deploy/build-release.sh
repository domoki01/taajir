#!/bin/sh
#
# Build a release zip: the thing /admin/mise-a-jour and install-update.php both
# unpack.
#
#   sh deploy/build-release.sh [output.zip]
#
# The layout is fixed and both installers check it: taajir-app/ mirrors over the
# application tree above the document root, public_html/ mirrors over the
# docroot. Anything the server owns — .env, storage, vendor, node_modules — is
# absent from the zip on purpose rather than kept by the installer as an
# afterthought: what is not in the archive cannot overwrite anything.
#
# Built here and not on the host because the host has neither node nor a
# composer that can resolve a lock file inside a memory limit. vendor/ is
# normally the one exception — server-owned, installed there by composer — and
# `--with-vendor` overrides that for a host where composer cannot run at all,
# which is the case on a shared account with proc_open disabled.
#
# The vendor tree is built fresh into a scratch directory rather than copied
# from this checkout: a working tree installed --prefer-source carries a .git
# inside every package, which here came to 4.1 GB against 128 MB for the same
# packages installed --no-dev --prefer-dist.

set -eu

# --with-vendor ships the dependency tree inside the release. Off by default:
# vendor/ is server-owned, and a 30 MB upload for a one-line view change is a
# bad trade. On for a host that cannot run composer at all, or any release that
# moves composer.lock.
WITH_VENDOR=no
if [ "${1:-}" = "--with-vendor" ]; then
    WITH_VENDOR=yes
    shift
fi

OUT="${1:-$(pwd)/taajir-release-$(date +%Y%m%d-%H%M).zip}"
case "$OUT" in /*) ;; *) OUT="$(pwd)/$OUT" ;; esac

[ -f artisan ] || { echo "!! run this from the laravel/ directory" >&2; exit 1; }

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
APP="$STAGE/taajir-app"
DOC="$STAGE/public_html"
mkdir -p "$APP" "$DOC"

# The front-end first: a zip carrying stale hashed assets is worse than one
# carrying none, because the manifest and the files disagree and every page
# 404s its own CSS.
echo "→ assets"
npm run build >/dev/null

echo "→ application"
# Everything tracked by git, minus what the server owns and what only matters
# here. git archive rather than cp: it cannot pick up a stray .env, a local
# storage/ or an editor file, because it reads the index and nothing else.
git archive --format=tar HEAD -- . | tar -x -C "$APP"

# public/ is not part of the app tree on this host — its contents are the
# docroot. Move it rather than copy, so nothing ships twice.
if [ -d "$APP/public" ]; then
    (cd "$APP/public" && tar -cf - .) | (cd "$DOC" && tar -xf -)
    rm -rf "$APP/public"
fi

# Built assets are not tracked, so they are added after the archive.
mkdir -p "$DOC/build"
(cd public/build && tar -cf - .) | (cd "$DOC/build" && tar -xf -)

# The deploy scripts belong beside the docroot, where the browser can reach
# them; index.php is already there from public/ and the installers keep it.
echo "→ deploy scripts"
cp deploy/public_html/*.php "$DOC/"

# Not the app's business on the host: the tests and the tooling config are
# harmless but they are weight on every upload, and deploy/public_html is now
# duplicated in the docroot.
rm -rf "$APP/tests" "$APP/deploy/public_html" "$APP/node_modules" "$APP/.github"

if [ "$WITH_VENDOR" = yes ]; then
    echo "→ vendor (production, fresh)"
    VEND="$STAGE/.composer-build"
    mkdir -p "$VEND"
    cp composer.json composer.lock "$VEND/"
    ( cd "$VEND" && composer install --no-dev --prefer-dist --optimize-autoloader \
        --no-scripts --no-interaction --quiet )
    # Packages resolved from source bring a full .git each; nothing on the
    # server reads them and they dwarf the code.
    find "$VEND/vendor" -name .git -type d -prune -exec rm -rf {} + 2>/dev/null || true
    mv "$VEND/vendor" "$APP/vendor"
    rm -rf "$VEND"
    echo "  $(du -sh "$APP/vendor" | cut -f1)"
fi

echo "→ zip"
rm -f "$OUT"
(cd "$STAGE" && zip -qr "$OUT" taajir-app public_html)

echo
echo "✓ $OUT"
echo "  $(du -h "$OUT" | cut -f1), $(cd "$STAGE" && find . -type f | wc -l | tr -d ' ') files"
echo
echo "  Built from $(git rev-parse --short HEAD) on $(git rev-parse --abbrev-ref HEAD)."
if [ "$WITH_VENDOR" = yes ]; then
    echo "  Includes vendor/ — the installer replaces the server's copy."
    echo "  Delete taajir-app/bootstrap/cache/*.php afterwards if anything fails to boot:"
    echo "  the package manifest can still name a dev provider this tree does not have."
else
    echo "  No vendor/. If composer.lock changed since the last release, run"
    echo "  'composer install --no-dev --optimize-autoloader' on the server,"
    echo "  or rebuild with --with-vendor where composer cannot run."
fi
