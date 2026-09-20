# Porting تأجير to PHP / Laravel — implementation roadmap

Rebuild the site as a Laravel application: same URLs, same screens, same rules,
with **MySQL** as the database and **Firebase used for one thing only — signing
in**. This document is the specification for that rebuild. It is written in
English because it is an implementation brief full of identifiers and schema;
every user-facing string it quotes stays in Arabic exactly as it is today.

Read `CLAUDE.md` first. Its rules — Arabic copy, logical RTL utilities, prices
in whole dinars, 69 wilayas keyed by slug, the two-colour palette — are product
decisions, not Next.js decisions. They survive the port unchanged.

---

## 0. Why this port, and what it costs

The honest summary, because it changes what you should build first.

**What you gain.** PHP runs on the cPanel account you already pay for, with no
Passenger app to keep alive, no 40 MB bundle to re-upload, no Node version to
chase. MySQL gives you `WHERE price BETWEEN ? AND ?`, `ORDER BY`, `JOIN` and
`COUNT` — every one of which Firestore refused, and each refusal is a piece of
complexity in the current code that simply disappears (see §4.3).

**What it costs.** Firestore's security rules and the Admin SDK are today's
authorisation layer; in Laravel that becomes policy classes you write and must
test. Next.js ISR caches rendered pages for free; Laravel needs explicit
caching (§9). And the existing data has to be moved (§10) — the site is live,
so that is a one-shot migration with a freeze window, not a background job.

**Hybrid auth is the interesting choice.** Keeping Firebase for login means
sign-in by Google and by phone keeps working, the 35 phone-only accounts keep
their door, and you write no password reset, no SMS provider integration, no
OAuth dance. The price is one server-side dependency: verifying a Firebase ID
token on every login (§5). That is a good trade — but it also means Firebase
Auth is still a hard runtime dependency of the site, so "moving off Firebase"
is not what this port does.

---

## 1. Target stack

| Concern   | Choice                                                                      | Note                                                       |
| --------- | --------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Framework | Laravel (whatever `composer create-project laravel/laravel` installs today) | PHP 8.2+                                                   |
| Views     | Blade + **Livewire 3**                                                      | Livewire only for the genuinely interactive screens (§7.3) |
| Sprinkles | Alpine.js (ships with Livewire)                                             | dropdowns, sheets, carousels                               |
| CSS       | **Tailwind CSS v4** — same tokens, same `@theme` block                      | copy `src/app/globals.css` almost verbatim                 |
| Database  | MySQL 8 / MariaDB 10.6+                                                     | InnoDB, `utf8mb4_unicode_ci`                               |
| Auth      | Firebase Auth (browser) → ID token → verified server-side → Laravel session | §5                                                         |
| Images    | Local disk (`storage/app/public`), thumbnails at upload                     | Intervention Image                                         |
| Icons     | Lucide (static SVG via Blade components)                                    | same icon set as today                                     |
| Font      | Cairo, self-hosted                                                          | today it comes from `next/font`                            |
| Queue     | `database` driver, drained by a cPanel cron                                 | shared hosting has no daemon                               |

Do **not** pull in a starter kit (Breeze, Jetstream). They install a password
auth flow this project does not have and will not use.

---

## 2. Route map

The URL scheme is the contract with Google and with every WhatsApp message ever
sent. **Every path below must survive the port byte-for-byte.** Latin,
French-derived segments; Arabic never appears in a URL (`CLAUDE.md`).

### 2.1 Public

| URL                                                       | Today                                    | Laravel route → controller                                                  | Notes                                                                                                                                                                  |
| --------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                       | `app/page.tsx`                           | `GET /` → `HomeController@index`                                            | featured + latest + promo carousel + wilaya tiles                                                                                                                      |
| `/{transaction}/{type?}/{wilaya?}/{commune?}`             | `app/[transaction]/[[...rest]]/page.tsx` | `GET /{transaction}/{rest?}` (`where rest = .*`) → `BrowseController@index` | the SEO catch-all: `/vente/appartement/alger/bab-ezzouar`. Resolve segments in order against the live taxonomy, then wilaya, then commune; anything unresolvable → 404 |
| `/recherche`                                              | `app/recherche/page.tsx`                 | `GET /recherche` → `SearchController@index`                                 | same filters as query params: `transaction`, `type`, `wilaya`, `commune`, `rooms`, `priceMin`, `priceMax`, `q`, `sort`                                                 |
| `/annonce/{id}/{slug}`                                    | `app/annonce/[id]/[slug]/page.tsx`       | `GET /annonce/{listing}/{slug}` → `ListingController@show`                  | slug mismatch → 301 to the canonical slug                                                                                                                              |
| `/demandes`                                               | `app/demandes/page.tsx`                  | `GET /demandes` → `RequestController@index`                                 |                                                                                                                                                                        |
| `/demandes/nouvelle`                                      |                                          | `GET/POST /demandes/nouvelle` → `RequestController@create/@store`           | auth required                                                                                                                                                          |
| `/demandes/{id}`                                          |                                          | `GET /demandes/{request}` → `RequestController@show`                        | thread + replies                                                                                                                                                       |
| `/articles`, `/articles/{slug}`                           |                                          | `ArticleController@index/@show`                                             | cache 1 h (today `revalidate = 3600`)                                                                                                                                  |
| `/publier`                                                | `app/publier/page.tsx`                   | `GET/POST /publier` → `PublishController`                                   | the wizard; auth + quota + approval gate                                                                                                                               |
| `/merci`                                                  |                                          | `GET /merci` → `PublishController@thanks`                                   | post-publish screen, branches on `PostState`                                                                                                                           |
| `/concours`                                               |                                          | `GET /concours` → `ContestController@index`                                 | leaderboard + missions                                                                                                                                                 |
| `/bienvenue`                                              |                                          | `GET /bienvenue` → `OnboardingController`                                   | first-run                                                                                                                                                              |
| `/lancement`                                              |                                          | `GET /lancement` → `LaunchController@show`                                  | pre-launch landing                                                                                                                                                     |
| `/a-propos` `/aide` `/cgu` `/confidentialite` `/securite` | `app/(static)/…`                         | one `StaticPageController` + five Blade views                               | pure content                                                                                                                                                           |
| `/connexion`, `/inscription`                              | `app/(auth)/…`                           | `GET /connexion`, `/inscription` → `AuthController`                         | Firebase JS widget lives here                                                                                                                                          |
| `/diagnostic`                                             |                                          | `GET /diagnostic` → `DiagnosticController`                                  | keep it; it is how auth failures get diagnosed                                                                                                                         |

### 2.2 Dashboard (auth required)

| URL                                       | Controller                                                            |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `/tableau-de-bord`                        | `Dashboard\HomeController@index`                                      |
| `/tableau-de-bord/annonces`               | `Dashboard\ListingController@index`                                   |
| `/tableau-de-bord/annonces/{id}/modifier` | `Dashboard\ListingController@edit/@update`                            |
| `/tableau-de-bord/publications`           | `Dashboard\PostController@index` (requests + comments the user wrote) |
| `/tableau-de-bord/alertes`                | `Dashboard\SavedSearchController`                                     |
| `/tableau-de-bord/parrainage`             | `Dashboard\ReferralController`                                        |
| `/tableau-de-bord/profil`                 | `Dashboard\ProfileController`                                         |

### 2.3 Admin (permission-gated, §6)

`/admin` plus `moderation`, `commentaires`, `utilisateurs`, `roles`, `filtre`,
`identite`, `publicites`, `articles`, `affiliation`, `lancement`,
`notifications`, `journal` — one controller each under `App\Http\Controllers\Admin`,
each guarded by the matching permission from §6.2.

### 2.4 Endpoints and machine routes

| URL                                    | Today                                                                | Laravel                                                                         |
| -------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `POST /api/auth/session`               | exchanges a Firebase ID token for a session cookie                   | `POST /auth/session` → `SessionController@store` (§5)                           |
| `DELETE /api/auth/session`             | sign-out                                                             | `DELETE /auth/session`                                                          |
| `GET /api/launch-state`                | polls the launch gate                                                | `GET /api/launch-state`                                                         |
| `GET /api/cron/launch`                 | bearer-token cron that opens the site                                | `GET /api/cron/launch`, same `CRON_SECRET` bearer check                         |
| `GET /r/{code}`                        | referral link: sets a 90-day cookie, redirects                       | `ReferralController@catch` — code is 6 chars of `23456789BCDFGHJKLMNPQRSTVWXYZ` |
| `GET /s/{code}`                        | short link: resolves to a listing/request path, carries the referral | `ShortLinkController@resolve` — 7 chars, same alphabet                          |
| `/sitemap.xml`                         | dynamic                                                              | `SitemapController` — cache 1 h                                                 |
| `/robots.txt`, `/manifest.webmanifest` |                                                                      | static or controller                                                            |

The two redirect rules in `next.config.ts` (old App Hosting hostname →
`taajirdz.com`) are **not** needed: on cPanel that hostname never reaches you.
The security headers, however, are (§12).

---

## 3. What each Server Action becomes

Today 18 files under `src/server/actions/` hold every write. In Laravel each
becomes a controller action plus a FormRequest, and the business rule inside it
moves to a service class under `app/Services`. Nothing about _what_ they do
changes.

| Action file                               | Laravel home                                          | The rule that must not be lost                                                                                                               |
| ----------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `listings.ts` → `createListing`           | `PublishController@store` + `ListingService::create`  | quota check and insert in **one transaction** (§4.4); policy verdict decides `published` / `pending`; `pendingLaunch` while the site is held |
| `moderation.ts`                           | `Admin\ModerationController`                          | approve / reject / feature / edit / delete / mark closed; every one writes an audit row                                                      |
| `comments.ts`, `articles.ts` (comments)   | `CommentController`                                   | rate limit 8/60 s; author or moderator may delete; hide keeps the row                                                                        |
| `requests.ts`                             | `RequestController`                                   | max 5 open requests; 4 per 300 s; replies may attach one of the author's own listings                                                        |
| `savedSearches.ts`                        | `Dashboard\SavedSearchController`                     | max 10 per user                                                                                                                              |
| `profile.ts`                              | `Dashboard\ProfileController`                         | display name propagates to `listings.owner_name`                                                                                             |
| `users.ts`                                | `Admin\UserController`                                | role, ban (+ referral clawback), quota, approve, global approval switch                                                                      |
| `roles.ts`                                | `Admin\RoleController`                                | `admin` always holds every permission; role ids match `^[a-z][a-z0-9-]{1,23}$`                                                               |
| `filterSettings.ts`                       | `Admin\TaxonomyController`                            | hide/reorder/rename deals and property types, add custom ones with their own price unit                                                      |
| `branding.ts`                             | `Admin\BrandingController`                            | six editable colours only (§7.1)                                                                                                             |
| `promos.ts`                               | `Admin\PromoController`                               | ordered carousel, active flag                                                                                                                |
| `launch.ts`, `broadcast.ts`, `devices.ts` | `Admin\LaunchController`, `Admin\BroadcastController` | launch state machine, outbox-first notification fan-out                                                                                      |
| `affiliate.ts`                            | `Affiliate\*` + `AffiliateService`                    | the whole points programme (§4.5) — the most intricate part of the port                                                                      |

---

## 4. Database

### 4.1 Conventions

- InnoDB, `utf8mb4_unicode_ci`.
- **Primary keys**: keep the existing string ids (`CHAR(12)`/`CHAR(28)`) rather
  than renumbering. `listings.id` is in live URLs and `users.uid` is the Firebase
  uid, which is the join between the two systems forever.
- **Timestamps**: the current code stores epoch milliseconds (`number`).
  Store `DATETIME` in MySQL and convert once during migration. Do not carry
  milliseconds forward — you lose sorting in SQL clients for nothing.
- **Money**: `price` is `BIGINT UNSIGNED`, **whole dinars, always**. The
  `مليون` → dinar conversion (×10 000) lives in one PHP helper, mirroring
  `src/lib/price.ts`, and nowhere else. Getting this wrong is a 10 000× error.

### 4.2 Tables

```
users
  uid              CHAR(28) PK          -- Firebase uid
  email            VARCHAR(255) NULL UNIQUE
  display_name     VARCHAR(80)
  photo_url        VARCHAR(500) NULL
  phone            VARCHAR(20) NULL
  role_id          VARCHAR(24) FK roles.id   -- 'user' default
  approved         TINYINT(1) DEFAULT 1
  agency_id        CHAR(20) NULL
  wilaya_code      SMALLINT NULL
  active_listing_count INT DEFAULT 0
  listing_quota    INT DEFAULT 3        -- kFreeListingQuota
  featured_quota   INT DEFAULT 0
  is_banned        TINYINT(1) DEFAULT 0
  ban_reason       VARCHAR(255) NULL
  strike_count     INT DEFAULT 0
  notify_on_message        TINYINT(1) DEFAULT 1
  notify_on_saved_search   TINYINT(1) DEFAULT 1
  locale           VARCHAR(5) DEFAULT 'ar'
  points_balance   INT DEFAULT 0        -- cache; points_ledger is the truth
  referred_by      CHAR(28) NULL
  referral_code    CHAR(6) UNIQUE
  created_at, last_seen_at DATETIME
  INDEX (role_id), INDEX (is_banned), INDEX (referred_by)

listings
  id               CHAR(12) PK
  slug             VARCHAR(160)
  owner_uid        CHAR(28) FK users.uid
  owner_type       ENUM('individual','agency')
  agency_id        CHAR(20) NULL
  owner_name       VARCHAR(80)          -- denormalised, refreshed on profile save
  owner_is_verified TINYINT(1) DEFAULT 0
  transaction_type VARCHAR(32)          -- slug, admin-extensible → not an ENUM
  sale_form        VARCHAR(24) NULL
  property_type    VARCHAR(32)
  housing_program  VARCHAR(16) NULL
  price            BIGINT UNSIGNED      -- whole dinars
  price_unit       VARCHAR(8)           -- total|mois|annee|nuit|m2
  price_on_request TINYINT(1)
  is_negotiable    TINYINT(1)
  area_built       INT NULL
  area_land        INT NULL
  rooms_code       VARCHAR(4) NULL      -- F1…F7+
  bathrooms        TINYINT NULL
  floor            SMALLINT NULL
  condition_code   VARCHAR(16) NULL
  paperwork        VARCHAR(32) NULL
  wilaya_code      SMALLINT
  wilaya_slug      VARCHAR(48)
  commune_slug     VARCHAR(64)
  quartier         VARCHAR(80) NULL
  lat, lng         DECIMAL(9,6) NULL
  title            VARCHAR(90)
  description      TEXT
  cover_url        VARCHAR(500) NULL
  search_text      TEXT                 -- normalised title+place, FULLTEXT (§8)
  contact_phone    VARCHAR(20) NULL
  show_phone       TINYINT(1) DEFAULT 1
  allow_whatsapp   TINYINT(1) DEFAULT 1
  status           VARCHAR(16)          -- draft|pending|pendingLaunch|published|rejected|expired|sold|rented|archived
  rejection_reason VARCHAR(255) NULL
  policy_rule      VARCHAR(64) NULL
  approved_for_launch TINYINT(1) DEFAULT 0
  is_featured      TINYINT(1) DEFAULT 0
  pinned_until     DATETIME NULL
  view_count       INT DEFAULT 0
  created_at, published_at DATETIME
  INDEX (status, published_at DESC)
  INDEX (status, transaction_type, wilaya_slug, published_at DESC)
  INDEX (status, transaction_type, property_type, wilaya_slug, commune_slug, published_at DESC)
  INDEX (status, price), INDEX (owner_uid, status)
  FULLTEXT (search_text)

listing_images          id, listing_id FK, url, width, height, position
listing_amenities       listing_id FK, amenity VARCHAR(24), PK(listing_id, amenity)

comments                id, listing_id FK, author_uid, author_name, author_photo_url,
                        is_owner, text VARCHAR(1000), status ENUM('visible','hidden'),
                        hidden_reason, created_at, edited_at
                        INDEX (listing_id, created_at)

requests                id, owner_uid, owner_name, owner_photo_url, intent ENUM('vente','location'),
                        title, description, wilaya_slug, commune_slug NULL,
                        status ENUM('visible','hidden','pending','rejected','pendingLaunch'),
                        hidden_reason, rejection_reason, policy_rule,
                        moderated_by, moderated_at, reply_count, created_at
                        INDEX (status, created_at), INDEX (owner_uid)

request_replies         id, request_id FK, author_uid, author_name, author_photo_url,
                        is_owner, text, listing_id NULL, status, hidden_reason, created_at

saved_searches          id, owner_uid FK, transaction_type NULL, property_type NULL,
                        wilaya_slug, commune_slug NULL, label, notify TINYINT(1),
                        created_at, last_notified_at, match_count

articles                id, slug UNIQUE, title, excerpt, body JSON,   -- blocks, never HTML
                        cover_url, cover_alt, author_uid, author_name,
                        status ENUM('draft','published'), tags JSON,
                        read_minutes, published_at, created_at, updated_at, comment_count
article_comments        id, article_id FK, author_uid, author_name, author_photo_url,
                        text, status, hidden_reason, created_at

promos                  id, image_url, storage_path, width, height, link_url, title,
                        is_active, position, created_at, updated_at

roles                   id VARCHAR(24) PK, label, builtin TINYINT(1)
role_permissions        role_id FK, permission VARCHAR(32), PK(role_id, permission)

settings                key VARCHAR(32) PK, value JSON, updated_at, updated_by
                        -- one row each: access, affiliate, branding, filter, launch
                        -- (today: the `settings/*` documents)

devices                 id, uid FK, token VARCHAR(255) UNIQUE, created_at   -- FCM, only if §11 keeps push
admin_audit             id, actor_uid, action, target_type, target_id, detail JSON, created_at
rate_limits             id VARCHAR(64) PK, hits INT, window_started_at DATETIME
short_links             code CHAR(7) PK, path VARCHAR(255), ref CHAR(6) NULL, created_at
launch_outbox           id, uid, channel ENUM('push','email','sms'), target,
                        status ENUM('queued','sent','failed','skipped'), error, created_at, sent_at

-- affiliate programme
points_ledger           id, uid FK, delta INT, reason VARCHAR(20), ref_uid NULL,
                        campaign_id NULL, note, created_at
                        INDEX (uid, created_at)
payouts                 id, uid, owner_name, channel, points, amount_dzd NULL,
                        destination_encrypted VARBINARY(512) NULL,   -- §6.3
                        status, note, requested_at, settled_at, settled_by
campaigns               id, name, prize, starts_at, ends_at, prize_threshold,
                        winners, status, created_at, created_by
campaign_prizes         id, campaign_id FK, kind, label, detail, image_url,
                        storage_path, stock, claimed
campaign_links          id, campaign_id FK, label, url, points, dwell_seconds, answer, active
campaign_entrants       campaign_id, uid, display_name, points, referrals, prize_id NULL,
                        joined_at, last_point_at, unlocked_at, claimed_at, disqualified
                        PK(campaign_id, uid), INDEX (campaign_id, points DESC, last_point_at)
link_visits             uid, link_id, started_at, claimed_at, points, tries
                        PK(uid, link_id)          -- the "paid once" guarantee, as a key
prize_claims            id, campaign_id, campaign_name, uid, owner_name, prize_id,
                        prize_label, destination_encrypted, points, status, note,
                        requested_at, settled_at, settled_by

-- geography, seeded once from src/data/geo/
wilayas                 code SMALLINT PK, code58 SMALLINT, name_ar, name_fr,
                        slug VARCHAR(48) UNIQUE, aliases JSON, is_new_2026, commune_count
communes                id, wilaya_code FK, slug VARCHAR(64), name_ar, name_fr,
                        postal_code, lat, lng
                        UNIQUE (wilaya_code, slug), INDEX (slug)
```

### 4.3 Fields you can delete, and why

Three denormalised fields exist purely because Firestore cannot do ranges and
text. **SQL can. Drop them.**

| Firestore field                          | Replacement                                                 |
| ---------------------------------------- | ----------------------------------------------------------- |
| `priceBucket` (`s_0`…`s_8`, `r_0`…`r_7`) | `WHERE price BETWEEN ? AND ?`                               |
| `areaBucket`                             | `WHERE area_built BETWEEN ? AND ?`                          |
| `searchTokens` (array of ≥3-char tokens) | `FULLTEXT (search_text)` over the same normalised text (§8) |

Delete `src/lib/price.ts`'s bucket half in the port and keep only the
conversion and formatting. This is the single biggest simplification the move
to SQL buys — the bucket code exists to work around a limitation you no longer
have, and keeping it would mean maintaining a fiction.

### 4.4 The rule that must stay transactional

```php
DB::transaction(function () use ($user, $input) {
    $u = User::where('uid', $user->uid)->lockForUpdate()->first();
    abort_if($u->is_banned, 403);
    abort_if($settings->require_approval && ! $u->approved, 403);
    abort_if($u->active_listing_count >= $u->listing_quota, 403, 'QUOTA');
    Listing::create([...]);
    $u->increment('active_listing_count');
});
```

`lockForUpdate()` is what replaces Firestore's optimistic transaction. Without
it two simultaneous submissions both read the same count and both pass a check
only one should — which is exactly the bug the current code's comment warns
about.

### 4.5 The affiliate rules worth restating

They are easy to lose in a port, and each exists because of a specific attack:

- A point is granted when an **invited account publishes and is approved** — not
  when it signs up. Signups are free to manufacture; a published, moderated ad
  is not.
- `points_ledger` is the truth; `users.points_balance` is a cache. Every grant
  and spend writes a row with a reason. This is what makes a clawback on ban
  possible and a dispute answerable.
- `link_visits` has `PRIMARY KEY (uid, link_id)`. One account is paid for one
  link exactly once, enforced by the key rather than by a check.
- Mission dwell time is measured between two **server** timestamps.
- Caps: `dailyQualifyCap`, `dailyPublishCap`, `dailyLinkPoints`, and a
  10-per-300 s rate limit on mission claims.
- Cash channels (`redotpay`, `ccp`) ship **off**. Leave them off.

---

## 5. Authentication — Firebase in the browser, sessions in Laravel

The flow, unchanged in shape from today:

1. The sign-in page loads the **Firebase JS SDK** and runs the existing
   providers: Google popup, and phone (SMS + reCAPTCHA Enterprise). Keep
   `NEXT_PUBLIC_PHONE_SIGNUP`'s behaviour as a config flag: signing _up_ by
   phone is currently off, signing _in_ by phone is never hidden — 35 accounts
   have no email and no password and their door has to keep working.
2. The browser gets a Firebase **ID token** and POSTs it to `/auth/session`.
3. Laravel verifies it server-side, then creates its **own** session. From that
   point on, every request is authenticated by Laravel's session cookie; the
   Firebase token is never checked again on a page load.

Verification, two options:

- **Lean** — `firebase/php-jwt`: fetch Google's public certs from
  `https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`,
  cache them for their `max-age`, verify RS256 + `aud` = project id + `iss` =
  `https://securetoken.google.com/<project>` + `exp`. ~60 lines, no service
  account needed.
- **Full** — `kreait/firebase-php`: `$auth->verifyIdToken($token)`, plus custom
  claims and user management if you ever need them. Needs the service-account
  JSON on the server.

Take the lean one. Verifying a login is all this application asks of Firebase,
and the service-account key is the credential you most want off a shared host.

```php
// SessionController@store
$claims = $this->verifier->verify($request->input('idToken'));   // throws → 401
$user = User::firstOrCreate(['uid' => $claims['sub']], [
    'email'        => $claims['email'] ?? null,
    'display_name' => $claims['name'] ?? 'مستخدم',
    'photo_url'    => $claims['picture'] ?? null,
    'phone'        => $claims['phone_number'] ?? null,
    'role_id'      => 'user',
    'listing_quota'=> config('taajir.free_quota'),
    'referral_code'=> ReferralCode::mint(),
    'referred_by'  => $this->referrerFromCookie($request),
]);
Auth::login($user, remember: true);
```

Three details the current code gets right and the port must keep:

- The **referral cookie** (`taajir_ref`, 90 days) is read at this exact moment
  and cleared once consumed — attribution happens at account creation, never later.
- Sign-in provider `password` is **rejected**: this site has no password accounts.
- `ensureUserDoc` is idempotent; `firstOrCreate` keeps that.

**Roles live in MySQL, not in Firebase custom claims.** Today they are claims
because Firestore rules needed them. Laravel reads `users.role_id` directly —
one less thing to keep in sync, and role changes take effect immediately instead
of on the user's next token refresh.

---

## 6. Authorisation

### 6.1 Shape

`firestore.rules` disappears. Its job splits in two: Laravel **policies**
(`ListingPolicy@update`, `CommentPolicy@delete`, …) for object-level rules, and
**gates** for the 14 admin permissions. There is no client that talks to the
database any more, which removes an entire class of rule by construction.

### 6.2 The permission list (port verbatim)

`listings.moderate`, `comments.moderate`, `requests.moderate`, `promos.manage`,
`users.manage`, `users.approve`, `roles.manage`, `taxonomy.edit`,
`branding.edit`, `launch.control`, `push.broadcast`, `affiliate.manage`,
`articles.manage`, `audit.view`.

Built-in roles: `admin` (everything, always — hard-code it, never read it from
the table), `moderator` (listings, comments, requests, promos, articles),
`agency`, `user`.

### 6.3 Encrypted fields

`FIELD_ENCRYPTION_KEY` protects the RIP / Binance / BaridiMob handle on payouts
and prize claims. In Laravel this is the `encrypted` cast on those two columns —
`APP_KEY` does the work, the column is `VARBINARY`. Same guarantee: a dump of
`payouts` without the key is a list of amounts.

---

## 7. The UI port

### 7.1 Design tokens

Copy the `@theme` block out of `src/app/globals.css` unchanged — Tailwind v4 is
CSS-first, so it works identically in a Laravel/Vite pipeline. That gives you
`bg-accent`, `text-dim`, `rounded-card`, `shadow-soft` with the same values.

Non-negotiable, straight from `CLAUDE.md`:

- `primary` (navy `#1e293b`) — structure and information: logo, headings, links,
  prices, badges, active borders, focus rings.
- `accent` (emerald `#059669`) — **filled action buttons only**. The 60/30/10
  ratio holds only while this is true; the first price that borrows emerald is
  the moment buttons stop reading as buttons.
- `success` stays lighter than `accent`; `whatsapp` is WhatsApp's own green, for
  the WhatsApp button alone; red is destructive/alerts, never areas.
- `muted` and `dim` are at or above 4.5:1 on white. Do not lighten them.

The admin branding editor may repaint **six** tokens only: `primary`,
`primaryStrong`, `primarySoft`, `accent`, `accentStrong`, `accentSoft`. It
renders as a `<style>` block of CSS variable overrides in the layout head —
exactly what `BrandingProvider` does today.

### 7.2 RTL

`<html dir="rtl" lang="ar">`. **Logical utilities only**: `ps-*`/`pe-*`,
`ms-*`/`me-*`, `start-*`/`end-*`, `text-start`/`text-end`. Physical `left`/
`right`/`pl-`/`pr-` are bugs waiting for a French locale. Latin-script runs
inside Arabic prose — prices, phone numbers, areas — carry `.ltr-nums`.

### 7.3 Components

63 React components today. Most are presentational and become plain Blade
components (`<x-listing.card>`, `<x-ui.empty-state>`, `<x-layout.bottom-nav>`).
These ones hold real client state and should be **Livewire**:

| Today                                                                                  | Why it needs state                                             |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `listing/PostForm` + `ui/Wizard`                                                       | multi-step publish wizard, image uploads, live validation      |
| `listing/EditForm`                                                                     | same, minus the wizard                                         |
| `requests/RequestWizard`, `RequestComposer`                                            | multi-step, attaches a listing                                 |
| `search/SearchFilters`                                                                 | live filtering; keep the URL in sync so results stay shareable |
| `listing/Comments`, `articles/ArticleThread`, `requests/RequestThread`                 | post without a full reload                                     |
| `admin/ModerationCard`, `RequestModerationCard`, `UserRow`, `CommentRow`               | inline approve/reject/ban                                      |
| `admin/FilterEditor`, `RolesEditor`, `BrandingEditor`, `ArticleEditor`, `PromoManager` | complex editors                                                |
| `affiliate/ContestBoard`, `RedeemPanel`, `InviteCard`                                  | live points, mission timers                                    |
| `launch/Countdown`, `NotifyOptIn`                                                      | ticking clock, opt-in                                          |
| `dashboard/AlertsManager`, `ProfileForm`                                               | inline edit                                                    |
| `home/PromoCarousel`                                                                   | Alpine alone is enough                                         |
| `auth/AuthForm`, `PhoneAuth`, `RecaptchaDoctor`                                        | **not** Livewire — plain JS against the Firebase SDK           |

`pwa/*` (install prompt, service worker registration) is plain JS plus a
`manifest.webmanifest`; keep the PWA, it is how people put the site on a home
screen.

### 7.4 Images

`next/image` goes away and nothing in PHP replaces it for free. Do the work at
upload instead: on submit, store the original and generate **three widths**
(400 / 800 / 1600) as WebP with Intervention Image, write all of them to
`listing_images`, and emit a plain `<img srcset>`. Shared hosting cannot afford
per-request transcoding — that was the same reason `NEXT_IMAGE_UNOPTIMIZED=true`
is set on the cPanel deployment today.

Uploads: max 20 images (`kMaxImages`), 6 MB each, `image/jpeg|png|webp` —
mirroring `storage.rules`. Path `storage/app/public/listings/{uid}/{listing}/`.

---

## 7.5 Languages

Added after phase 2, on request, and therefore not in the original plan. Worth
recording here because it changes the shape of every screen that follows.

The site speaks **Arabic, French and English**. Arabic is the default and takes
no URL prefix: every path in §2 is already Arabic and already indexed, and
moving them under `/ar` would break the contract this document opens with. The
two additions are the ones that take a prefix.

|         |                                                |
| ------- | ---------------------------------------------- |
| Arabic  | `/cgu`, `/vente/appartement/alger` — unchanged |
| French  | `/fr/cgu`, `/fr/vente/appartement/alger`       |
| English | `/en/cgu`, `/en/vente/appartement/alger`       |

- `/ar/...` 301s to the unprefixed path. One canonical URL per page per language.
- Every page emits `hreflang` for all three plus `x-default` → Arabic.
- `<html dir>` follows the locale. This costs nothing because the utilities were
  logical from the first commit — `CLAUDE.md` calls physical `left`/`right`
  "bugs waiting for a French locale", and this is that locale arriving.
- UI strings live in `lang/{locale}/`. A test asserts the three key sets are
  identical: Laravel falls back to the default locale silently, so a forgotten
  French string renders Arabic right-to-left inside a left-to-right paragraph
  and nothing reports it.
- The five content pages are **written** in each language, not assembled from
  keys — they are legal and safety prose, and a terms page built from forty keys
  is one nobody can read before publishing it.

Two rules that are not translation:

- **Prices.** Arabic and French both quote in ملايين; that is how the market
  speaks in both. English shows the plain dinar amount, because "800 million" is
  not a translation of "800 مليون" — it is a different number, and the unit is a
  million _centimes_ that an English reader has no reason to know. The storage
  rule is untouched: whole dinars, one helper, in every language.
- **Place names.** `wilayas.name_fr` serves English too; Algerian place names in
  English are the French forms. Only established exonyms are overridden, and so
  far that is Algiers alone.

User-written content — ad titles, descriptions, comments, requests — is never
translated and never machine-translated. It stays in the language it was
written in.

Still open: the admin branding editor (§7.1) sets one site name, and the mark is
"تأجير" in Arabic and "Taajir" in Latin script. Phase 7 has to decide whether
that field is per-locale.

---

## 8. Search

Today: an array of ≥3-character tokens and `array-contains-any`, with Arabic
folded first (hamza forms → `ا`, `ى` → `ي`, `ة` → `ه`, harakat and tatweel
stripped). Port the **normaliser** verbatim into PHP — it is what makes
"الجزاير" match "الجزائر" — then let MySQL do the matching:

```sql
ALTER TABLE listings ADD FULLTEXT ft_search (search_text);
SELECT * FROM listings
 WHERE status = 'published'
   AND MATCH(search_text) AGAINST (? IN BOOLEAN MODE)
```

- `search_text` = normalised `title + commune + wilaya (ar + slug)`, written on
  every save. Same input as `searchTokens` today.
- InnoDB's default `innodb_ft_min_token_size` is 3, which matches the current
  ≥3-character rule exactly. Do not reach for the ngram parser — that is for
  CJK, not Arabic.
- Filters that Firestore forced into memory (amenities, paperwork) become
  ordinary `JOIN`/`WHERE` clauses. Delete the in-memory pass.

---

## 9. Caching

ISR is gone; put the equivalent back deliberately:

| Page                          | Today               | Laravel                                                              |
| ----------------------------- | ------------------- | -------------------------------------------------------------------- |
| `/annonce/{id}/{slug}`        | `revalidate = 300`  | `Cache::remember("listing:$id", 300, …)`, forgotten on edit/moderate |
| `/articles/{slug}`            | `revalidate = 3600` | same, 1 h                                                            |
| `/{transaction}/…` browse     | `revalidate = 300`  | cache the **id list** per filter+page for 300 s, hydrate rows fresh  |
| `/sitemap.xml`                | dynamic             | 1 h                                                                  |
| dashboards, admin, `/publier` | `force-dynamic`     | never cached                                                         |

Use the `file` cache driver — shared hosting has no Redis. Keys must include
every filter segment, or two different searches will serve each other's results.

---

## 10. Migrating the live data

One-shot, with a freeze. Write `php artisan taajir:import` that reads a
Firestore export and writes MySQL, in this order (foreign keys decide it):

1. `roles` + `role_permissions`, `settings`, `wilayas`, `communes` (seeded from
   `src/data/geo/`, not from Firestore)
2. `users` — `uid` is the key; keep `referred_by`, `referral_code`, quotas,
   bans, strike counts
3. `listings` → then `listing_images`, `listing_amenities`; recompute
   `search_text`, drop the buckets
4. `comments`, `requests`, `request_replies`, `saved_searches`
5. `articles`, `article_comments`, `promos`
6. affiliate: `points_ledger` first, then recompute `users.points_balance` from
   it — never trust the cached balance in the export
7. `campaigns` → `campaign_prizes`, `campaign_links`, `campaign_entrants`,
   `link_visits`, `prize_claims`, `payouts`
8. `short_links`, `admin_audit`

Then: download every Firebase Storage object under `listings/`, `promos/`,
`articles/` to `storage/app/public/`, rewriting `cover_url` and
`listing_images.url` as you go. Do this **before** the cut-over and keep the
Storage bucket alive for a while afterwards — old URLs in indexed pages and
WhatsApp messages keep resolving while Google recrawls.

Verification before you point DNS: counts per table match the export; ten
random listings render identically on both sites; a Google sign-in creates
exactly one `users` row; a published listing's URL is byte-identical.

---

## 11. Decide before you start

Four things have no single right answer, and each changes the plan:

1. **Push notifications.** FCM web push is independent of where the data lives,
   so it can stay (keep the `devices` table and a server key) — or drop it for
   v1 and let saved-search alerts queue in `launch_outbox` until a channel
   exists. Dropping it is the smaller v1.
2. **Images on the cPanel disk.** 20 images × 3 sizes per listing adds up fast;
   check the account's quota before committing, or keep Firebase Storage for
   images only (it stays free at this scale and costs nothing to keep).
3. **The affiliate programme.** It is roughly a third of the port's complexity
   and it is currently **disabled by default** (`enabled: false`). Shipping v1
   without it is legitimate — but if you do, migrate `points_ledger` anyway, so
   no one's balance is lost.
4. **Arabic full-text quality.** MySQL FULLTEXT on normalised text is good, not
   excellent. If search quality matters more than simplicity later, Meilisearch
   or Typesense is the upgrade path — but neither runs on shared hosting.

---

## 12. Deploying on cPanel

The part that makes this port worth doing: PHP is native there.

- Document root points at `public/`. Everything else — `.env`, `storage/`,
  `vendor/` — sits above it, unreachable by URL. This is the same lesson the
  Node deployment learned the hard way (`docs/cpanel.md` §1).
- `composer install --no-dev --optimize-autoloader`, then
  `php artisan config:cache route:cache view:cache`.
- `php artisan storage:link` for uploaded images.
- Cron, from cPanel: `* * * * * cd /home/USER/taajir && php artisan schedule:run`
  — that one line covers the launch job, listing expiry at 60 days
  (`kListingLifetimeDays`), saved-search alerts and the queue.
- MySQL database + user in cPanel; credentials into `.env`.
- Re-add the security headers from `next.config.ts` — CSP, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`, HSTS. In Laravel that is one
  middleware. The CSP still needs Google's script and frame hosts for
  reCAPTCHA and the sign-in popup, and `connect-src` still needs
  `*.googleapis.com` and `identitytoolkit.googleapis.com` for Firebase Auth.
- `APP_KEY` is now load-bearing twice over: sessions **and** the encrypted
  payout fields. Generate once, back it up, never rotate casually.

---

## 13. Delivery plan

Each phase ends in something you can open in a browser.

| #   | Phase                                                                                                                      | Done when                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | Skeleton — Laravel, Tailwind v4 with the real tokens, RTL layout, header/footer/bottom-nav, five static pages              | `/cgu` looks like today's `/cgu`                               |
| 2   | Geography + taxonomy — wilayas, communes, deals, property types, admin editor                                              | `/vente/appartement/alger` resolves and 404s correctly on junk |
| 3   | Auth — Firebase sign-in, `/auth/session`, users table, roles and gates                                                     | Google and phone sign-in both land on a dashboard              |
| 4   | Listings read path — browse, search, listing page, JSON-LD, sitemap, OG tags                                               | a migrated listing renders identically to production           |
| 5   | Listings write path — publish wizard, uploads, quota transaction, policy check, moderation queue, admin moderation screens | an ad can be posted, held, approved and appear                 |
| 6   | Community — comments, property requests and replies, saved searches, dashboard                                             | the three threads work with rate limits                        |
| 7   | Admin — users, roles, taxonomy, branding, promos, articles, audit log                                                      | every permission in §6.2 gates something real                  |
| 8   | Launch gate + notifications (+ affiliate, if in scope)                                                                     | the countdown page and the cron-driven launch work             |
| 9   | Data migration, staging on a subdomain, DNS cut-over                                                                       | counts match, ten listings verified, sign-in creates one row   |

Phases 1–5 are the site. 6–8 are what make it the same site.

### Phase 7, as built

Eleven of the fourteen permissions in §6.2 now gate a screen, and each one is
checked three times: on the route group, again in the controller, and again in
the service that does the work. Reaching a page is never proof of anything.

`AdminPermissionsTest` is the phase's acceptance criterion written down. For
every delivered permission it asserts both halves — that holding it alone opens
the screen, and that somebody who is staff but lacks it is refused — and it
fails if a permission is ever added to the catalogue without either a screen or
a line saying which phase brings one.

Three are deliberately still open, and they are phase 8's row above:
`launch.control`, `push.broadcast` and `affiliate.manage`. They have no menu
row either. A row with a 404 behind it is the same objection as a row that
403s, which is the rule `AdminNav` is written around, so they go in with the
routes rather than before them.

Two things the phase picked up on the way, neither of them admin work:

- Both image services called Intervention's v3 API (`read`, `toWebp`), removed
  in v4. That is a fatal at the moment a seller attaches a photo, and no test
  caught it because every publish test posted a listing with no photos.
- The sitemap declared its namespace as `sitemap.org` rather than
  `sitemaps.org`. A sitemap with the wrong namespace is rejected whole, and it
  fails silently: the file serves 200 and nothing in it is ever crawled.



### Phase 8, as built

Both §11 questions were settled the smaller way, and the reasons are worth
keeping.

**Notifications queue rather than send.** No SMTP, no SMS provider, and — the
one that is a decision rather than an absence — no FCM: sending a push needs a
Firebase service-account credential on the web host, and keeping that off the
host is the whole reason §5 verifies ID tokens with php-jwt instead of the
Admin SDK. So `launch_outbox` records who should be told, on which address, and
what it would have said. Wiring a provider later is one adapter and a pass over
the table; reconstructing months afterwards who should have heard is not
possible at all.

**The affiliate programme stays out**, per §11.3 — and `points_ledger` is
migrated regardless, with every `users.points_balance` recomputed from it
rather than copied. That is §10 point 6, and it is the reason the table comes
across ahead of the feature that will read it.

`affiliate.manage` is therefore the one permission in §6.2 with no screen. It
has no menu row either, and `AdminPermissionsTest` asserts both, so the gap is
a decision the suite states rather than an oversight.

Two rules the gate holds that are easy to lose:

- **The default is `active`.** The site is live; defaulting to held would mean
  the deploy shipping this feature closes the site on every visitor, and a
  transient database error would close it again later. Locking the public out
  takes a decision, never an absence and never a failure.
- **An elapsed countdown publishes nothing by itself.** It says "the wait is
  over" and stops. Even the unattended cron publishes only what a moderator
  approved; every other held ad falls into the review queue.

One divergence from the Next app, on purpose: its launch nulled `published_at`
on every requeued ad. Phase 5 settled the opposite for the same column on
rejection — `status` decides visibility, `published_at` is a historical fact —
and erasing it would shuffle a month-old ad to the top of "الأحدث" the day
somebody re-approves it.

---

## 14. Rules that must not be lost in translation

A checklist for review at the end of every phase:

- [ ] Prices stored as **whole dinars**; ×10 000 lives in exactly one helper
- [ ] All user-facing copy is Arabic, Algerian dialect or plain MSA — never
      Tunisian derja (that is the sibling `catalogev` project, not this one)
- [ ] URLs are Latin and French-derived; no Arabic in any path
- [ ] Logical Tailwind utilities only; `.ltr-nums` on Latin runs
- [ ] `accent` on filled action buttons and nowhere else
- [ ] Wilayas keyed by **slug**, carrying both `code` (1–69) and `code58`
- [ ] Every listing write goes through the service — quota, policy, slug and
      derived fields cannot be bypassed
- [ ] New listings are never auto-published when the policy check says `review`
- [ ] Points come from a qualifying publish, never from a signup; the ledger is
      the truth
- [ ] Article bodies stay **blocks**, never stored HTML — no `{!! !!}` over
      anything an admin account can write
