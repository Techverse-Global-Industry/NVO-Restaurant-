import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { db, transaction, settings } from "../lib/db";
import type { Entry } from "../lib/types";
import { seal, unseal, publicSite, sha } from "../lib/social/security";
import {
  beginConnection,
  consumeState,
  finishConnection,
  pendingAccounts,
  selectAccounts,
  account,
} from "../lib/social/accounts";
import {
  queueEntry,
  getPlan,
  jobAction,
  cancelPending,
} from "../lib/social/queue";
import { claimJob, processJob, recoverExpired } from "../lib/social/worker";
import {
  standardCaptions,
  payloadFor,
  generateCaptions,
} from "../lib/social/captions";
import { ProviderError, graph, accountToken } from "../lib/social/providers";
import {
  verifyWhatsAppSignature,
  processWhatsAppWebhook,
  connectWhatsApp,
} from "../lib/social/whatsapp";
import { prepareImage } from "../lib/social/media";
import type { Job, Platform, SocialPlan } from "../lib/social/types";
process.env.NVO_DB_PATH = ":memory:";
process.env.ADMIN_PASSWORD = "";
process.env.SOCIAL_TOKEN_KEY = randomBytes(32).toString("base64");
process.env.SITE_URL = "https://restaurant.example.com";
process.env.META_APP_ID = "test-app";
process.env.META_APP_SECRET = "test-secret";
process.env.META_API_VERSION = "v99.0";
const mediaDir = mkdtempSync(path.resolve("data/social-test-"));
process.env.SOCIAL_MEDIA_DIR = mediaDir;
after(() => {
  const root = path.resolve("data");
  assert.ok(mediaDir.startsWith(root + path.sep));
  rmSync(mediaDir, { recursive: true, force: true });
});
beforeEach(() => {
  for (const name of [
    "whatsapp_deliveries",
    "whatsapp_subscribers",
    "whatsapp_inbound",
    "social_attempts",
    "social_jobs",
    "social_plans",
    "social_accounts",
    "social_oauth",
    "social_caption_cache",
    "social_config",
  ])
    db().exec(`DELETE FROM ${name}`);
  db()
    .prepare(
      "INSERT OR IGNORE INTO staff VALUES('social-owner','social-test@nvo.local','unused','owner')",
    )
    .run();
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_CAPTION_MODEL;
});
const post = (overrides: Partial<Entry> = {}): Entry => ({
  id: randomUUID(),
  kind: "posts",
  title: "Lunch at NVO",
  titleFr: "Un déjeuner chez NVO",
  description: "Fish and rice for your next visit.",
  descriptionFr: "Du poisson et du riz pour votre prochaine visite.",
  image: "/images/banga.jpeg",
  active: true,
  status: "published",
  sort: 1,
  ...overrides,
});
function addAccount(platform: Platform, id = platform, automatic = true) {
  const now = new Date().toISOString();
  db()
    .prepare(
      "INSERT INTO social_accounts VALUES(?,?,?,?,?,?,'connected',?,?,?)",
    )
    .run(
      id,
      platform,
      `${platform}-remote`,
      `${platform} restaurant`,
      seal(
        platform === "tiktok"
          ? JSON.stringify({
              access_token: "secret-token",
              refresh_token: "refresh-token",
            })
          : "secret-token",
        id,
      ),
      Date.now() + 3600000,
      automatic ? 1 : 0,
      now,
      now,
    );
  return id;
}
async function save(e: Entry, plan?: unknown) {
  await transaction(async () => {
    await db()
      .prepare(
        "INSERT INTO entries VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      )
      .run(e.id, e.kind, JSON.stringify(e));
    await queueEntry(e, plan);
  });
}
const rows = () => db().prepare("SELECT * FROM social_jobs").all() as Job[];
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
const fakeImage = async () =>
  "https://restaurant.example.com/social-media/test-image";
function mockGraph(calls: string[] = []): typeof fetch {
  return (async (input, init) => {
    const url = String(input);
    calls.push(`${init?.method} ${url.split("?")[0]}`);
    if (url.includes("/photos")) return response({ id: "photo-1" });
    if (url.includes("/feed")) return response({ id: "page_post-1" });
    if (url.includes("/media_publish"))
      return response({ id: "instagram-post-1" });
    if (url.endsWith("/media")) return response({ id: "container-1" });
    if (url.includes("container-1"))
      return response({ status_code: "FINISHED" });
    return response({
      permalink: "https://www.instagram.com/p/test/",
      permalink_url: "https://www.facebook.com/posts/test",
    });
  }) as typeof fetch;
}
test("encrypted credentials are bound to the account and detect tampering", () => {
  const secret = seal("secret", "one");
  assert.equal(unseal(secret, "one"), "secret");
  assert.throws(() => unseal(secret, "two"));
  assert.throws(() => unseal(secret.slice(0, -3) + "xyz", "one"));
  assert.ok(!secret.includes("secret"));
  const site = process.env.SITE_URL;
  for (const value of [
    "http://localhost:3000",
    "https://127.0.0.1",
    "https://user:password@example.com",
    "https://example.com/sub",
  ]) {
    process.env.SITE_URL = value;
    assert.throws(publicSite);
  }
  process.env.SITE_URL = site;
});
test("OAuth state rejects another browser, wrong provider and replay", async () => {
  const start = await beginConnection("social-owner", "meta");
  const state = new URL(start.url).searchParams.get("state")!;
  await assert.rejects(consumeState(state, "wrong", "meta"));
  await assert.rejects(consumeState(state, start.cookie, "tiktok"));
  assert.equal(
    (await consumeState(state, start.cookie, "meta")).staff_id,
    "social-owner",
  );
  await assert.rejects(consumeState(state, start.cookie, "meta"));
});
test("OAuth connects only selected eligible accounts without backfilling posts", async () => {
  const start = await beginConnection("social-owner", "meta");
  const state = new URL(start.url).searchParams.get("state")!;
  const fetcher = (async (input) =>
    String(input).includes("oauth/access_token")
      ? response({ access_token: "granted", expires_in: 3600 })
      : response({
          data: [
            {
              id: "page",
              name: "NVO Page",
              access_token: "page-token",
              tasks: ["CREATE_CONTENT"],
              instagram_business_account: { id: "ig", username: "nvo" },
            },
          ],
        })) as typeof fetch;
  await finishConnection(state, start.cookie, "meta", "code", fetcher);
  const candidates = await pendingAccounts("social-owner");
  assert.equal(candidates.length, 2);
  assert.ok(candidates.every((c) => !("token" in c)));
  await selectAccounts("social-owner", [candidates[1].id], true);
  assert.equal(
    db().prepare("SELECT count(*) AS n FROM social_accounts").get()!.n,
    1,
  );
  assert.equal(rows().length, 0);
  assert.equal((await pendingAccounts("social-owner")).length, 0);
});
test("Instagram Login trusts the profile from its exchanged token when Meta serializes a large user ID", async () => {
  const previousId = process.env.INSTAGRAM_APP_ID;
  const previousSecret = process.env.INSTAGRAM_APP_SECRET;
  process.env.INSTAGRAM_APP_ID = "instagram-test-app";
  process.env.INSTAGRAM_APP_SECRET = "instagram-test-secret";
  try {
    const start = await beginConnection("social-owner", "instagram");
    const state = new URL(start.url).searchParams.get("state")!;
    const fetcher = (async (input) => {
      const url = String(input);
      if (url.includes("api.instagram.com/oauth/access_token"))
        // Deliberately above Number.MAX_SAFE_INTEGER, as Meta can return IDs this way.
        return response({ access_token: "short-token", user_id: 9007199254740993 });
      if (url.startsWith("https://graph.instagram.com/access_token"))
        return response({ access_token: "long-token", expires_in: 3600 });
      return response({ user_id: "9007199254740993", username: "nvo" });
    }) as typeof fetch;
    await finishConnection(state, start.cookie, "instagram", "code", fetcher);
    const candidates = await pendingAccounts("social-owner");
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].remote_id, "9007199254740993");
    assert.equal(candidates[0].name, "@nvo");
  } finally {
    if (previousId === undefined) delete process.env.INSTAGRAM_APP_ID;
    else process.env.INSTAGRAM_APP_ID = previousId;
    if (previousSecret === undefined) delete process.env.INSTAGRAM_APP_SECRET;
    else process.env.INSTAGRAM_APP_SECRET = previousSecret;
  }
});
test("website save and outbox roll back together on invalid social input", async () => {
  const e = post();
  await assert.rejects(save(e, { mode: "wrong" }));
  assert.equal(
    db().prepare("SELECT id FROM entries WHERE id=?").get(e.id),
    undefined,
  );
  assert.equal(rows().length, 0);
});
test("defaults, explicit destinations, website only, samples and drafts are respected", async () => {
  addAccount("facebook");
  addAccount("instagram");
  const e = post();
  await save(e);
  assert.equal(rows().length, 2);
  await save(e, { mode: "selected", accounts: ["facebook"] });
  assert.equal(
    rows().find((j) => j.account_id === "instagram")!.status,
    "cancelled",
  );
  await save(e, { mode: "off" });
  assert.ok(rows().every((j) => j.status === "cancelled"));
  for (const overrides of [
    { demo: true },
    { status: "draft" as const },
    { active: false },
    { endsAt: new Date(Date.now() - 1000).toISOString() },
    { kind: "meals" as const },
  ])
    await save(post(overrides));
  assert.equal(rows().length, 2);
});
test("scheduled posts wait; repeat saves do not duplicate; edits update only unsent jobs", async () => {
  addAccount("facebook");
  const e = post({ startsAt: new Date(Date.now() + 3600000).toISOString() });
  await save(e);
  assert.equal(await claimJob(), undefined);
  await save({ ...e, startsAt: undefined });
  const calls: string[] = [];
  await processJob((await claimJob())!, mockGraph(calls), fakeImage);
  assert.equal(rows()[0].status, "published");
  assert.equal(rows()[0].provider_id, "page_post-1");
  await save({ ...e, startsAt: undefined, title: "Changed title" });
  assert.equal(rows().length, 1);
  assert.equal(rows()[0].status, "published");
  assert.equal(calls.filter((c) => c.includes("/feed")).length, 1);
});
test("Facebook and Instagram publish independently; provider tokens stay out of payloads", async () => {
  addAccount("facebook");
  addAccount("instagram");
  await save(post());
  const calls: string[] = [];
  for (let i = 0; i < 2; i++)
    await processJob((await claimJob())!, mockGraph(calls), fakeImage);
  assert.ok(rows().every((j) => j.status === "published"));
  assert.ok(rows().every((j) => !j.payload.includes("secret-token")));
  const captions = rows().map((j) => JSON.parse(j.payload).caption);
  assert.notEqual(captions[0], captions[1]);
  assert.ok(captions.some((c) => c.includes("utm_source=facebook")));
});
test("uncertain final POST is never blindly retried", async () => {
  addAccount("facebook");
  await save(post());
  const normal = mockGraph();
  const fetcher = (async (input, init) => {
    if (String(input).includes("/feed"))
      throw new Error("network timeout SECRET");
    return normal(input, init);
  }) as typeof fetch;
  await processJob((await claimJob())!, fetcher, fakeImage);
  const j = rows()[0];
  assert.equal(j.status, "needs_review");
  assert.equal(await claimJob(), undefined);
  assert.ok(!j.last_error?.includes("SECRET"));
  await assert.rejects(jobAction(j.id, "retry"));
  await jobAction(j.id, "retry", true);
  assert.equal(rows()[0].status, "queued");
});
test("auth failures pause the affected account while other destinations continue", async () => {
  addAccount("facebook");
  addAccount("instagram");
  await save(post());
  const j = (await claimJob())!;
  const fetcher = (async () =>
    response(
      { error: { code: 190, message: "private token value" } },
      400,
    )) as typeof fetch;
  await processJob(j, fetcher, fakeImage);
  assert.equal((await account(j.account_id))!.status, "reconnect");
  assert.equal(rows().find((r) => r.id === j.id)!.status, "needs_auth");
  await processJob((await claimJob())!, mockGraph(), fakeImage);
  assert.equal(rows().filter((j) => j.status === "published").length, 1);
});
test("archiving or editing a leased post prevents its stale payload from being sent", async () => {
  addAccount("facebook");
  const e = post();
  await save(e);
  const leased = (await claimJob())!;
  await cancelPending(e.id);
  const calls: string[] = [];
  await processJob(leased, mockGraph(calls), fakeImage);
  assert.equal(rows()[0].status, "cancelled");
  assert.equal(calls.length, 0);
});
test("a worker crash retries preparation but flags an uncertain publication", async () => {
  addAccount("facebook");
  addAccount("instagram");
  await save(post());
  db()
    .prepare(
      "UPDATE social_jobs SET status='preparing',lease_until=? WHERE account_id='facebook'",
    )
    .run(Date.now() - 1);
  db()
    .prepare(
      "UPDATE social_jobs SET status='publishing',lease_until=? WHERE account_id='instagram'",
    )
    .run(Date.now() - 1);
  await recoverExpired();
  assert.equal(
    rows().find((j) => j.account_id === "facebook")!.status,
    "retry",
  );
  assert.equal(
    rows().find((j) => j.account_id === "instagram")!.status,
    "needs_review",
  );
});
test("TikTok needs per-post consent and records inbox handoff separately from publication", async () => {
  addAccount("tiktok", "tiktok", false);
  const e = post();
  const plan = {
    mode: "selected",
    accounts: ["tiktok"],
    captions: { tiktok: "Lunch at NVO. #Cotonou" },
  };
  await save(e, plan);
  assert.equal(rows().length, 0);
  await save(e, { ...plan, tiktokConsent: true });
  assert.equal(rows().length, 1);
  assert.equal((await getPlan(e.id)).tiktokConsent, false);
  const bodies: any[] = [];
  const fetcher = (async (_input, init) => {
    const b = JSON.parse(String(init?.body));
    bodies.push(b);
    return response({
      data: b.publish_id
        ? { status: "SEND_TO_USER_INBOX" }
        : { publish_id: "publish-1" },
      error: { code: "ok" },
    });
  }) as typeof fetch;
  await processJob((await claimJob())!, fetcher, fakeImage);
  assert.equal(rows()[0].status, "processing");
  assert.equal(bodies[0].post_mode, "MEDIA_UPLOAD");
  db().prepare("UPDATE social_jobs SET next_attempt=0").run();
  await processJob((await claimJob())!, fetcher, fakeImage);
  assert.equal(rows()[0].status, "inbox");
});
test("TikTok expired access tokens refresh and persist encrypted refresh credentials", async () => {
  addAccount("tiktok");
  db().prepare("UPDATE social_accounts SET expires_at=0").run();
  const fetcher = (async () =>
    response({
      access_token: "fresh",
      refresh_token: "new-refresh",
      open_id: "tiktok-remote",
      expires_in: 3600,
    })) as typeof fetch;
  assert.equal(await accountToken((await account("tiktok"))!, fetcher), "fresh");
  assert.ok(!(await account("tiktok"))!.token.includes("fresh"));
  assert.ok(unseal((await account("tiktok"))!.token, "tiktok").includes("new-refresh"));
});
test("four distinct standard captions preserve facts, contact number and attribution links", async () => {
  const e = post({
    kind: "events",
    date: new Date(Date.now() + 3600000).toISOString(),
  });
  const captions = standardCaptions(
    payloadFor(e, "fr", "standard", await settings(), publicSite()),
  );
  assert.equal(new Set(Object.values(captions)).size, 4);
  assert.ok(captions.facebook.includes("utm_source=facebook"));
  assert.ok(captions.whatsapp.includes("utm_source=whatsapp"));
  assert.ok(captions.whatsapp.includes("STOP"));
  assert.ok(captions.instagram.includes((await settings()).whatsapp));
  assert.ok(!captions.instagram.includes("link in bio"));
});
test("AI produces four structured captions in one request and caches the result", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_CAPTION_MODEL = "test-model";
  let count = 0;
  const p = payloadFor(post(), "fr", "ai", await settings(), publicSite());
  const captions = {
    facebook: "Facebook NVO",
    instagram: "Instagram NVO",
    tiktok: "TikTok NVO",
    whatsapp: "WhatsApp NVO STOP",
  };
  const fetcher = (async (_url, init) => {
    count++;
    const sent = JSON.parse(String(init?.body));
    assert.equal(sent.store, false);
    assert.equal(sent.text.format.type, "json_schema");
    assert.equal(sent.text.format.schema.required.length, 4);
    return response({
      status: "completed",
      output: [
        { content: [{ type: "output_text", text: JSON.stringify(captions) }] },
      ],
    });
  }) as typeof fetch;
  assert.deepEqual(
    (await generateCaptions(p, true, fetcher)).captions,
    captions,
  );
  await generateCaptions(p, true, fetcher);
  assert.equal(count, 1);
  const another = payloadFor(post(), "fr", "ai", await settings(), publicSite());
  await assert.rejects(() =>
    generateCaptions(another, true, (async () =>
      response({
        status: "completed",
        output: [{ content: [{ type: "refusal", refusal: "no" }] }],
      })) as typeof fetch),
  );
});
function webhook(
  text: string,
  id: string = randomUUID(),
  timestamp = Math.floor(Date.now() / 1000),
  from = "22912345678",
) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: "whatsapp-remote" },
              contacts: [{ wa_id: from, profile: { name: "Guest" } }],
              messages: [
                {
                  id,
                  from,
                  timestamp: String(timestamp),
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}
test("WhatsApp webhook signatures, explicit opt-in, deduplication and STOP ordering", async () => {
  addAccount("whatsapp");
  const raw = Buffer.from(JSON.stringify(webhook("JOIN NVO")));
  const signature =
    "sha256=" +
    createHmac("sha256", process.env.META_APP_SECRET!)
      .update(raw)
      .digest("hex");
  assert.ok(verifyWhatsAppSignature(raw, signature));
  assert.ok(!verifyWhatsAppSignature(Buffer.from("tampered"), signature));
  await processWhatsAppWebhook(webhook("I want food"));
  assert.equal(
    db().prepare("SELECT count(*) AS n FROM whatsapp_subscribers").get()!.n,
    0,
  );
  const ts = Math.floor(Date.now() / 1000);
  const join = webhook("ABONNER NVO", "unique-join", ts - 5);
  await processWhatsAppWebhook(join);
  await processWhatsAppWebhook(join);
  assert.equal(
    db().prepare("SELECT count(*) AS n FROM whatsapp_subscribers").get()!.n,
    1,
  );
  await processWhatsAppWebhook(webhook("STOP", "stop", ts));
  await processWhatsAppWebhook(webhook("JOIN NVO", "delayed-join", ts - 2));
  assert.equal(
    db().prepare("SELECT status FROM whatsapp_subscribers").get()!.status,
    "unsubscribed",
  );
});
test("WhatsApp setup validates a real approved template before connecting", async () => {
  Object.assign(process.env, {
    WHATSAPP_ACCESS_TOKEN: "wa-token",
    WHATSAPP_PHONE_NUMBER_ID: "phone-id",
    WHATSAPP_BUSINESS_ACCOUNT_ID: "business-id",
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: "verify",
    WHATSAPP_TEMPLATE_FR: "nvo_updates",
  });
  const fetcher = (async (input) =>
    String(input).includes("message_templates")
      ? response({
          data: [
            {
              name: "nvo_updates",
              status: "APPROVED",
              category: "MARKETING",
              language: "fr",
              components: [
                { type: "HEADER", format: "IMAGE" },
                { type: "BODY", text: "NVO : {{1}}. Merci de votre visite." },
              ],
            },
          ],
        })
      : response({
          id: "phone-id",
          display_phone_number: "+229 50924184",
          verified_name: "NVO",
        })) as typeof fetch;
  await connectWhatsApp(fetcher);
  assert.equal((await account("whatsapp-business"))?.platform, "whatsapp");
  assert.equal((await account("whatsapp-business"))?.auto_publish, 0);
  assert.equal(
    unseal((await account("whatsapp-business"))!.token, "whatsapp-business"),
    "wa-token",
  );
});
test("WhatsApp only sends to subscribers and tracks individual receipts, without resending", async () => {
  addAccount("whatsapp");
  db()
    .prepare("INSERT INTO social_config VALUES('whatsapp',?)")
    .run(
      JSON.stringify({
        phone: "22950924184",
        templates: { fr: { name: "nvo_updates", language: "fr" } },
      }),
    );
  await processWhatsAppWebhook(
    webhook("JOIN NVO", "one", Math.floor(Date.now() / 1000), "22912345678"),
  );
  await processWhatsAppWebhook(
    webhook("JOIN NVO", "two", Math.floor(Date.now() / 1000), "22987654321"),
  );
  await processWhatsAppWebhook(
    webhook(
      "STOP",
      "stop-two",
      Math.floor(Date.now() / 1000) + 1,
      "22987654321",
    ),
  );
  const e = post();
  await save(e);
  let sends = 0;
  const fetcher = (async (_url, init) => {
    sends++;
    const b = JSON.parse(String(init?.body));
    assert.equal(b.to, "22912345678");
    assert.equal(b.type, "template");
    assert.equal(b.template.components[0].parameters[0].type, "image");
    return response({ messages: [{ id: "wamid.one" }] });
  }) as typeof fetch;
  await processJob((await claimJob())!, fetcher, fakeImage);
  assert.equal(sends, 1);
  assert.equal(rows()[0].status, "published");
  assert.equal(
    db().prepare("SELECT status FROM whatsapp_deliveries").get()!.status,
    "sent",
  );
  await save(e);
  assert.equal(await claimJob(), undefined);
  await processWhatsAppWebhook({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: "whatsapp-remote" },
              statuses: [
                { id: "wamid.one", status: "read" },
                { id: "wamid.one", status: "sent" },
              ],
            },
          },
        ],
      },
    ],
  });
  assert.equal(
    db().prepare("SELECT status FROM whatsapp_deliveries").get()!.status,
    "read",
  );
});
test("WhatsApp timeout quarantines that recipient; retry requires an explicit check", async () => {
  addAccount("whatsapp");
  db()
    .prepare("INSERT INTO social_config VALUES('whatsapp',?)")
    .run(
      JSON.stringify({ templates: { fr: { name: "test", language: "fr" } } }),
    );
  await processWhatsAppWebhook(webhook("JOIN NVO"));
  await save(post());
  await processJob(
    (await claimJob())!,
    (async () => {
      throw new Error("timeout");
    }) as typeof fetch,
    fakeImage,
  );
  assert.equal(rows()[0].status, "needs_review");
  assert.equal(
    db().prepare("SELECT status FROM whatsapp_deliveries").get()!.status,
    "needs_review",
  );
  await assert.rejects(jobAction(rows()[0].id, "retry"));
  await jobAction(rows()[0].id, "retry", true);
  assert.equal(
    db().prepare("SELECT status FROM whatsapp_deliveries").get()!.status,
    "queued",
  );
});
test("media becomes a public JPEG snapshot with safe dimensions and path validation", async () => {
  const url = await prepareImage("/images/banga.jpeg");
  assert.equal(
    await prepareImage("/images/banga.jpeg"),
    url,
    "Reuse the same normalized photo across destinations",
  );
  const id = new URL(url).pathname.split("/").pop()!;
  const buffer = readFileSync(path.join(mediaDir, `${id}.jpg`));
  const info = await sharp(buffer).metadata();
  assert.equal(info.format, "jpeg");
  assert.equal(info.width, 1080);
  assert.equal(info.height, 1350);
  for (const unsafe of [
    "https://example.com/a.jpg",
    "/uploads/../../.env.local",
    "/images/..",
    "/private/password.txt",
  ])
    await assert.rejects(() => prepareImage(unsafe));
});
test("Meta errors never expose response messages containing credentials", async () => {
  await assert.rejects(
    () =>
      graph("test", "secret", {}, "POST", true, (async () =>
        response(
          { error: { code: 190, message: "TOKEN_SECRET" } },
          400,
        )) as typeof fetch),
    (e: unknown) =>
      e instanceof ProviderError &&
      e.kind === "auth" &&
      !e.message.includes("TOKEN_SECRET"),
  );
});
