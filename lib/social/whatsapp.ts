import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { db, transaction } from "../db";
import { graph, ProviderError } from "./providers";
import { metaVersion, publicSite, seal } from "./security";
import type { Account, Job, Language } from "./types";
export function whatsappReadiness() {
  const reasons: string[] = [];
  try {
    publicSite();
    metaVersion();
    seal("check", "check");
  } catch {
    reasons.push("Complete the public website and social security setup.");
  }
  for (const name of [
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_BUSINESS_ACCOUNT_ID",
    "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
    "META_APP_SECRET",
  ])
    if (!process.env[name])
      reasons.push(
        `${name.toLowerCase().replaceAll("_", " ")} is missing from server setup.`,
      );
  if (!process.env.WHATSAPP_TEMPLATE_FR && !process.env.WHATSAPP_TEMPLATE_EN)
    reasons.push("An approved WhatsApp marketing template is required.");
  return { ready: !reasons.length, reasons };
}
type Config = {
  phone: string;
  templates: Partial<Record<Language, { name: string; language: string }>>;
};
export async function whatsappConfig(): Promise<Config | null> {
  const row = await db()
    .prepare("SELECT data FROM social_config WHERE key='whatsapp'")
    .get() as { data: string } | undefined;
  return row ? JSON.parse(row.data) : null;
}
export async function connectWhatsApp(fetcher: typeof fetch = fetch) {
  const ready = whatsappReadiness();
  if (!ready.ready) throw new Error(ready.reasons.join(" "));
  const token = process.env.WHATSAPP_ACCESS_TOKEN!;
  const info = await graph(
    process.env.WHATSAPP_PHONE_NUMBER_ID!,
    token,
    { fields: "id,display_phone_number,verified_name" },
    "GET",
    false,
    fetcher,
  );
  const config: Config = {
    phone: String(info.display_phone_number).replace(/\D/g, ""),
    templates: {},
  };
  if (!/^\d{8,15}$/.test(config.phone))
    throw new Error("WhatsApp did not return a valid business number.");
  for (const language of ["fr", "en"] as const) {
    const name = process.env[`WHATSAPP_TEMPLATE_${language.toUpperCase()}`];
    if (!name) continue;
    const result = await graph(
      `${process.env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`,
      token,
      {
        name,
        fields: "name,status,language,category,components,parameter_format",
      },
      "GET",
      false,
      fetcher,
    );
    const t = (result.data || []).find(
      (t: any) =>
        t.name === name &&
        t.status === "APPROVED" &&
        t.language ===
          (language === "en"
            ? process.env.WHATSAPP_TEMPLATE_EN_LOCALE || "en"
            : process.env.WHATSAPP_TEMPLATE_FR_LOCALE || "fr"),
    );
    const components = t?.components || [];
    const body = components.find((c: any) => c.type === "BODY");
    if (
      !t ||
      t.category !== "MARKETING" ||
      t.parameter_format === "NAMED" ||
      !components.some(
        (c: any) => c.type === "HEADER" && c.format === "IMAGE",
      ) ||
      (body?.text.match(/\{\{[^}]+\}\}/g) || []).join(",") !== "{{1}}" ||
      components.some((c: any) => c.type === "BUTTONS")
    )
      throw new Error(
        `The ${language.toUpperCase()} WhatsApp template must be approved MARKETING content with an IMAGE header, one positional body variable {{1}}, and no buttons.`,
      );
    config.templates[language] = { name, language: t.language };
  }
  const now = new Date().toISOString(),
    id = "whatsapp-business";
  await transaction(async () => {
    await db()
      .prepare(
        "INSERT INTO social_accounts VALUES(?,'whatsapp',?,?,?,?, 'connected',false,?,?) ON CONFLICT(id) DO UPDATE SET remote_id=excluded.remote_id,name=excluded.name,token=excluded.token,status='connected',updated_at=excluded.updated_at",
      )
      .run(
        id,
        info.id,
        `${info.verified_name || "NVO"} · +${config.phone}`,
        seal(token, id),
        null,
        now,
        now,
      );
    await db()
      .prepare("INSERT OR REPLACE INTO social_config VALUES('whatsapp',?)")
      .run(JSON.stringify(config));
  });
}
export function verifyWhatsAppSignature(raw: Buffer, signature: string) {
  if (!process.env.META_APP_SECRET || !/^sha256=[a-f0-9]{64}$/.test(signature))
    return false;
  const expected = createHmac("sha256", process.env.META_APP_SECRET)
    .update(raw)
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}
export async function processWhatsAppWebhook(body: any) {
  if (body.object !== "whatsapp_business_account") return;
  return transaction(async () => {
    for (const e of body.entry || [])
      for (const change of e.changes || []) {
        const value = change.value;
        if (!value || change.field !== "messages") continue;
        const connected = await db()
          .prepare(
            "SELECT id FROM social_accounts WHERE platform='whatsapp' AND remote_id=?",
          )
          .get(String(value.metadata?.phone_number_id || ""));
        if (!connected) continue;
        for (const message of value.messages || []) {
          if (
            typeof message.id !== "string" ||
            !/^\d{8,15}$/.test(String(message.from))
          )
            continue;
          const ts = Number(message.timestamp);
          if (!Number.isFinite(ts) || ts > Date.now() / 1000 + 300) continue;
          const inserted = await db()
            .prepare("INSERT OR IGNORE INTO whatsapp_inbound VALUES(?,?)")
            .run(message.id, new Date().toISOString());
          if (!inserted.changes) continue;
          const text = String(message.text?.body || message.button?.text || "")
            .trim()
            .toUpperCase()
            .replace(/[’']/g, "");
          const joined = [
            "ABONNER NVO",
            "SABONNER NVO",
            "JOIN NVO",
            "SUBSCRIBE NVO",
          ].includes(text);
          const stopped = [
            "STOP",
            "STOP NVO",
            "UNSUBSCRIBE",
            "DESABONNER",
            "DÉSABONNER",
            "ARRET",
            "ARRÊT",
          ].includes(text);
          if (!joined && !stopped) continue;
          const phone = message.from;
          const old = await db()
            .prepare(
              "SELECT last_timestamp,status FROM whatsapp_subscribers WHERE phone=?",
            )
            .get(phone) as
            { last_timestamp: number; status: string } | undefined;
          if (
            old &&
            (old.last_timestamp > ts ||
              (old.last_timestamp === ts && old.status === "unsubscribed"))
          )
            continue;
          const name = String(
              (value.contacts || []).find((c: any) => c.wa_id === phone)
                ?.profile?.name || "",
            ).slice(0, 120),
            now = new Date().toISOString();
          await db()
            .prepare(
              "INSERT INTO whatsapp_subscribers VALUES(?,?,?,?,?,?,?) ON CONFLICT(phone) DO UPDATE SET name=excluded.name,status=excluded.status,consented_at=CASE WHEN excluded.status='subscribed' THEN excluded.consented_at ELSE whatsapp_subscribers.consented_at END,changed_at=excluded.changed_at,source=excluded.source,last_timestamp=excluded.last_timestamp",
            )
            .run(
              phone,
              name,
              joined ? "subscribed" : "unsubscribed",
              new Date(ts * 1000).toISOString(),
              now,
              `whatsapp:${message.id}`,
              ts,
            );
          if (stopped)
            await db()
              .prepare(
                "UPDATE whatsapp_deliveries SET status='skipped',last_error='Customer unsubscribed.',updated_at=? WHERE phone=? AND status IN ('queued','failed','needs_review')",
              )
              .run(now, phone);
        }
        for (const receipt of value.statuses || []) {
          if (!["sent", "delivered", "read", "failed"].includes(receipt.status))
            continue;
          const previous = await db()
            .prepare(
              "SELECT id,status,job_id FROM whatsapp_deliveries WHERE provider_id=?",
            )
            .get(String(receipt.id)) as
            { id: string; status: string; job_id: string } | undefined;
          if (!previous) continue;
          const rank: Record<string, number> = {
            sending: 0,
            sent: 1,
            failed: 2,
            delivered: 3,
            read: 4,
          };
          if ((rank[receipt.status] || 0) > (rank[previous.status] || 0)) {
            await db()
              .prepare(
                "UPDATE whatsapp_deliveries SET status=?,last_error=?,updated_at=? WHERE id=?",
              )
              .run(
                receipt.status,
                receipt.status === "failed"
                  ? "WhatsApp could not deliver this message. Check the recipient or account in WhatsApp Manager."
                  : null,
                new Date().toISOString(),
                previous.id,
              );
            if (receipt.status === "failed")
              await db()
                .prepare(
                  "UPDATE social_jobs SET status='failed',last_error='WhatsApp reported a failed recipient delivery. Review the recipient results.',updated_at=? WHERE id=? AND status='published'",
                )
                .run(new Date().toISOString(), previous.job_id);
          }
        }
      }
  });
}
export async function sendWhatsApp(
  a: Account,
  token: string,
  phone: string,
  caption: string,
  media: string,
  language: Language,
  fetcher: typeof fetch = fetch,
) {
  const template = (await whatsappConfig())?.templates[language];
  if (!template)
    throw new ProviderError(
      `Connect an approved ${language.toUpperCase()} WhatsApp template first.`,
      "failed",
    );
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "template",
    template: {
      name: template.name,
      language: { code: template.language },
      components: [
        {
          type: "header",
          parameters: [{ type: "image", image: { link: media } }],
        },
        {
          type: "body",
          parameters: [
            { type: "text", text: caption.replace(/\s+/g, " ").trim() },
          ],
        },
      ],
    },
  };
  // Cloud API expects JSON, whereas the other Meta endpoints accept form bodies.
  let r: Response;
  try {
    r = await fetcher(
      `https://graph.facebook.com/${metaVersion()}/${a.remote_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(25000),
      },
    );
  } catch {
    throw new ProviderError(
      "WhatsApp did not confirm this recipient's message. Check before retrying.",
      "uncertain",
    );
  }
  let b: any;
  try {
    b = await r.json();
  } catch {
    throw new ProviderError(
      "WhatsApp returned an unconfirmed delivery result.",
      "uncertain",
    );
  }
  if (r.status === 401 || [190, 10, 200].includes(Number(b.error?.code)))
    throw new ProviderError(
      "Reconnect WhatsApp and check messaging permission.",
      "auth",
    );
  if (r.status === 429 || [130429, 131056].includes(Number(b.error?.code)))
    throw new ProviderError(
      "WhatsApp reached its messaging limit. We will retry.",
      "retry",
    );
  if (r.status >= 500)
    throw new ProviderError(
      "WhatsApp did not confirm this message. Check before retrying.",
      "uncertain",
    );
  if (!r.ok || b.error)
    throw new ProviderError(
      "WhatsApp rejected this message. Check the approved template and recipient in WhatsApp Manager.",
      "failed",
    );
  const id = b.messages?.[0]?.id;
  if (!id)
    throw new ProviderError(
      "WhatsApp did not return a message receipt. Check before retrying.",
      "uncertain",
    );
  return String(id);
}
export async function broadcast(
  j: Job,
  a: Account,
  token: string,
  caption: string,
  media: string,
  language: Language,
  owns: () => Promise<boolean>,
  fetcher: typeof fetch = fetch,
) {
  const count = (
    await db()
      .prepare("SELECT count(*) AS n FROM whatsapp_deliveries WHERE job_id=?")
      .get(j.id) as { n: number }
  ).n;
  if (!count) {
    const subscribers = await db()
      .prepare(
        "SELECT phone FROM whatsapp_subscribers WHERE status='subscribed'",
      )
      .all() as { phone: string }[];
    if (!subscribers.length)
      throw new ProviderError(
        "No subscribers yet. Invite customers to subscribe, then retry this post.",
        "failed",
      );
    await transaction(async () => {
      for (const s of subscribers)
        await db()
          .prepare(
            "INSERT OR IGNORE INTO whatsapp_deliveries VALUES(?,?,?,'queued',NULL,0,?,NULL,?)",
          )
          .run(
            randomUUID(),
            j.id,
            s.phone,
            Date.now(),
            new Date().toISOString(),
          );
    });
  }
  await db()
    .prepare(
      "UPDATE whatsapp_deliveries SET status='skipped',last_error='Customer unsubscribed.' WHERE job_id=? AND status='queued' AND phone NOT IN (SELECT phone FROM whatsapp_subscribers WHERE status='subscribed')",
    )
    .run(j.id);
  const due = await db()
    .prepare(
      "SELECT * FROM whatsapp_deliveries WHERE job_id=? AND status='queued' AND next_attempt<=? LIMIT ?",
    )
    .all(j.id, Date.now(), process.env.NETLIFY ? 1 : 3) as {
    id: string;
    phone: string;
    attempts: number;
  }[];
  for (const d of due) {
    if (!(await owns())) return "cancelled";
    const claimed = await db()
      .prepare(
        "UPDATE whatsapp_deliveries SET status='sending',attempts=attempts+1,updated_at=? WHERE id=? AND status='queued' AND phone IN (SELECT phone FROM whatsapp_subscribers WHERE status='subscribed')",
      )
      .run(new Date().toISOString(), d.id);
    if (!claimed.changes) continue;
    try {
      const id = await sendWhatsApp(
        a,
        token,
        d.phone,
        caption,
        media,
        language,
        fetcher,
      );
      await db()
        .prepare(
          "UPDATE whatsapp_deliveries SET status='sent',provider_id=?,last_error=NULL,updated_at=? WHERE id=?",
        )
        .run(id, new Date().toISOString(), d.id);
    } catch (err) {
      const e =
        err instanceof ProviderError
          ? err
          : new ProviderError(
              "WhatsApp did not confirm this message.",
              "uncertain",
            );
      const status =
        e.kind === "uncertain"
          ? "needs_review"
          : e.kind === "retry" && d.attempts < 4
            ? "queued"
            : e.kind === "auth"
              ? "queued"
              : "failed";
      await db()
        .prepare(
          "UPDATE whatsapp_deliveries SET status=?,next_attempt=?,last_error=?,updated_at=? WHERE id=?",
        )
        .run(
          status,
          Date.now() + 60000 * 2 ** d.attempts,
          e.message,
          new Date().toISOString(),
          d.id,
        );
      if (e.kind === "auth") throw e;
    }
  }
  const statuses = await db()
    .prepare("SELECT status FROM whatsapp_deliveries WHERE job_id=?")
    .all(j.id) as { status: string }[];
  if (statuses.some((s) => s.status === "queued")) return "retry";
  if (statuses.some((s) => ["sending", "needs_review"].includes(s.status)))
    return "needs_review";
  if (statuses.some((s) => s.status === "failed")) return "failed";
  return "published";
}
