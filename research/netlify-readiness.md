# Netlify readiness and credit plan

## Current application shape

NVO is a dynamic Next.js 16 application. Its public pages, staff dashboard, orders, reservations, rewards, analytics, translations, and social queue use one asynchronous database layer. Local development can continue to use `data/nvo.sqlite`; when `NVO_DATABASE_URL` is set, the same application uses Supabase PostgreSQL instead.

The production data migration is complete: the Supabase schema contains the application tables and the SQLite data copy was checked against its source. An offline SQLite backup is retained under `data/backups/`. This makes the remaining cutover an environment-and-deploy task rather than another data import.

Built-in food images remain in `public/images` and are deployed with the site. New admin uploads and prepared social-media snapshots use the public Supabase Storage bucket `nvo-media`; database records store their durable Storage URLs. There are two legacy local uploads to copy with `npm run media:migrate:supabase` after the production environment values are present.

Netlify runs the Next.js application on demand. A bounded `social-tick` Scheduled Function runs once per minute and processes due social-delivery work, rather than starting a permanent process or ten-second polling loop. The social dashboard refreshes only while it is open.

## Required production environment values

Set these in Netlify's site environment variables. Do not commit any secret to Git or expose it with `NEXT_PUBLIC_`.

| Variable | Value / purpose |
| --- | --- |
| `NVO_DATABASE_URL` | Supabase **Transaction pooler** connection string on port `6543`, including the database password. Do not use the Session pooler on port `5432` for Netlify functions. |
| `NVO_SUPABASE_URL` | `https://fdxjjzhgpfsxsphnlkzp.supabase.co` |
| `SUPABASE_SECRET_KEY` | The server-only Supabase secret key from the project's API Keys page. A legacy `SUPABASE_SERVICE_ROLE_KEY` is also accepted during a key migration. |
| `NVO_MEDIA_BUCKET` | `nvo-media` |
| `SITE_URL` | `https://www.nvorestaurant.com` |
| `SECURE_COOKIES` | `true` |
| `SOCIAL_TOKEN_KEY` | The existing stable encryption key created by `npm run setup:social`. Do not rotate it after accounts are connected. |
| `NVO_INTERNAL_IP_KEY` | A new long random server-only secret shared by the Netlify Edge Function and application. It protects the signed visitor-IP value used for coupon limits. |
| `SOCIAL_WORKER_MODE` | `scheduled`, so the dashboard accurately reports the Netlify scheduler mode. |
| `OPENAI_API_KEY` / `OPENAI_TRANSLATION_MODEL` | Optional server-only values for automatic English/French editing translation on Netlify. Leave both blank to enter both languages manually. |

Also copy the existing private admin, Meta/Instagram, TikTok, WhatsApp, and optional Google Maps variables when those integrations are ready. `NVO_MIGRATION_DATABASE_URL` is a one-time local migration credential and must not be deployed.

If Netlify offers variable scopes, give `NVO_SUPABASE_URL`, `NVO_MEDIA_BUCKET`, and `SITE_URL` both **Builds** and **Functions** scope so Next.js can configure remote image hosting during the build and use the values at runtime. Give passwords, API keys, encryption keys, and `NVO_INTERNAL_IP_KEY` **Functions** scope only; that scope also makes the IP key available to the Edge Function. Keep production credentials restricted to the Production deploy context unless a separate staging Supabase project is created for previews.

## Deployment configuration

`.node-version` pins the Netlify build to Node 24. `netlify.toml` uses `npm run build` and schedules `netlify/functions/social-tick.ts` every minute. Netlify's current Next.js support detects the framework during deployment; no custom persistent Node server is deployed.

The application deliberately permits a local SQLite fallback only when `NVO_DATABASE_URL` is absent. Netlify requires the Supabase transaction-pooler endpoint and rejects an accidental Supabase session-pooler configuration. The database client keeps one TLS connection per warm runtime and uses parameterized queries compatible with transaction pooling.

The Edge Function signs Netlify's actual visitor-IP value before the request reaches the application. This replaces the local custom server's trusted-proxy behavior and prevents clients from choosing their own coupon-limit identity through forwarded headers.

## Remaining launch sequence

1. Add the required environment variables to Netlify, including the transaction-pooler URL and Storage secret key.
2. Add the same three database/Storage values to the private local `.env.local`, then run `npm run media:migrate:supabase` to move the two legacy uploads. Confirm it reports success.
3. Create a Netlify deploy preview. Test browsing, staff login, image upload/delete, order-to-WhatsApp handoff, reservations, coupon limits, and a social draft/queue entry.
4. Connect the repository to Netlify and deploy the production branch after the preview passes.
5. In Netlify domain settings, add `www.nvorestaurant.com`; follow its DNS records at the domain registrar, then make `www` the primary domain. Redirect the apex `nvorestaurant.com` to `https://www.nvorestaurant.com`.
6. Set the final public callback URLs in Meta, Instagram, TikTok, and WhatsApp, connect the real restaurant accounts, and make one owner-approved live test post before enabling routine campaigns.

## Readiness and cost guardrails

- The Supabase database grants no direct `anon` or `authenticated` access to application tables. The application uses its server-only database URL and Storage secret key for privileged operations.
- The Storage bucket accepts JPEG, PNG, and WebP up to 8 MB, while the Netlify admin-upload route limits incoming files to 4 MB to remain below Netlify's multipart request limit. File signatures and URLs are validated in the application as well.
- Local development uses the bundled OPUS translation models. Netlify uses an opt-in OpenAI Responses API fallback for automatic English/French editing translation, or staff can turn automatic translation off and enter both languages manually.
- The scheduled worker exits after a bounded batch. Queue leases, unique records, and provider-specific delivery state continue to protect against duplicate delivery.
- Keep provider credentials, database passwords, encryption keys, and the Storage secret key in Netlify's encrypted environment-variable store only.
- Use a deploy preview before changing live DNS, then observe actual Netlify and Supabase usage after launch. A credit target is a budget objective, not a guarantee of fixed monthly consumption.

## Verification completed in this workspace

`npm run typecheck` and `npm run build` pass with the Supabase/PostgreSQL, Storage, Edge Function, and Scheduled Function changes. The automated test command is also configured, but the current Windows host intermittently fails before loading tests because Node's `tsx` runner receives `uv_os_get_passwd ... ENOMEM` from the operating system. That is a machine resource error, not an application assertion failure; rerun it on the deployment or a healthy local session before DNS cutover.
