# NVO publishing and customer acquisition

Implemented September 2026. Start at **Admin → Publish everywhere**.

## Staff workflow

1. An owner or manager connects accounts and decides which Facebook Pages, Instagram professional accounts and WhatsApp sender to use by default. Connecting does not backfill old posts.
2. Create a story, special or event, select its photo, then choose defaults, specific destinations, or website only. Each destination can be selected and deselected independently.
3. Captions are generated automatically as the story changes, in the chosen language. Each platform gets its own opening, call to action, length and hashtag handling. Staff can optionally enable manual editing. Long posts use a neutral full-details teaser instead of advertising an offer with missing conditions. No paid AI service is used by this workflow.
4. Publish now or use the website start date to schedule delivery (displayed in Cotonou time). Drafts, expired entries and sample content never initiate a social delivery.
5. Follow each destination in the delivery history. One account failing does not stop another. A confirmed post is not automatically repeated when its website story is edited. New announcements should be new stories.

Facebook and Instagram publish photo posts automatically. WhatsApp sends approved template messages to subscribed customers. TikTok uses an inbox upload: staff explicitly review/consent per post and complete publication inside TikTok. Processing, inbox delivery, successful publication and uncertain outcomes are separate states. This implementation handles one photo per post; video/Reels and carousels are not implemented.

**TikTok limitation:** its Direct Post guidelines exclude private tools used solely for a team's own accounts. This restaurant-only admin therefore does not pretend to provide approved direct public posting. It uses the documented `MEDIA_UPLOAD` path with `video.upload`, subject to TikTok app approval. See [Direct Post requirements](https://developers.tiktok.com/docs/en/content-sharing-guidelines) and [photo uploads](https://developers.tiktok.com/docs/en/content-posting-api-reference-photo-post). Fully unattended public TikTok publishing would require a suitable approved publishing service and a separately implemented integration.

## Server setup

Use a persistent Node 24 server with durable disk, HTTPS and the same SQLite database for the website and worker. Keep `data/nvo.sqlite`, `data/uploads`, `data/social-media` and the encryption key in secure backups. This is not an ephemeral/serverless deployment.

```powershell
npm run setup:social
```

This creates missing `SOCIAL_TOKEN_KEY` and `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in ignored `.env.local` without printing either. Keep the encryption key stable. Losing/changing it requires reconnecting all accounts. Put real provider secrets in server environment variables or a secret manager, never in public client variables or Git. `.env.example` lists every setting.

Set `SITE_URL` to the public HTTPS origin, without a subpath, and `SECURE_COOKIES=true`. Public photos are converted to 1080×1350 JPEG snapshots under unguessable `/social-media/…` URLs, valid for seven days. Identical photos reuse the same prepared snapshot across destinations; expired snapshots are cleaned up by the worker. Providers must be able to fetch these URLs without a login or firewall challenge. Preserve local data when updating the application.

### Facebook and Instagram

Configure a Meta developer app for Facebook Login and the Pages/Instagram publishing products. Set `META_APP_ID`, `META_APP_SECRET` and `META_API_VERSION` to the supported version selected in the app dashboard; the implementation intentionally has no hard-coded guessed version.

Register exactly:

```text
https://YOUR-DOMAIN/api/social/callback/meta
```

The login asks for `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic` and `instagram_content_publish`. Complete the access level, review and business verification required for your app/account use. Use a Facebook Page and an Instagram professional account linked to that Page. Personal Instagram accounts are not supported by this flow. Authorize using an account with content publishing rights, then select only NVO's accounts from the returned list.

The integration exchanges tokens on the server and encrypts Page tokens at rest. It creates an unpublished Facebook photo then a Page feed post, or an Instagram media container then a media publication. Only actual provider IDs count as published. Primary references: [Meta's Instagram API collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api), [Facebook API collection](https://www.postman.com/meta/facebook/documentation/r56bjfd/facebook-api).

Disconnect removes the stored local token and stops queued deliveries. It does not remove previously published posts or revoke the entire app at Meta (which could disconnect another NVO destination). Remove app authorization in the platform's account settings if complete provider-side revocation is wanted.

### TikTok

Set `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET`. Configure Login Kit and Content Posting upload permissions `user.info.basic,video.upload`, complete required app review, and verify ownership of the website domain/media URL prefix. Register:

```text
https://YOUR-DOMAIN/api/social/callback/tiktok
```

Connect and select the restaurant account. TikTok has no automatic default: choose it on the individual post, review its automatically generated caption and confirm the upload. The dashboard polls the publish ID until the upload reaches the inbox and eventually receives TikTok's publication result. Access tokens refresh server-side using encrypted refresh credentials. TikTok's account limits and pending-upload caps still apply. References: [Login Kit](https://developers.tiktok.com/docs/en/login-kit-web), [token lifecycle](https://developers.tiktok.com/docs/en/oauth-user-access-token-management), [post status](https://developers.tiktok.com/docs/en/content-posting-api-reference-get-video-status).

### WhatsApp subscriber messages

This is customer messaging through WhatsApp Cloud API, not Status or Channel posting. Set:

```text
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_BUSINESS_ACCOUNT_ID
WHATSAPP_WEBHOOK_VERIFY_TOKEN
META_APP_SECRET
META_API_VERSION
WHATSAPP_TEMPLATE_FR / WHATSAPP_TEMPLATE_EN
WHATSAPP_TEMPLATE_FR_LOCALE / WHATSAPP_TEMPLATE_EN_LOCALE
```

The token needs access to the actual WhatsApp Business account, sender, messaging and template management. Register/verify the business sender with Meta and configure billing as required. Click **Connect account** in the WhatsApp card after setup; the server verifies the business number and each configured approved template. The customer subscription page uses that verified business number, rather than assuming the website's order-contact number has Cloud API access.

For each configured language, create and obtain approval for a **MARKETING** template with an **IMAGE header**, exactly **one positional body variable `{{1}}`**, and **no buttons**. Static body/footer text is allowed. Example draft to submit for review:

```text
Les nouvelles de NVO Restaurant 💙

{{1}}

Merci de faire partie de la communauté NVO.
```

Use a realistic full message as the variable sample. Approval is Meta's decision; this example is not claimed to be pre-approved. Captions include the story URL and STOP instructions and are restricted to 900 UTF-16 characters to leave room for the template's static text. Multiline caption whitespace is normalized in the body parameter. Confirm your final template fits Meta's limits. A language can send only when its corresponding template is connected.

Webhook callback:

```text
https://YOUR-DOMAIN/api/social/whatsapp/webhook
```

Use the generated verify token during callback verification, subscribe the app to the WABA and its `messages` webhook field. The endpoint verifies `X-Hub-Signature-256` with the Meta app secret, checks the business phone ID and deduplicates inbound message IDs. No unsigned requests can add subscribers or mark deliveries.

Share `/subscribe`. Guests select consent and send **ABONNER NVO** or **JOIN NVO** in WhatsApp; merely opening the page/chat does not subscribe anyone. Order/reservation records never become marketing subscribers. **STOP** unsubscribes, cancels unsent messages and is rechecked immediately before every send. Owner/manager can also unsubscribe a customer. A delayed older subscribe webhook cannot override a newer STOP. The dashboard separately counts sent, delivered, read, failed, skipped and uncertain recipient results. Meta marketing-message charges and limits apply; no price is assumed in code.

References: [Meta WhatsApp Cloud API](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api), [template messages](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/template/), [WhatsApp business messaging policy](https://business.whatsapp.com/policy).

### Automatic captions and local translation

Automatic captions use the local editorial engine and need no API key. English/French title and description translation uses locally installed OPUS models (`npm run setup:translation`). See [the owner guide](owner-activation-guide.md) for daily use and an optional free-tier AI recommendation.

## Delivery operation and reliability

`SOCIAL_WORKER_MODE=embedded` starts a ten-second polling worker with the persistent Next.js server. The UI shows its heartbeat. For a separately supervised worker on the same host/database set `SOCIAL_WORKER_MODE=external` on the web process and run:

```powershell
npm run social:worker
```

Use your deployment process supervisor to restart this worker after crashes/reboots. `SOCIAL_WORKER_MODE=off` is for tests/disabled delivery. A sleeping web host cannot deliver scheduled posts on time; use an always-running server/worker. Jobs survive restarts in SQLite; overdue jobs resume when the worker returns unless their content has expired.

Website saves and queue changes commit together. A unique entry/account pair avoids duplicate automatic posting. Account-level leases serialize work and protect token refresh. Expired preparation leases may retry; interrupted final sends become **Check the destination**. Explicit rate-limit/transient rejections back off. Ambiguous final results never retry automatically: staff first confirm the post/message was not sent. This reduces duplicate risk; external APIs cannot provide a universal exactly-once guarantee. WhatsApp additionally keeps a unique recipient/job ledger and skips already confirmed sends.

Disconnecting/deselecting stops unsent deliveries. An in-flight request cannot be recalled. Edits and archive actions cannot remove posts/messages already sent on external platforms. Retrying shows the snapshotted caption/photo; if the source needs correcting, edit it before retrying. TikTok inbox items already transferred must be managed in TikTok.

## Verification and activation boundary

`npm test` includes mocked provider tests for encryption, OAuth CSRF/replay, atomic queue saves, drafts/sample exclusion, scheduling, idempotency, per-platform failures, ambiguous results, worker crashes, TikTok consent/inbox/token refresh, caption caching, public JPEG preparation, signed WhatsApp subscriptions, STOP ordering and recipient receipts. Tests never publish to real accounts.

`node tests/social-browser.mjs` exercises the staff UI and subscription page against a dedicated test database with `SOCIAL_WORKER_MODE=off`; see `tests/social-fixture.ts`. It creates/changes records and must never run against the restaurant's live database. Browser screenshots and accessibility results are in `artifacts/`.

No real Meta, TikTok or WhatsApp app credentials/accounts were supplied during implementation. Live app review, callbacks, verified media fetching, real platform publishing, template approval, billing and subscriber delivery remain deployment acceptance checks. Test once with restaurant-approved content and an explicitly subscribed test recipient after the owner has connected the actual accounts. Do not send fixture/sample content to real customers.

### Local verification result

42 backend tests passed after the coupon and caption upgrade. The production build and the existing ordering/reservations browser suite passed. The publishing browser suite passed at 320, 390, 768 and 1440 pixel widths, with zero axe violations on the publishing desk (desktop/mobile), composer and subscription page. Live provider behavior remains subject to the activation checks above.
