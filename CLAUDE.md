# تأجير — conventions

Arabic-first real-estate classifieds for Algeria. Next.js 16 (App Router) +
Firebase. Read this before adding code.

## Language

- **All user-facing copy is Arabic**, written in Algerian dialect or plain MSA.
  The sibling repo `catalogev` uses Tunisian derja — do not copy its phrasing.
- Code, identifiers, comments and commit messages are English.
- UI strings are inline for now. When a second locale is added they move to
  `src/lib/i18n/`; keep strings out of deeply nested helpers so that stays cheap.
- URL segments are Latin and French-derived (`/vente/appartement/alger`).
  Arabic in a URL percent-encodes into unreadable bytes and breaks WhatsApp
  previews, which is the main sharing channel in Algeria.

## RTL

`<html dir="rtl">` is set globally. Use **logical** Tailwind utilities only:
`ps-*`/`pe-*`, `ms-*`/`me-*`, `start-*`/`end-*`, `text-start`/`text-end`.
Physical `left`/`right`/`pl-`/`pr-` are bugs waiting for a French locale.
Latin-script runs inside Arabic prose (prices, phone numbers, areas) get the
`.ltr-nums` class so the bidi algorithm doesn't reorder them.

## Money

Prices are **always stored as whole Algerian dinars**. Algerians quote property
in `ملايين` (1 مليون = 10 000 DZD), so a flat at "800 مليون" is 8 000 000 DZD.
Conversion and formatting live only in `src/lib/price.ts` — never inline a
`* 10000` anywhere else. Getting this wrong is a 10 000× error.

## Geography

Algeria moved to **69 wilayas** (loi 26-06, JO n°25 of 5 April 2026), with
competence transfer running to 31 December 2026. Most people, and every
competitor site, still think in the old 58. The dataset therefore carries both:
`code` (1–69, current law) and `code58` (the parent wilaya), with a **stable
slug** as the real identifier. URLs key off the slug so a future reassignment is
a redirect, not a migration.

## Design

Palette, radii and shadows are defined once in `src/app/globals.css` under
`@theme`. Use the token utilities (`bg-accent`, `rounded-card`, `shadow-soft`),
never raw hex. The site no longer shares catalogev's purple.

**Two brand colours, and the split is load-bearing:**

- `primary` — navy `#1e293b`. Structure and information: logo, headings, links,
  prices, badges, active borders, focus rings, progress bars.
- `accent` — emerald `#059669`. **Filled action buttons only** — submit,
  contact, search, publish.

This is a 60/30/10 layout: light surfaces, navy structure, green actions. The
ratio only holds while `accent` stays on buttons; the first price or link that
borrows it is the point the buttons stop reading as buttons. When adding a
coloured element, ask whether it is something you _press_. If not, it is
`primary`.

Red is for destructive actions and alerts, never for areas. `success` is a
lighter green than `accent` on purpose, so a "منشورة" chip and a publish button
do not read as the same thing. `whatsapp` is WhatsApp's own green, for the
WhatsApp button alone — beside the emerald call button, anything else is
unrecognisable.

`muted` and `dim` are the two secondary text greys, both at or above 4.5:1 on
white. Do not lighten them; `text-dim` alone carries ~70 small labels.

## Data access

Clients never write `listings` directly. Creates, edits and moderation go
through Server Actions using firebase-admin, which is what makes quota
enforcement, slug generation and the promotion flags (`isFeatured`,
`pinnedUntil`) tamper-proof. Security rules deny all client writes to that
collection rather than trying to whitelist fields.

Derived fields — `ownerName`, `wilayaSlug`, `communeSlug`, `coverUrl`,
`priceBucket`, `areaBucket`, `searchTokens` — are recomputed **only** inside
`src/server/actions/`. Never in a component, never in a rule.

## Checks before committing

```bash
npm run typecheck && npm run lint && npm run format:check && npm run build
```

`next build` no longer runs ESLint in Next 16, so lint is a separate step.

## Hosting

Firebase App Hosting, configured in `apphosting.yaml`, deploying from `main`.

**Do not downgrade Next.js to satisfy App Hosting's support table.** App Hosting
lists 15.0–15.2 as "active" and treats 16.x as "preview", which looks like an
argument for pinning lower — it is not. Every release in the 15.2 line carries
26 open high-severity advisories (SSRF, cache poisoning, XSS, DoS) that are
fixed in 16.3, and the first patched 15.x release (15.5.22) is just as far
outside the "active" list as 16 is. Downgrading pays the cost and gets nothing.
Because the version is in preview, `apphosting.yaml` states the build and run
commands explicitly so framework auto-detection cannot change them underneath us.
