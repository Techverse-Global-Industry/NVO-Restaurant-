import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { staff, limit } from "@/lib/auth";
import { db, audit, settings, transaction } from "@/lib/db";
import { entrySchema } from "@/lib/validation";
import {
  accounts,
  beginConnection,
  pendingAccounts,
  selectAccounts,
  tiktokReadiness,
  account,
} from "@/lib/social/accounts";
import { connectionReadiness, instagramReadiness } from "@/lib/social/security";
import { aiReady, generateCaptions, payloadFor } from "@/lib/social/captions";
import { getPlan, jobs, jobAction, socialKinds } from "@/lib/social/queue";
import {
  connectWhatsApp,
  whatsappConfig,
  whatsappReadiness,
} from "@/lib/social/whatsapp";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function user() {
  const u = await staff();
  if (!u || !["owner", "manager", "content"].includes(u.role))
    throw new Error("Not authorized.");
  return u;
}
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    const u = await user(),
      { action } = await params;
    if (action === "dashboard") {
      const heartbeat = await db()
        .prepare("SELECT heartbeat FROM social_worker WHERE id=1")
        .get() as { heartbeat: number } | undefined;
      return json({
        accounts: await accounts(),
        pending: ["owner", "manager"].includes(u.role)
          ? await pendingAccounts(u.id)
          : [],
        jobs: await jobs(),
        meta: connectionReadiness(),
        instagram: instagramReadiness(),
        tiktok: tiktokReadiness(),
        whatsapp: whatsappReadiness(),
        whatsappTemplates: Object.keys((await whatsappConfig())?.templates || {}),
        ai: aiReady(),
        manage: ["owner", "manager"].includes(u.role),
        worker: {
          running: !!heartbeat && heartbeat.heartbeat > Date.now() - 240000,
          mode: process.env.SOCIAL_WORKER_MODE || "embedded",
        },
        subscribers: (
          await db()
            .prepare(
              "SELECT count(*) AS n FROM whatsapp_subscribers WHERE status='subscribed'",
            )
            .get() as { n: number }
        ).n,
      });
    }
    if (action === "plan")
      return json({ plan: await getPlan(req.nextUrl.searchParams.get("id") || "") });
    if (action === "audience") {
      if (!["owner", "manager"].includes(u.role))
        throw new Error("Not authorized.");
      return json({
        subscribers: await db()
          .prepare(
            "SELECT phone,name,status,consented_at,changed_at FROM whatsapp_subscribers ORDER BY changed_at DESC LIMIT 200",
          )
          .all(),
      });
    }
    if (action === "deliveries")
      return json({
        deliveries: await db()
          .prepare(
            "SELECT '••••' || substr(phone,-4) AS recipient,status,attempts,last_error,updated_at FROM whatsapp_deliveries WHERE job_id=? ORDER BY updated_at DESC LIMIT 200",
          )
          .all(req.nextUrl.searchParams.get("id") || ""),
      });
    return json({ error: "Not found" }, 404);
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "Unable to load publishing." },
      403,
    );
  }
}
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    const origin = req.headers.get("origin");
    if (!origin || new URL(origin).host !== req.headers.get("host"))
      throw new Error("Request origin is not allowed.");
    const u = await user(),
      { action } = await params;
    if (Number(req.headers.get("content-length") || 0) > 65536)
      throw new Error("Request is too large.");
    const raw = await req.text();
    if (raw.length > 65536) throw new Error("Request is too large.");
    const b = JSON.parse(raw);
    await limit(`social:${u.id}`, 90, 60000);
    if (action === "captions") {
      await limit(`captions:${u.id}`, b.ai ? 30 : 160, b.ai ? 3600000 : 60000);
      const e = entrySchema.parse(b.entry);
      if (!socialKinds.includes(e.kind))
        throw new Error("Choose a story, event or special.");
      const language = z.enum(["en", "fr"]).parse(b.language);
      return json(
        await generateCaptions(
          payloadFor(
            e,
            language,
            b.ai ? "ai" : "standard",
            await settings(),
            process.env.SITE_URL || "http://localhost:3000",
          ),
          b.ai === true,
        ),
      );
    }
    if (action === "job") {
      const v = z
        .object({
          id: z.string().max(80),
          action: z.enum(["cancel", "retry"]),
          checked: z.boolean().optional(),
        })
        .parse(b);
      await jobAction(v.id, v.action, v.checked);
      await audit(u.id, `social-${v.action}`, v.id);
      return json({ ok: true });
    }
    if (!["owner", "manager"].includes(u.role))
      throw new Error("Not authorized.");
    if (action === "connect") {
      await limit(`connect:${u.id}`, 10, 3600000);
      const provider = z.enum(["meta", "instagram", "tiktok", "whatsapp"]).parse(b.provider);
      if (provider === "whatsapp") {
        await connectWhatsApp();
        await audit(u.id, "social-connect", "whatsapp");
        return json({ ok: true });
      }
      const result = await beginConnection(u.id, provider);
      (await cookies()).set("nvo_social_oauth", result.cookie, {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: "/api/social/callback",
        maxAge: 600,
      });
      return json({ url: result.url });
    }
    if (action === "select") {
      const v = z
        .object({
          ids: z.array(z.string()).min(1).max(200),
          automatic: z.boolean(),
        })
        .parse(b);
      await selectAccounts(u.id, v.ids, v.automatic);
      await audit(u.id, "social-connect", v.ids.join(","));
      return json({ ok: true });
    }
    if (action === "account") {
      const v = z
        .object({
          id: z.string().max(80),
          action: z.enum(["automatic", "disconnect"]),
          enabled: z.boolean().optional(),
        })
        .parse(b);
      const a = await account(v.id);
      if (!a) throw new Error("Account not found.");
      if (v.action === "automatic" && a.platform === "tiktok" && v.enabled)
        throw new Error(
          "Choose TikTok and confirm each upload in the post editor.",
        );
      await transaction(async () => {
        const now = new Date().toISOString();
        if (v.action === "disconnect")
          await db()
            .prepare(
              "UPDATE social_accounts SET status='disconnected',token='',auto_publish=false,updated_at=? WHERE id=?",
            )
            .run(now, a.id);
        else
          await db()
            .prepare(
              "UPDATE social_accounts SET auto_publish=?,updated_at=? WHERE id=?",
            )
            .run(v.enabled === true, now, a.id);
        // Turning a default off must also stop unsent jobs created by that default.
        if (v.action === "disconnect" || !v.enabled)
          await db()
            .prepare(
              "UPDATE social_jobs SET status='cancelled',lease_owner=NULL,lease_until=NULL,updated_at=? WHERE account_id=? AND status IN ('queued','retry','preparing','failed','needs_auth') AND (?='disconnect' OR entry_id IN (SELECT entry_id FROM social_plans WHERE json_extract(data,'$.mode')='auto'))",
            )
            .run(now, a.id, v.action);
        await audit(u.id, `social-${v.action}`, a.id);
      });
      return json({ ok: true });
    }
    if (action === "unsubscribe") {
      const phone = z
        .string()
        .regex(/^\d{8,15}$/)
        .parse(b.phone);
      await transaction(async () => {
        await db()
          .prepare(
            "UPDATE whatsapp_subscribers SET status='unsubscribed',changed_at=?,last_timestamp=? WHERE phone=?",
          )
          .run(new Date().toISOString(), Math.floor(Date.now() / 1000), phone);
        await db()
          .prepare(
            "UPDATE whatsapp_deliveries SET status='skipped',last_error='Unsubscribed by restaurant staff.' WHERE phone=? AND status IN ('queued','failed','needs_review')",
          )
          .run(phone);
        await audit(u.id, "whatsapp-unsubscribe", phone.slice(-4));
      });
      return json({ ok: true });
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    return json(
      {
        error:
          e instanceof z.ZodError
            ? e.issues.map((i) => i.message).join(" ")
            : e instanceof Error
              ? e.message
              : "Unable to update publishing.",
      },
      e instanceof Error && e.message === "Not authorized." ? 403 : 400,
    );
  }
}
