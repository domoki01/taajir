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

Do the first-run setup by hand, because the hook assumes it. `.env` is the only
part: everything else — the writable tree, the schema, the seeds, the image
link — the hook now does on every push.

```bash
cd ~/taajir-app
# .env is never pushed. It holds APP_KEY and the database password, and a hook
# that overwrote it would take the site down on a deploy that changed nothing.
cp .env.example .env     # after the first push has put the file there
php artisan key:generate
```

Then fill in the database credentials, the five `FIREBASE_*` values and a
`SETUP_TOKEN`. `docs/update.md` §3 lists them; `FIREBASE_PROJECT_ID` empty means
every sign-in fails, which is the intended direction for an empty value but not
a state to discover by hand.

### What the hook does

It lays the two halves of the tree where they belong, then hands everything
after that to `deploy/update.sh`:

| | |
| --- | --- |
| the writable tree | `storage/` and `bootstrap/cache` are server-owned and never in a push, so the hook creates the skeleton rather than assuming it — a missing `storage/framework/views` surfaces as "View path not found" from inside `view:clear` rather than as anything about a directory |
| `composer install --no-dev` | checked before it runs and after: Composer is often a `composer.phar` in `$HOME` rather than on `PATH`, and "command not found" partway through a deploy is a worse sentence than one naming it |
| caches cleared, **then** migrate | a `config.php` written by the previous version is read on boot, so migrating before clearing runs against the old configuration |
| `migrate --force` | every migration in this project creates; none drops, which is what makes unattended `--force` safe here |
| `db:seed --force` | idempotent by construction, and how a new wilaya or a new permission arrives without anyone remembering |
| the image link | `artisan storage:link` cannot make it — it writes into `public/storage`, and in this layout `public/` is not the document root |
| caches rebuilt | a live site should not read config off disk on every request |

The same script runs from SFTP (`sh ~/taajir-app/deploy/update.sh`) and, for an
account with no SSH at all, from `public_html/update.php` in a browser. One
script, so the three paths cannot drift into three different deploys.

`index.php` in the document root is copied only when it is **missing**.
Overwriting a working front controller on every push is how a hand-tuned
`TAAJIR_APP_BASE` gets lost. `update.php` and `health.php` are refreshed every
time, because those two should track the code.

If the account has no `rsync`, the hook falls back to `tar` and says so: that
copies everything in the push but cannot delete a file the push removed, and a
stale controller that still routes is a confusing bug to leave unannounced.

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
