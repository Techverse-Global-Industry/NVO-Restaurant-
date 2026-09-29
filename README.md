# NVO Restaurant

Working website preview for NVO in Agblangandan, Cotonou. Built with Next.js, React, TypeScript and a persistent SQLite database. Original supplied assets remain intact; selected photographs are copied into `public/images`.

## Run locally

Requires Node.js 24 or later.

```powershell
npm install
npm run setup
npm run setup:translation
npm run build
npm start
```

Open http://localhost:3000. Admin: http://localhost:3000/admin. The generated local credentials are in `private/LOCAL-ADMIN.txt`; keep that file and `.env.local` private. Setup preserves existing configuration. Changing bootstrap credentials does not update an existing database account.

For development, use `npm run dev`. Data persists in `data/nvo.sqlite`; uploaded images persist in `data/uploads`. Never replace or delete the database to update restaurant content: use the admin interface.

## Implemented

- Responsive home, searchable menu, meal pages, gallery, story, contact and Google map.
- Admin-managed menu, categories, specials, editorial content, events, testimonials and loyalty announcements.
- Global and per-meal public price visibility; hidden prices are removed from public API responses and totals.
- Persistent cart, server-validated order requests and WhatsApp message preparation using the owner's supplied number. Customers send order requests themselves. Separately, connected WhatsApp marketing sends approved messages to explicit subscribers.
- Reservation requests, staff confirmation, manual quotes and an order ledger. Only staff-marked paid orders count as paid sales.
- Configurable offer capacity, claim limits, activation delay, expiry, reward wallet, referral visit timer and staff redemption.
- Password-protected admin with role checks, image uploads, settings, consent-based analytics and audit records.
- English/French controls and translated primary interface text. Some editorial, admin and policy copy remains English.
- Royal blue, white and gold redesign with food compositions, a click-to-play kitchen film, expanded gallery and archived flyers.
- Original vector chef host with a once-per-session entrance, optional spoken welcome, reduced-motion support and page-specific staff guides.
- Grouped staff navigation, quick tasks, content search/filtering, mobile page selector and uploaded-photo deletion. Photos referenced by any content, including drafts, must be replaced before deletion.
- Seven labelled sample editorial features: three stories, three occasion concepts and a kitchen spotlight. `npm run showcase` installs these once without overwriting existing content. Restaurant settings can hide all samples; individual items can be edited or archived. Sample mode disables search indexing site-wide, and sample detail URLs never enter the sitemap.

## Scope still to complete

This is a local first implementation, not the complete 63-section platform or a production launch. Verified customer accounts/OTP, cross-device wallets, recurrent randomized drops, automatic referrer rewards, advanced meal options, and staff account management UI remain outstanding. The publishing integrations are implemented; live provider credentials, app reviews and account authorization still need deployment setup. Claims are limited to one per IP per offer, with browser ownership as an additional check. Shared Wi-Fi is one IP; changing IP can bypass network identity. Reserved coupon holds need an automated expiry/release policy.

Before public launch, review meal identities/descriptions and all restaurant policies, confirm opening hours, test the WhatsApp destination on a phone, and visually confirm the supplied map pin. Complete customer abuse controls, staff/password recovery, backups and restoration tests, privacy/retention requirements, HTTPS and deployment configuration. Do not enable campaigns until their terms and redemption process are approved.

SQLite requires a single persistent Node server and durable disk; this build is not suitable for an ephemeral/serverless filesystem. Node currently labels `node:sqlite` experimental. Publishing workers are included; PostgreSQL migration would be needed before a broader multi-host deployment. Set `SITE_URL` to the public domain and `SECURE_COOKIES=true` behind HTTPS. Fonts are self-hosted with their licenses; the Google map requires external network access. The optional Maps Embed API key must be restricted to the deployed site and API.

## Verification

```powershell
npm run typecheck
npm test
npm run build
```

Business-rule tests cover pricing, availability, coupon ownership, capacity, timing, validation and safe sample-content visibility. Browser checks use installed Microsoft Edge on Windows. Run them only against a dedicated test database because they create and change records:

```powershell
# Separate terminal; choose a fresh test database path for each run.
$env:NVO_DB_PATH='data/browser-test-fresh.sqlite'
npm run showcase
npm run start -- --port 3001
# Then, in another terminal:
node tests/browser.mjs
node tests/design.mjs
# Design tests end with sample mode off on the test database, ready for SEO audit:
node scripts/audit.mjs
```

The browser suite checks responsive widths, ordering, cart persistence, reservations, authentication, price visibility, campaign limits, staff confirmations, routes, map coordinates and language selection. Screenshots and results are written to `artifacts/`. No WhatsApp messages are sent by tests.

The design suite adds chef interactions, playback, staff guidance, media upload/deletion, reference protection, sample visibility, canonical metadata, structured data and axe accessibility audits. The Lighthouse script writes a mobile HTML/JSON report to `artifacts/`. These are local automated checks, not proof of real-world ranking or a complete manual accessibility certification.

Before SEO launch: turn off sample content, enter the real HTTPS domain in `SITE_URL`, rebuild, confirm business details and verify the domain in Google Search Console. Submit `/sitemap.xml` after deployment and review live indexing and Core Web Vitals. Page descriptions, canonical URLs, social share images, Restaurant/MenuItem/Breadcrumb structured data, favicon, sitemap and crawler exclusions are implemented. No ratings or reviews are fabricated for structured data.

See [research and planning](research/README.md) for source evidence, the asset audit and the full staged specification.

## Publishing and WhatsApp subscriptions

Admin **Publish everywhere** connects Facebook Pages, linked Instagram professional accounts, TikTok uploads and WhatsApp subscriber messaging. Choose defaults or select/deselect each destination on each story, special or event. Four automatically generated captions with optional manual editing, scheduling, durable retries, account encryption, duplicate protection and individual WhatsApp delivery records are implemented. TikTok requires finishing the post in its inbox. Public `/subscribe` records consent through signed incoming WhatsApp messages and supports STOP.

Run `npm run setup:social`, configure the private server values, and follow [the activation guide](research/social-publishing.md). Real posting remains unverified until actual provider accounts/apps are configured. Automated tests use simulated provider responses and never send real social posts or messages.

## Named coupons, automatic translation and motion

See [the owner activation and daily-use guide](research/owner-activation-guide.md). Named downloadable cards, strict IP checks, a verified counter-sale redemption flow, local English/French translation, automatic platform captions and motion controls are implemented. Start with `npm start` so the trusted client-IP checks are active. The translation models run in a separate server worker and are installed with `npm run setup:translation`; no paid translation API is required.

## Current PDF menu

The current menu contains 77 dishes, portions and extras in 10 categories, with English/French pages, search and category filters. With the local server running, use `npm run menu:import` to preview or `npm run menu:import -- --apply` to import. The importer backs up SQLite, preserves staff edits and uses the staff API. It does not change public price visibility. See [menu and SEO details](research/current-menu-and-seo.md) for source notes, image credits and search launch steps.
