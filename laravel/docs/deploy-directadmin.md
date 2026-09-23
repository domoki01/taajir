# Deploying on DirectAdmin

§12 of the port roadmap assumed cPanel. The account is DirectAdmin, which is the
same shape with different menus: a fixed `public_html`, a PHP selector, a MySQL
wizard and a cron form. Nothing about the port changes; the paths do.

## Before anything: the certificate

**Get Let's Encrypt working on the domain before you put a site behind it.**

The Next app has been serving

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

for as long as it has been live. Every browser that has opened taajirdz.com over
HTTPS has pinned that for **two years**. For those visitors HSTS is not a
warning they can dismiss — the browser refuses plain HTTP, and on a certificate
that does not match the domain it shows a hard error with no "proceed anyway".
A returning visitor cannot reach the site at all until the new host serves a
valid certificate for taajirdz.com.

In DirectAdmin: **Account Manager → SSL Certificates → Free & automatic
certificate from Let's Encrypt**, with both `taajirdz.com` and `www.taajirdz.com`
ticked, then **Force SSL with https redirect**.

`preload` is the other half. It declares the domain _eligible_ for the browsers'
built-in preload list; if it was ever actually submitted at hstspreload.org then
every Chrome and Firefox carries the pin whether or not that user has visited,
and removal takes months. Check whether the domain is on the list before
assuming a cert on the new host is enough.

## Layout

The application tree lives above the document root; only Laravel's `public/`
goes inside it.

```
/home/USER/
├── taajir-app/                     ← the whole app except public/
│   ├── app/ bootstrap/ config/ database/ lang/ resources/ routes/
│   ├── storage/ vendor/
│   ├── .env                        ← APP_KEY, DB password. Never reachable by URL.
│   └── artisan composer.json composer.lock
└── domains/taajirdz.com/public_html/
    ├── index.php                   ← from deploy/public_html/, APP_BASE edited
    ├── .htaccess                   ← Laravel's own
    ├── build/                      ← the Vite output, including the Cairo fonts
    └── favicon.ico robots.txt
```

`.env` inside `public_html` is the mistake this layout exists to prevent. A
`.env` under a document root is one request away from handing over the database
and, once the affiliate programme lands, the key that decrypts payout
destinations.

## Steps

1. **PHP 8.3 or newer.** DirectAdmin → _Account Manager → Domain Setup →
   taajirdz.com → PHP Version_. Laravel 13 needs 8.3+; this was built on 8.4.
   Required extensions: `mbstring`, `intl`, `pdo_mysql`, `gd`, `zip`, `fileinfo`.
   `intl` is not optional — `App\Support\Text` uses `Normalizer` for the Arabic
   fold, and without it search stops matching.

2. **Database.** _Account Manager → MySQL Management → Create new database_.
   Keep the name and user DirectAdmin generates (`USER_taajir`); put them in
   `.env`.

3. **Upload.** Everything except `public/` into `~/taajir-app`; the contents of
   `public/` into `public_html`. `vendor/` is not in the repository — either run
   `composer install --no-dev --optimize-autoloader` over SSH, or upload a
   `vendor/` you built locally with the same PHP version.

4. **Front controller.** Copy `deploy/public_html/index.php` over the one from
   `public/` and set `APP_BASE` to `/home/USER/taajir-app`.

5. **Environment.**

    ```
    cp .env.example .env
    php artisan key:generate
    ```

    Then set `APP_ENV=production`, `APP_DEBUG=false`,
    `APP_URL=https://taajirdz.com`, and the database credentials from step 2.
    `APP_KEY` is load-bearing twice over — sessions and, later, the encrypted
    payout fields. Generate it once, back it up, never rotate it casually.

6. **Schema and geography.**

    ```
    php artisan migrate --force --seed
    ```

    The seed is the 69 wilayas and their 1541 communes. Nothing resolves a URL
    without them.

7. **Caches.**

    ```
    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
    ```

    Run these again after every deploy. A stale `config:cache` is the classic
    "why is it still using the old database" hour.

8. **Uploaded images.** `php artisan storage:link` writes its symlink into
   `public/storage`, which does not exist in this layout. Link it by hand:

    ```
    ln -s /home/USER/taajir-app/storage/app/public /home/USER/domains/taajirdz.com/public_html/storage
    ```

9. **Cron.** DirectAdmin → _Advanced Features → Cron Jobs_, every minute:

    ```
    * * * * * cd /home/USER/taajir-app && php artisan schedule:run >/dev/null 2>&1
    ```

    That one line drives everything in `routes/console.php`:

    | | |
    | --- | --- |
    | `taajir:launch --if-due` | hourly — opens the site only if an admin both held it and set a countdown that has elapsed, and even then publishes only the ads a moderator approved |
    | `taajir:expire-listings` | nightly at 03:20 — takes down ads past 60 days and frees their owners' quota |
    | `queue:work --stop-when-empty` | every five minutes — drains the queue and exits, rather than holding a PHP process open on a host with nowhere to keep a daemon |

    A host where each job needs its own cron form is a host where one of them is
    eventually forgotten, which is why they all hang off this single entry.

10. **Permissions.** `storage/` and `bootstrap/cache/` must be writable by the
    PHP user. `chmod -R 775` on both, and nothing wider.

## Every page is a 500 until the installer has run

`.env` ships with an empty `APP_KEY`, and Laravel refuses to serve anything
without one — so opening the site before running `setup.php` gives a bare
"Server Error" on every URL. That is expected, not a broken upload.

`health.php` says which of the usual causes it is: PHP version, missing
extensions, unwritable directories, an empty `APP_KEY`, bad database
credentials, a stale `bootstrap/cache/config.php`, and the last error from the
log. It is guarded by `SETUP_TOKEN` like the installer, and should be deleted
once the site is up.

Turning `APP_DEBUG=true` to find this out is the wrong trade: it publishes the
database password, the whole environment and a stack trace on a public URL for
as long as it takes someone to remember it is still on.

## Still missing

- **The security headers.** Roadmap §12 wants CSP, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy` and HSTS re-added as middleware. They
  are not written yet. Do not send HSTS from the new host until the certificate
  is confirmed working — it is what makes a bad certificate unrecoverable for
  two years rather than a page reload.
- **Anything behind a login.** The port is at phase 2. There is no
  authentication, no listings, no publish wizard and no admin panel; see the
  progress list in the README.
