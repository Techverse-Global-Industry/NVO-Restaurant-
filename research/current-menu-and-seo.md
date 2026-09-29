# Current PDF menu and search optimisation

Updated 25 September 2026. Source: `menu folder/nvo menu-1.pdf` (nine image-based spreads, including English and French versions). All spreads were reviewed visually.

## What was imported

The source is transcribed into `lib/current-menu.ts`: **77 dishes, portions and extras across 10 categories**, with English/French names and descriptions. The menu includes rice, other meals, pepper soups, Nigerian soups, swallow, barbecue, shawarma, seafood, seafood boil packages and extras. Octopus appears on the French spread and is included. Repeated seafood boil lists are merged with their detailed package descriptions.

All printed prices are stored in FCFA/XOF. Asun spaghetti (3,000 / 7,500), barbecue catfish (10,000 / 15,000), and medium peppered prawns (6,000 / 10,000) retain separate, neutrally named options because the PDF does not explain their portions. The owner confirmed these numbers are food prices, without specifying the portion differences. Staff can rename the options once confirmed.

Six swallow choices, other barbecue fish and octopus have no fixed standalone price in the PDF; their price stays unset for team confirmation. They are never treated as free. Dishes marked for advance orders retain a visible pre-order label.

The owner explicitly chose to retain **Commissariat, Agblangandan, Cotonou** despite the different address printed in the PDF. The existing contact and map settings are preserved. Importing the menu does not change whether customers can see prices; the admin retains global and individual price controls.

## Photographs and menu experience

The menu uses NVO's existing food photographs where they match the dish, plus three downloaded photographs for jollof rice, chicken shawarma and plantain. Downloaded photos are labelled illustrative and credited on the website. Their source, author and licence links are recorded in `lib/menu-photos.ts`. The three compressed WebP files total approximately 202 KB. Original source media and the existing kitchen video are preserved.

The public menu has a blue-and-gold introduction, category navigation, bilingual search that ignores accents, individual dish pages, related dishes, pre-order labels and cart controls. Dishes without an appropriate photograph use a branded placeholder rather than a misleading food image.

## Import safely

Start the local application with its normal database and staff credentials, then run:

```powershell
npm run menu:import
npm run menu:import -- --apply
```

The first command previews the changes. Applying creates a consistent SQLite backup under `data/backups/`, logs in locally and saves through the normal staff API and audit trail. A JSON manifest records the import. Rerunning preserves staff edits. Only untouched starter placeholders are retired, and existing coupon references protect their meals. No database reset is involved.

For a separate test database, set `NVO_DB_PATH` to that database and `MENU_IMPORT_BASE_URL` to its local server before importing. These two values must point to the same application instance.

## Search implementation

- English and French have crawlable URLs: `/menu` and `/fr/menu`, including every dish detail page. The initial server HTML, page title, description and HTML language match the URL.
- Each public page has its own canonical URL and English/French language alternatives, including an `x-default` alternative.
- The sitemap includes published public pages and dish URLs in both languages. Drafts, sample details and archived starter dishes are excluded.
- Restaurant, Menu, MenuSection, MenuItem and BreadcrumbList structured data use the public catalogue. Hidden prices are excluded from HTML data and structured offers. No ratings, opening hours or reviews are invented.
- Images have useful alternative text, responsive sizes and compression. Local fonts are preloaded; offscreen homepage sections defer rendering work. The kitchen video downloads only when played.
- Private pages are excluded from indexing. Unknown dish paths return a real 404. Old promotions URLs redirect permanently to offers.

Implementation references: [Google's multilingual-page guidance](https://developers.google.com/search/docs/specialty/international/localized-versions), [Google's local business structured data guidance](https://developers.google.com/search/docs/appearance/structured-data/local-business), [Schema.org Menu](https://schema.org/Menu), [Next.js metadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata), and [Next.js Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy).

## Launch steps that require the live domain

Set `SITE_URL` to the final HTTPS domain and rebuild. Add `GOOGLE_SITE_VERIFICATION` if using Google's HTML verification method, verify domain ownership in Search Console, and submit `/sitemap.xml`. Confirm the physical map pin and business details with NVO, then monitor indexing and real visitor Core Web Vitals. Automated local SEO scores measure technical checks; they cannot guarantee rankings or traffic.

Validation reports and screenshots are kept under `artifacts/`; these are development files and are not served publicly.

## Completed verification

The main database import completed on 25 September 2026, with backup `data/backups/menu-2026-09-25T14-12-06-277Z.sqlite`. The resulting menu has 77 active dishes/options, including 10 pre-order options and 8 entries without a fixed PDF price. A second dry run reports zero changes. Existing orders, coupons, reservations, staff, non-menu content and all restaurant settings were compared before/after and preserved. Prices were initially hidden under the existing admin setting. Following the owner?s explicit request, public prices were enabled on 25 September 2026: all 69 priced options now display their PDF prices in English and French. The eight options with no fixed PDF price still require team confirmation.

The production build and all 53 automated tests passed. The dedicated browser suite passed bilingual server HTML, canonical/language alternatives, permanent redirects, sitemap exclusions, 404 handling, search, category selection, widths 320/390/768/1440, cart additions, quotes, hidden prices, and zero axe violations on the home, French menu and French Banga page. Read-only checks also passed against the main preview. See `artifacts/menu-seo-browser.json` and `artifacts/menu-import-validation.json`.

Final Lighthouse mobile audit of `/fr/menu`: **SEO 100, accessibility 100, best practices 100, performance 80**. First contentful paint: 1.2 seconds; largest contentful paint: 1.8 seconds in this local simulated run. The remaining performance findings mainly concern JavaScript/main-thread work and shared CSS. These are laboratory results, not a claim of perfect performance or guaranteed search rankings. Reports: `artifacts/lighthouse-menu-fr.html` and `.json`.
