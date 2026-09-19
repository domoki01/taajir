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
| `app/Enums/Locale.php` | the three languages, their direction, and their URLs |
| `lang/{ar,fr,en}/` | every UI string, with matching key sets enforced by a test |
| `resources/views/static/{ar,fr,en}/` | the five content pages, written in each language |
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

## Languages

Arabic, French and English. Arabic is the default and carries **no URL prefix**
— every path the site serves today is Arabic and unprefixed, and those paths are
the contract with Google and with every WhatsApp message ever sent. The two
additions are what take a prefix:

```
/cgu        /fr/cgu        /en/cgu
/vente/appartement/alger   /fr/vente/appartement/alger   /en/…
```

`/ar/...` is not a URL of the site; it 301s to the unprefixed path, so there is
exactly one canonical URL per page per language. Every page emits `hreflang` for
all three plus `x-default` pointing at Arabic.

Two things are not translations:

- **Place names.** French carries English as well, because Algerian place names
  in English *are* the French forms. The handful with a real English exonym —
  Algiers, and so far only Algiers — are in `lang/en/geography.php`.
- **Prices.** Arabic and French both quote in ملايين, because that is how the
  market speaks in both. English shows the plain dinar amount: "800 million" is
  not a translation of "800 مليون", it is a different number. See
  `Locale::quotesInMillions()`.

User-written content — ad titles, descriptions, comments — is never translated.
It stays in whatever language it was written in, as it must.

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
- [x] **French and English**, added out of sequence on request. Arabic keeps
      every URL it had; the other two live behind a prefix.
- [ ] **3 — Auth**
- [ ] **4 — Listings read path**
- [ ] **5 — Listings write path**
- [ ] **6 — Community**
- [ ] **7 — Admin**
- [ ] **8 — Launch gate and notifications**
- [ ] **9 — Data migration and cut-over**
