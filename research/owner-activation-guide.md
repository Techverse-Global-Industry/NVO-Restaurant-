# NVO: owner setup and daily use

## What staff can do now

- **Coupons:** a guest enters their name and claims a royal NVO card. Their name, date, unique code and download request are recorded. The PNG includes the restaurant contact details, validity, conditions and a staff verification QR code.
- **One claim per IP per offer:** another browser on the same network sees “claimed.” Shared Wi-Fi also counts as one IP, as requested. Increasing the offer quantity releases cards for new networks. A changed IP/VPN is a different address; this is not verified customer identity. Older claims created before this upgrade have no historical IP to check; owners can add their name to an unnamed older card, which associates its current network without changing its original code or terms.
- **Redeeming a card:** open **Order requests → Check a coupon** (or scan its QR), compare the guest’s name, enter the actual receipt items/prices, calculate the discount and confirm payment. NVO creates a sale reference automatically. An existing cash-register receipt number is optional. Used, expired, pending-activation and website-order-held coupons cannot be redeemed again at the counter.
- **Two languages:** write a title or description in English or French. The other language fills automatically after a short pause when translation is configured. Local development uses the downloaded OPUS models; Netlify needs the optional `OPENAI_API_KEY` and `OPENAI_TRANSLATION_MODEL` values. Otherwise, switch off automatic translation and complete both sides manually. Read over dish names and offer terms: automatic translation can make mistakes.
- **Captions:** write the website story and choose its photograph. Facebook, Instagram, TikTok and WhatsApp captions appear automatically. Choose the caption language and select/deselect destinations. Caption editing is optional. All automatic caption writing uses local rules; no paid AI API or key is needed. Long offers use a neutral invitation to read the full details rather than a discount claim with missing conditions.
- **Motion:** food selection on the homepage, reveal effects and interaction feedback are available throughout the website and staff screens. The corner motion button remembers the preference; reduced-motion preferences are respected.

## What to provide for live social publishing

The production domain is **`www.nvorestaurant.com`**. Netlify will point this public HTTPS domain to the application; Supabase PostgreSQL and Storage hold durable data and photos. Localhost cannot receive provider callbacks.

| Destination | Owner needs | Private configuration | Staff step |
| --- | --- | --- | --- |
| Facebook | A Facebook Page, an account allowed to publish to it, and a Meta developer app with the necessary approved access | `META_APP_ID`, `META_APP_SECRET`, `META_API_VERSION` | **Publish everywhere → Facebook → Connect account**, authorize, then select the NVO Page |
| Instagram | A Business or Creator Instagram account and Instagram API with Instagram Login enabled in the Meta developer app | `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `META_API_VERSION` | **Publish everywhere → Instagram → Connect account**, sign in directly to Instagram, then select NVO's profile |
| TikTok | A TikTok developer app with Login Kit for Web and Content Posting API; verify `www.nvorestaurant.com` for media URLs and complete any required app review | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | Connect NVO, choose TikTok for a post, review its generated caption, confirm upload, then finish publishing in TikTok’s inbox |
| WhatsApp | A registered Cloud API business sender, WhatsApp Business Account, approved marketing templates, webhook and customers who explicitly subscribed | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, Meta app secret/version, template names/locales | Configure the webhook, connect the sender, share `/subscribe`, then select WhatsApp on posts |

**TikTok approval is uncertain for this setup.** TikTok says developer apps must not be private/personal-use apps and requires a live public website, visible Privacy/Terms links, and an end-to-end demo. NVO's TikTok controls are staff-only, so TikTok may decline production API access. The integration uses TikTok's inbox-upload flow, but that does not guarantee approval. See [TikTok's app review requirements](https://developers.tiktok.com/docs/en/app-review-guidelines) before investing time in submission.

Enter credentials in the local **`.env.local`** file or the hosting provider’s private environment-variable settings. The file is ignored by Git. Do not send passwords, access tokens or app secrets in chat. Account authorization happens in Meta/TikTok’s own browser login. You can send the public domain, Page/profile links and the names of the apps you created in chat.

Register these exact callbacks, replacing the domain:

```text
https://www.nvorestaurant.com/api/social/callback/meta
https://www.nvorestaurant.com/api/social/callback/instagram
https://www.nvorestaurant.com/api/social/callback/tiktok
https://www.nvorestaurant.com/api/social/whatsapp/webhook
```

For WhatsApp, create French and/or English **MARKETING** templates with an **IMAGE** header, **one positional body variable `{{1}}`**, and **no buttons**. Obtain Meta approval, put the exact template names and locale codes in the server configuration, and connect the sender. The server verifies the configured template shape. The variable holds the generated caption. Signed incoming **ABONNER NVO** / **JOIN NVO** messages establish subscription; **STOP** ends it. Ordering a meal does not subscribe a guest. WhatsApp marketing delivery can carry Meta charges, independently of the free caption/translation features. See [Meta’s messaging policy](https://business.whatsapp.com/policy).

Facebook and Instagram are automatic once connected. Instagram can connect directly without a Facebook Page, using a Business or Creator account. TikTok in this restaurant-only tool requires finishing the upload in TikTok; its Direct Post rules exclude private tools intended only for an internal team’s accounts. See [TikTok’s content-sharing requirements](https://developers.tiktok.com/docs/en/content-sharing-guidelines). This version publishes single-photo posts, not videos/Reels or carousels.

The exact provider permissions, webhook setup, template requirements and delivery behavior are in [the technical publishing guide](social-publishing.md). App review/approval belongs to each platform. No live account connection or live delivery has been verified yet.

## Local preparation

```powershell
npm install
npm run setup
npm run setup:social
npm run setup:translation
npm run build
npm start
```

`setup:translation` downloads two quantized bilingual models once (roughly 280 MB), into ignored `data/models`, and checks both directions. Keep that directory on the production server. Normal translation requests use the local cache and do not download models or send content to an AI provider. The worker loads models on first use and uses server CPU/RAM; this is free software, not free hosting. The models are [OPUS English–French](https://huggingface.co/Helsinki-NLP/opus-mt-en-fr) and [French–English](https://huggingface.co/Helsinki-NLP/opus-mt-fr-en), distributed under Apache-2.0, with [ONNX conversion for Transformers.js](https://huggingface.co/Xenova/opus-mt-en-fr). Preserve their license information when distributing model files.

Use `npm start` / `npm run dev`, which run `server.mjs`. This server signs the actual connection IP before passing the request to Next.js. Running bare `next start` bypasses that verification, so coupon claiming fails closed. In production configure `TRUSTED_PROXY_IPS` with the exact socket IP of the reverse proxy and `TRUSTED_IP_HEADER` with the single-valued header it **overwrites**, usually `x-real-ip`. Keep the Node port private. Do not trust arbitrary incoming forwarded headers. Test using two real networks before launch.

For production, use `SITE_URL=https://www.nvorestaurant.com`, `SECURE_COOKIES=true`, `SOCIAL_WORKER_MODE=scheduled`, and the Supabase/Netlify settings in [the Netlify readiness guide](netlify-readiness.md). Back up the retained SQLite export, social token encryption key and private configuration. Netlify's scheduled function delivers queued social work; do not run a permanent social process in Netlify.

## Optional free AI alternative

The implemented captions require no AI account. If richer AI writing is wanted later, **Cloudflare Workers AI on its Free plan** currently includes **10,000 neurons/day**, with eligible models such as Llama 3.2 3B. Free-plan requests fail after the allowance; paid plans can charge overage, and some models require billing. This is a recommendation, not a connected service or a promise of unlimited usage. See [Cloudflare’s current pricing and limits](https://developers.cloudflare.com/workers-ai/platform/pricing/).

## Verified in this workspace

The production build and all 42 backend tests passed. Browser checks passed for named coupon claims, PNG downloads, private wallets, strict IP blocking across browsers, staff discounts and receipts, actual local translation in both directions, automatic captions, publishing destination controls, TikTok review, queue cancellation and subscriber consent. The tested coupon, staff and publishing screens passed axe accessibility checks. EN/FR icon alignment and horizontal layout were checked at 320, 390 and 1440 pixels. Tests used an isolated database and sent no external posts or messages. Screenshots and check results are in `artifacts/`.
