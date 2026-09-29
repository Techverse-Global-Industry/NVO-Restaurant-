# Current specials, checkout and Guest Activity

## Where to manage specials

Use **Current specials** in the staff workspace. Publish a real title, food image and description; choose start/end dates if needed. A featured special takes priority on the homepage, and actual publications take priority over labelled preview examples. The dedicated `/specials` page links to a full page for every published special. Its WhatsApp enquiry includes the selected special’s title and page link. Social captions now point to that full special page. Coupons remain under `/offers`.

Draft, future, expired and hidden specials are excluded from the live catalogue and sitemap. An open page refreshes its catalogue on navigation; refresh it to see changes made by staff while it was open.

## What happens when a guest submits an order

The server saves an order request, then the browser removes the submitted quantities from the cart. A failure leaves the selection intact. The confirmation remains available with the WhatsApp **Send** link and a new-selection link; reloading the same tab can restore that confirmation for 24 hours. Other open tabs synchronise the cart through browser storage. New items added while an earlier submission was pending are preserved.

The guest still needs to open WhatsApp and press Send. A saved request is not proof of a sent message, payment or fulfilment. Identical retries reuse a request key, and the server returns the original saved order and its details.

## How to read Guest Activity

- **Visitor browsers:** distinct consented browser identifiers, not individual people.
- **Visits:** activity sessions, separated by 30 minutes without an accepted event.
- **Page views:** public pages opened/reloaded. Navigating between pages and reloading can produce several views from one browser; language changes and ordinary component updates do not produce extra views.
- **Meal units added:** actual quantity increases, including the Add and plus buttons.
- **Meal units removed by guests:** minus, deleting a line or manually clearing the selection. Removing a line containing three portions counts as three. Automatic clearing after an order does not count.
- **WhatsApp order clicks / special enquiries:** link clicks only. They cannot prove a message was sent or a sale occurred.
- **Link source:** the campaign source label on the first accepted event of a visit. “Direct” includes missing labels; it is not proof someone typed the URL.

Current metrics cover the last 30 days. Daily dates use Cotonou time. Counts exclude authenticated staff and recognised staff browsers (including after logout), admin/non-public paths, local development, showcase preview mode and recognised automated user agents. Guests who decline analytics or send a Do Not Track preference are not collected by the browser. Unknown automation and cookie changes cannot be eliminated completely; do not treat these metrics as a census of people.

Old analytics rows were preserved as version 1. They mixed internal testing, repeat browsing and guest events, so they appear separately as **Earlier mixed records** and are excluded from the corrected totals. The audit found 118 page views across two browser identities, including 10 admin-page views. No old rows were relabelled as verified customer visits.

## Verification and deployment

The normal local preview correctly shows zero new guest traffic. To collect live guest activity, deploy on the restaurant’s public domain, turn off showcase preview mode, and test from a browser that has not been used for staff login, with analytics allowed. Do not clear the owner’s coupons or browser state just to manufacture guest traffic.

`ANALYTICS_ALLOW_LOCAL=true` is only for an isolated analytics test server/database. Leave it false in normal operation. It does not bypass staff, consent, preview or bot filtering.

Backend regression tests: `npm test`. Browser verification: prepare a unique `data/growth-browser-*.sqlite` using `scripts/growth-fixture.ts`, serve that database on port 3003 with `SOCIAL_WORKER_MODE=off` and the explicit local analytics test flag, then run `node tests/growth-browser.mjs`. Never prepare that fixture against the restaurant database.

For business use of the coupon controls, see [the 10-strategy coupon growth guide](nvo-coupon-growth-playbook.md).
