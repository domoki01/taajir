# تأجير — Laravel port

The PHP/Laravel rebuild of the site that lives in the repository root as a
Next.js app. Same URLs, same screens, same rules, with MySQL as the database
and Firebase kept for one thing only: signing in.

The specification is [`../docs/laravel-port.md`](../docs/laravel-port.md), and
the product rules it defers to are in [`../CLAUDE.md`](../CLAUDE.md) — Arabic
copy, logical RTL utilities, prices in whole dinars, 69 wilayas keyed by slug,
and the two-colour palette. Those are product decisions, not Next.js
decisions: they survive the port unchanged.

The Next app stays live and stays in the root while this is built, which is why
the two trees sit side by side. Nothing here imports from `../src`; the design
tokens and the domain vocabulary are ported across by hand and pinned by tests.

## Where things are

| | |
| --- | --- |
| `config/taajir.php` | the product constants, ported from `../src/lib/constants.ts` |
| `app/Support/Price.php` | the ×10 000 conversion, and the only place it may live |
| `app/Support/Nav.php` | the one destination list both bars render |
| `app/Enums/` | the domain vocabulary — Latin keys, Arabic labels |
| `app/Services/Taxonomy.php` | the live category list: built-ins, renamed, hidden, plus custom |
| `app/Services/Geo.php` | slug-keyed wilaya and commune lookups |
| `app/Support/Text.php` | the Arabic fold that makes "الجزاير" match "الجزائر" |
| `database/data/` | the 69 wilayas and 1541 communes, generated from `../src/data/geo/` |
| `resources/css/app.css` | the `@theme` block, ported verbatim from `../src/app/globals.css` |
| `resources/views/components/layout/` | the shell: header, phone bars, side menu |

## Running it

```bash
composer install
cp .env.example .env && php artisan key:generate
php artisan migrate --seed        # schema, then the 69 wilayas and 1541 communes
npm install && npm run build      # Tailwind, Alpine, and Cairo self-hosted
php artisan serve
```

`npm run dev` instead of `npm run build` for a watching build.

## Checks before committing

```bash
vendor/bin/pint --test && php artisan test
```

Pint formats PHP; the root `npm run format:check` does not reach into this
directory, because this tree follows Laravel's conventions rather than the Next
app's Prettier config.

## Progress

Against the phases in §13 of the roadmap:

- [x] **1 — Skeleton.** Laravel, Tailwind v4 with the real tokens, the RTL
      layout, header / phone bars / side menu, the five content pages.
- [x] **2 — Geography and taxonomy.** The 69 wilayas and 1541 communes seeded
      and keyed by slug, the live category list with renames, hidden entries and
      admin-added types, and the browse catch-all resolving
      `/vente/appartement/alger/bab-ezzouar` or 404ing. The admin editor for the
      taxonomy lands with the rest of the admin panel in phase 7, since it needs
      the permissions from phase 3.
- [ ] **3 — Auth**
- [ ] **4 — Listings read path**
- [ ] **5 — Listings write path**
- [ ] **6 — Community**
- [ ] **7 — Admin**
- [ ] **8 — Launch gate and notifications**
- [ ] **9 — Data migration and cut-over**
