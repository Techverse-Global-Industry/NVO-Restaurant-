# NVO annual infrastructure and feature-cost audit

Checked 25 September 2026 against the implementation and provider documentation. Currency: Nigerian naira (NGN). WhatsApp promotional campaigns are excluded from the proposed operating budget at the owner's request. Existing customer-initiated WhatsApp order and reservation links remain a separate, no-API-fee feature.

The commercial plan is to charge NVO NGN 50,000 for one year and allocate at most NGN 25,000 to domain and infrastructure. Those are different figures: infrastructure spending comes out of the service payment. This report does not price development, migration, support labour, staff internet access or restaurant discounts.

## Conclusion

The implemented features mostly have **no separate licence or API fee**. They consume shared computing, database, file storage and network resources. Coupons, orders and analytics do not each need their own paid subscription.

The lowest infrastructure target identified is **NGN 12,000 plus any checkout taxes/fees for the first year**, using the advertised standard .com registration price and a migrated application that stays inside free cloud allowances. NGN 13,000 would be a reserve, not a mandatory backend invoice. This is an unvalidated deployment target, not a guaranteed full-year price for the current build.

The current application requires a persistent Node server. The lowest paid server option reviewed that matches that architecture starts at an annualized **approximately NGN 86,856 including the NGN 12,000 domain**, before taxes, payment fees and optional services. This is based on an advertised starting rate, not a confirmed checkout quote or a completed server performance test.

## Implemented features and direct fees

Here, "NGN 0 separate fee" means no feature-specific subscription or per-use vendor fee in the current implementation. It does not mean that the underlying hosting is free.

| Area | Feature | Separate fee | Resources or conditions |
|---|---|---|---|
| Frontend | Royal design, mobile layouts, animations and chef character | NGN 0 | Browser code and hosted files. |
| Frontend | Chef spoken welcome and staff guidance | NGN 0 API fee | Browser speech synthesis; voice availability depends on device. No paid voice service is called. |
| Frontend + backend | Menu, categories, price visibility, availability and meal pages | NGN 0 | Database reads, public page rendering and images. |
| Frontend + backend | Specials, news, events, testimonials and loyalty announcements | NGN 0 | Database and media storage; staff manage publication and dates. |
| Frontend | Photo gallery and existing kitchen film | NGN 0 separate fee | Files and delivery traffic. Existing video is a local file, not a paid streaming integration. |
| Frontend | EN/FR interface switch | NGN 0 | Displays existing translations; switching languages does not call a paid translator. |
| Frontend + backend | Cart, quantities, totals and order handoff | NGN 0 | Browser storage plus backend validation and order storage. |
| Frontend + backend | Reservation requests and confirmation statuses | NGN 0 | Database records and staff actions. |
| Frontend | WhatsApp contact/order/reservation links | NGN 0 API fee | Opens a message for the customer to send in WhatsApp; this is not an automated paid marketing template. |
| Frontend | Google location map and directions link | NGN 0 in current setup | Keyless map iframe and external directions link. Optional Maps Embed API is also listed by Google as no-charge. |
| Frontend + backend | SEO metadata, structured data, sitemap and social previews | NGN 0 separate fee | Hosted pages and metadata rendering. No paid SEO plugin or ranking subscription. |
| Frontend + backend | Named coupons, unique codes, dates, claimed status and wallet | NGN 0 | Database writes and reads; PNG/QR generation runs in the browser. No paid QR service. |
| Backend | Capacity, activation delay, expiry, one claim per IP and redemption | NGN 0 | Atomic database operations and trusted client-IP handling. No paid IP lookup service. |
| Backend | Receipt references, counter sales, quotes and paid-order ledger | NGN 0 | Stored records and validation. No online payment gateway is integrated. |
| Backend | Referral links and timed claim eligibility | NGN 0 | Current referral tables and coupon rules. Advanced automatic referrer rewards are not implemented. |
| Backend | Staff login, roles, sessions and audit trail | NGN 0 | Local authentication and database. Password verification consumes CPU. |
| Backend | Menu/content editing, archiving, uploads and deletion | NGN 0 software fee | File storage, database and processing. Uploads currently store original files up to 8 MiB. |
| Backend | Guest activity, visits, sources and cart-event reports | NGN 0 analytics-provider fee | First-party database records and reporting queries. Storage and retention need management. |
| Backend | Automatic captions | NGN 0 in the active workflow | Deterministic platform-specific writing logic; current plans use standard captions. |
| Backend | Automatic EN/FR translation while editing | NGN 0 external API fee today | Local translation models and a worker thread require server RAM and CPU. This is a substantial hosting compatibility issue. |
| Backend | Facebook Page and Instagram photo publishing | NGN 0 direct publishing API fee | Our own queue, retries, token storage and image preparation use hosting resources. Permissions and account connection are still required. |
| Backend + staff action | TikTok photo upload | NGN 0 API fee | Current flow requires staff to finish publishing in TikTok. Full unattended posting is not an implemented or assured capability. |
| Operations | HTTPS, DNS and domain routing | Free options available | Cloudflare Universal SSL and DNS can cover the proposed public deployment. A VPS also needs its origin HTTPS configuration. |
| Operations | Backups, restore checks, monitoring and updates | No fixed extra licence required | Backup storage, retention and maintenance still need implementation and resources. No paid managed-support contract is included in a server price. |

Google documents [Maps Embed as no-charge](https://developers.google.com/maps/documentation/embed/usage-and-billing). Cloudflare documents [free Universal SSL](https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/). Meta's [developer-platform statement](https://about.fb.com/news/2018/12/response-to-six4three-documents/amp/) describes free API access; access permissions still apply. TikTok's [developer terms](https://www.tiktok.com/legal/page/global/tik-tok-developer-terms-of-service/en) state that developer services currently have no fee. Its [Direct Post guidelines](https://developers.tiktok.com/docs/en/content-sharing-guidelines) exclude tools limited to internal/private account management; do not sell full NVO-only Direct Post automation as guaranteed. The [Upload API workflow](https://developers.tiktok.com/products/content-posting-api) includes completion inside TikTok.

## Configuration checked without exposing credentials

- Optional paid caption-provider key: absent. Optional caption model: absent. The two stored social plans use `standard`; the current admin caption request explicitly sends `ai: false`.
- An optional paid caption API code path exists in `lib/social/captions.ts`. It is not needed for the active captions and should stay disabled for this budget. No AI subscription is required by the current caption workflow.
- Maps API key: absent; the current iframe uses the keyless fallback.
- Meta app and TikTok app settings: absent; connected social accounts: zero. Provider delivery remains unverified with real accounts.
- Storage measured: built-in photos 2.13 MiB, built-in video 1.64 MiB, uploaded photos 0.18 MiB, translation model files 271.18 MiB. Model-file size is disk usage, not a RAM benchmark.

Evidence: `package.json`, `server.mjs`, `app/api/[...path]/route.ts`, `app/api/admin/social/[action]/route.ts`, `lib/db.ts`, `lib/auth.ts`, `lib/analytics.ts`, `lib/translation.ts`, `scripts/translation-worker.mjs`, `lib/social/{captions,media,providers,queue,worker}.ts`, `components/{pages,coupons,chef,social-admin}.tsx`, and read-only configuration/database checks.

## Why the existing build cannot simply be placed on free static hosting

Public pages currently use dynamic Next.js rendering and database reads. SQLite and uploaded files live on disk. Password verification uses Node scrypt. Image preparation uses native sharp. Translations use local models in a Node worker thread. Social publishing uses a timer that runs every ten seconds. Strict coupon IP limits rely on the custom Node server's trusted socket/proxy handling.

A free Cloudflare design requires migrating database operations to D1, files to R2, publication work to bounded scheduled jobs, and the client-IP trust boundary to the new host. Atomic coupon claims, order retry protection, secure authentication and public SEO must remain correct. The current translation and image-processing runtimes also need alternatives. Purchasing Workers Paid alone does not recreate a persistent Node server or make the current translation worker compatible.

The proposed public pages should be generated or cached with explicit refresh/expiry rules. Pages must still update when staff publish content or change a special. Free hosting should not weaken authentication, make coupon capacity unsafe or silently stop scheduled posts.

## Free-service allowances and what they mean

| Service | Relevant published free allowance | Budget implication |
|---|---|---|
| Workers/static assets | Static asset requests are free; Workers allow 100,000 dynamic requests/day | Requests are not visitors. A page can create multiple API calls. |
| Worker runtime | 10 ms CPU per invocation and 128 MB memory | Login, rendering, image processing and translation need special attention even at low traffic. Network wait time is different from CPU time. |
| D1 | 500 MB per free database; 5 million rows read/day and 100,000 rows written/day | Database operations must be indexed and measured. A scan can read many rows for one customer action. |
| D1 recovery | Seven days of point-in-time recovery on Free | Keep an additional practical export/restore procedure; this is not permanent archival backup. |
| R2 Standard | 10 GB-month storage, 1 million Class A and 10 million Class B operations/month | Counts include other bucket use on the account. More storage or operations can create charges. |
| Workers AI | 10,000 neurons/day in the free allowance, subject to model eligibility | Possible replacement for editing translations; model quality, commercial licence and quota use must be verified. Not integrated or tested yet. |

Sources: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/).

Free Workers/D1 limits can reject work until reset or upgrade. R2 has billable overages. Storage caps and billing alerts are not a universal hard spending cap or a full-year uptime guarantee.

## Cost scenarios

Amounts below exclude checkout tax, payment/conversion fees, labour and optional services. They assume an available standard-price domain, not a premium name. The USD illustration uses NGN 1,374/USD from [Wise](https://wise.com/gb/currency-converter/usd-to-ngn-rate); an actual card rate may differ.

| Scenario | First-year infrastructure estimate | Status |
|---|---:|---|
| Migrated app stays within free allowances | NGN 12,000 domain + NGN 0 hosting = **NGN 12,000** | Lowest target identified; compatibility, usage and live social delivery are not validated. |
| Owner's proposed allocation | NGN 12,000 domain + NGN 13,000 reserve = **NGN 25,000 allocated** | Reserve remains unspent unless needed. It does not purchase a paid hosting guarantee. |
| Existing Node architecture on advertised OVHcloud VPS-1 starting rate | USD 4.54 x 12 = USD 54.48, approximately NGN 74,856 hosting; plus NGN 12,000 domain = **NGN 86,856** | Architecture match in principle. Verify checkout, commitment, renewal, availability and performance. Self-managed. |
| Migrated app requiring Workers Paid for a whole year | USD 5 x 12 = USD 60, approximately NGN 82,440; plus domain = **NGN 94,440 minimum** | Extra usage/storage/inference can add charges. Over the budget. |

[QServers advertises .com registration at NGN 12,000 and renewal at NGN 20,000](https://qservers.ng/domain-registration/). Therefore the same free-hosting assumptions give a following-year base of NGN 20,000 at today's renewal price. Retaining a NGN 25,000 ceiling would leave NGN 5,000 for that year's reserve. Prices are not locked before purchase.

[OVHcloud's VPS-1](https://www.ovhcloud.com/en/vps/) lists 2 vCores, 4 GB RAM, 40 GB NVMe and a daily backup at its starting rate. The annual figure above multiplies the advertised monthly equivalent; it is not a verified annual invoice. Additional database-aware backups and restore checks remain part of deployment work.

Generic low-price shared hosting is not automatically compatible. The [QServers shared-hosting page](https://qservers.ng/website-hosting/) does not establish support for this application's Node 24 runtime, worker threads, native image processing and continuously running jobs. Do not buy a shared package on price alone.

## Budget controls and acceptance work

Proposed controls, not changes already made:

1. Use standard captions; keep the optional paid caption provider disabled and exclude WhatsApp campaigns from the package.
2. Compress images during the staff upload workflow and store only necessary versions. Target a sensible total photo allowance such as 2 GB, measured across website/social copies. Never delete customer records or active photos automatically to save money.
3. As an illustration, five photos/day at 300 KB each adds about 548 MB/year before thumbnails, social variants and backups. Compression and traffic assumptions must be verified; this is not a visitor-capacity guarantee.
4. Cache public content, retain efficient database indexes, set analytics retention/aggregation, and bound background retries and polling.
5. Keep secrets and posting tokens server-side; preserve atomic coupon rules, request idempotency and trusted client IPs.
6. Test login, an actual upload and deletion, simultaneous coupon claims, order retries, both translation directions, public SEO refresh/expiry and scheduled jobs against the target free runtime. Simulated providers should be used until live-account authorization is available.
7. Test backups and restoration and measure resource use with representative activity before promising a year's operation. Monitor quotas and notify the owner before a budget decision is needed.

There is currently no validated paid plan at NGN 13,000/year that has been shown to run this whole build. There is a credible free-tier migration to investigate, but this audit does not claim that migration is complete.

## Optional services outside the current package

WhatsApp promotional templates are excluded. Paid advertisements, premium AI captions, SMS/OTP, transactional email services, online card/mobile-money processing and business email mailboxes can have their own pricing if requested later. Several are not implemented at all; they must not appear as hidden mandatory charges for today's site. Coupon discounts and free meals are restaurant promotion costs, not website API fees.

No application behaviour, provider accounts or billing settings were changed during this audit. No purchase or deployment was performed.
