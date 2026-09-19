# Pushing to DirectAdmin with Git

Two routes. DirectAdmin's own Git panel is the quick one; a bare repository with
a hook is the one that actually fits this project, because the deployed tree is
split in two (`docs/deploy-directadmin.md`) and a plain checkout does not
produce that shape.

## First, the three things that catch everyone

Read these before choosing a route. They are the reason a git-push deploy
"works" and then serves a broken site.

1. **`public/build` is not in git.** `.gitignore` excludes it, so a push carries
   no compiled CSS, no JavaScript and none of the self-hosted Cairo. The site
   renders as unstyled HTML. Assets change rarely once a design settles, so the
   simplest answer is to build locally and upload `public/build` when it
   changes:

    ```bash
    npm run build
    rsync -avz public/build/ USER@HOST:~/domains/taajirdz.com/public_html/build/
    ```

    If the host has Node, `npm ci && npm run build` can go in the hook instead.
    Most shared DirectAdmin accounts do not.

2. **`vendor/` is not in git either.** The hook runs
   `composer install --no-dev`, which needs Composer on the server. If it is not
   on `PATH`, download `composer.phar` into `$HOME` once and set `COMPOSER_BIN`
   in the hook.

3. **`index.php` in the document root is not the one in git.** The deployed
   front controller is `deploy/public_html/index.php`, with `APP_BASE` pointing
   above the docroot. The hook excludes `index.php` from the sync for exactly
   this reason — otherwise every deploy would overwrite it with the version that
   expects `vendor/` one directory up, and every page would 500.

## Route A — a bare repository and a hook

Works on any account with SSH, and it is what `deploy/post-receive` is written
for.

**On the server, once:**

```bash
ssh -p PORT USER@HOST

mkdir -p ~/repos && cd ~/repos
git init --bare taajir.git

mkdir -p ~/taajir-app
```

Install the hook:

```bash
cp /path/to/deploy/post-receive ~/repos/taajir.git/hooks/post-receive
chmod +x ~/repos/taajir.git/hooks/post-receive
```

…then edit the four settings at the top of it: `APP`, `DOCROOT`, `BRANCH`, and
the `PHP`/`COMPOSER` binaries if they are not on `PATH`.

Do the first-run setup by hand, because the hook assumes it:

```bash
cd ~/taajir-app
# .env is never pushed — it holds APP_KEY and the database password.
cp .env.example .env   # after the first deploy has put the file there
php artisan key:generate
php artisan migrate --seed
ln -s ~/taajir-app/storage/app/public ~/domains/taajirdz.com/public_html/storage
chmod -R 775 storage bootstrap/cache
```

**On your machine:**

```bash
git remote add production ssh://USER@HOST:PORT/home/USER/repos/taajir.git
git push production main
```

The hook's output comes back over the push, so a failure is visible immediately
rather than the next time someone opens the site.

Add your public key under **Account Manager → SSH Keys** first, or every push
asks for a password. DirectAdmin usually runs SSH on a non-standard port — the
panel shows which.

## Route B — DirectAdmin's Git panel

**Advanced Features → Git** in recent DirectAdmin versions. It creates a
repository, shows you a clone URL, and can pull on a webhook.

It is fine for a project whose repository root _is_ the document root. This one
is not: the repository root is the Next app, the Laravel app is in `laravel/`,
and the deployed tree splits `public/` away from everything else. The panel has
no way to express that, so you would end up with the whole repository — `.env`,
`vendor/`, the Next source — served at `https://taajirdz.com/`. Route A, or a
`.htaccess` that denies everything except the front controller, and the first is
much easier to get right.

If the host has disabled SSH entirely, neither route is available and the deploy
is an upload. In that case build a release locally and send `laravel/` (minus
`node_modules`) over SFTP, which is what the zip in the session was for.

## Deploying the port before it is finished

Worth saying plainly: pushing this repository to the server today puts the
**phase 3** app there — the shell, the content pages, the browse routes, three
languages and sign-in. There are no listings, no publish wizard and no admin
panel yet, so the domain would serve a site people can sign into and not much
else. The roadmap's phase 9 stages this on a subdomain first for that reason.
