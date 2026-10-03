import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { db, transaction } from "../lib/db";
import { seal } from "../lib/social/security";
import { queueEntry } from "../lib/social/queue";
import { claimJob, processJob } from "../lib/social/worker";
import { processWhatsAppWebhook } from "../lib/social/whatsapp";
import type { Entry } from "../lib/types";
import type { Job, Platform } from "../lib/social/types";
process.env.NVO_DB_PATH = ":memory:";
process.env.ADMIN_PASSWORD = "";
process.env.SOCIAL_TOKEN_KEY = randomBytes(32).toString("base64");
process.env.META_API_VERSION = "v99.0";
process.env.SITE_URL = "https://restaurant.example.com";
beforeEach(() => {
  for (const t of [
    "whatsapp_deliveries",
    "whatsapp_subscribers",
    "whatsapp_inbound",
    "social_attempts",
    "social_jobs",
    "social_plans",
    "social_accounts",
    "social_config",
  ])
    db().exec(`DELETE FROM ${t}`);
});
function account(p: Platform) {
  const now = new Date().toISOString();
  db()
    .prepare(
      "INSERT INTO social_accounts VALUES(?,?,?,?,?,NULL,'connected',1,?,?)",
    )
    .run(p, p, p, p, seal("test", p), now, now);
}
async function save(description = "Our next restaurant story.") {
  const e: Entry = {
    id: randomUUID(),
    kind: "posts",
    title: "NVO",
    description,
    image: "/images/banga.jpeg",
    active: true,
    status: "published",
    sort: 1,
  };
  await transaction(async () => {
    await db()
      .prepare("INSERT INTO entries VALUES(?,?,?)")
      .run(e.id, e.kind, JSON.stringify(e));
    await queueEntry(e);
  });
  return e;
}
const jobs = () => db().prepare("SELECT * FROM social_jobs").all() as Job[];
const response = (data: unknown) =>
  new Response(JSON.stringify(data), { status: 200 });
const media = async () => "https://restaurant.example.com/social-media/example";
test("separate workers cannot concurrently claim two jobs for the same account", async () => {
  account("facebook");
  await save();
  await save();
  assert.ok(await claimJob());
  assert.equal(await claimJob(), undefined);
  account("instagram");
  await save();
  assert.equal((await claimJob())?.account_id, "instagram");
});
test("long WhatsApp copy automatically uses a full-details teaser without blocking Facebook", async () => {
  account("facebook");
  account("whatsapp");
  const source =
    "A restaurant update. ".repeat(50) + "Offer requires a reservation.";
  await save(source);
  const fetcher = (async (input) =>
    response(
      String(input).includes("/photos")
        ? { id: "photo" }
        : String(input).includes("/feed")
          ? { id: "post" }
          : { permalink_url: "https://www.facebook.com/post" },
    )) as typeof fetch;
  await processJob((await claimJob())!, fetcher, media);
  await processJob((await claimJob())!, fetcher, media);
  assert.equal(
    jobs().find((j) => j.account_id === "facebook")!.status,
    "published",
  );
  const whatsapp = JSON.parse(jobs().find(j => j.account_id === "whatsapp")!.payload).caption;
  assert.ok(whatsapp.length <= 900);
  assert.ok(whatsapp.includes("conditions"));
  assert.ok(whatsapp.includes("utm_source=whatsapp"));
  assert.ok(!/too long/.test(jobs().find(j => j.account_id === "whatsapp")!.last_error || ""));
  assert.ok(
    JSON.parse(
      jobs().find((j) => j.account_id === "facebook")!.payload,
    ).caption.includes("Offer requires a reservation."),
  );
});
test("STOP received during a batch prevents the next recipient's message", async () => {
  account("whatsapp");
  const now = new Date().toISOString();
  for (const phone of ["22912345678", "22987654321"])
    db()
      .prepare(
        "INSERT INTO whatsapp_subscribers VALUES(?,'Guest','subscribed',?,?,'test',0)",
      )
      .run(phone, now, now);
  db()
    .prepare("INSERT INTO social_config VALUES('whatsapp',?)")
    .run(
      JSON.stringify({
        templates: { fr: { name: "approved", language: "fr" } },
      }),
    );
  await save();
  const sent: string[] = [];
  const fetcher = (async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    sent.push(body.to);
    const other = body.to === "22912345678" ? "22987654321" : "22912345678";
    await processWhatsAppWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "whatsapp" },
                messages: [
                  {
                    id: "stop-mid-batch",
                    from: other,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    text: { body: "STOP" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    return response({ messages: [{ id: "confirmed" }] });
  }) as typeof fetch;
  await processJob((await claimJob())!, fetcher, media);
  assert.equal(sent.length, 1);
  assert.equal(
    (
      db()
        .prepare(
          "SELECT count(*) AS n FROM whatsapp_deliveries WHERE status='skipped'",
        )
        .get() as { n: number }
    ).n,
    1,
  );
});
test("a post expiring during photo preparation is not sent", async () => {
  account("facebook");
  const e = await save();
  let finalCalls = 0;
  const fetcher = (async (input) => {
    if (String(input).includes("/feed")) finalCalls++;
    return response({ id: "photo" });
  }) as typeof fetch;
  await processJob((await claimJob())!, fetcher, async () => {
    db()
      .prepare("UPDATE entries SET data=? WHERE id=?")
      .run(
        JSON.stringify({
          ...e,
          endsAt: new Date(Date.now() - 1000).toISOString(),
        }),
        e.id,
      );
    return media();
  });
  assert.equal(finalCalls, 0);
  assert.equal(jobs()[0].status, "cancelled");
});
