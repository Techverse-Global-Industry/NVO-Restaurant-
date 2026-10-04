import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { db, settings, entries, entry, transaction, audit } from "@/lib/db";
import {
  staff,
  customer,
  verifyPassword,
  login,
  logout,
  limit,
  digest,
} from "@/lib/auth";
import { publicCatalog, money } from "@/lib/catalog";
import {
  entrySchema,
  settingsSchema,
  orderSchema,
  reservationSchema,
} from "@/lib/validation";
import { quote } from "@/lib/pricing";
import { claim } from "@/lib/rewards";
import { networkHash } from "@/lib/network";
import {
  claimantName,
  publicReward,
  couponAvailability,
  lookupCoupon,
  counterQuote,
  redeemCounter,
  nameLegacyCoupon,
} from "@/lib/coupons";
import { translate } from "@/lib/translation";
import {
  activityReport,
  collectionBlocked,
  excludeStaffVisitor,
  recordActivity,
} from "@/lib/analytics";
import { queueEntry, cancelPending } from "@/lib/social/queue";
import { deleteMedia, isUploadedMediaUrl, uploadMedia } from "@/lib/storage";
import type { Staff, Entry, Reward } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
// Netlify's binary request limit is lower than the Storage bucket's 8 MB limit
// because multipart bodies are base64 encoded by the function gateway.
const maxUploadBytes = process.env.NETLIFY ? 4 * 1024 * 1024 : 8 * 1024 * 1024;
const maxUploadLabel = process.env.NETLIFY ? "4 MB" : "8 MB";
function permit(user: Staff | null, roles: string[]) {
  if (!user || !roles.includes(user.role)) throw new Error("Not authorized.");
}
const safeReward = publicReward;
async function markStaffBrowser() {
  await excludeStaffVisitor((await customer(true))!);
  (await cookies()).set("nvo_internal", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.SECURE_COOKIES === "true",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
function originCheck(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || new URL(origin).host !== host)
    throw new Error("Request origin is not allowed.");
}
async function body(req: NextRequest) {
  if (Number(req.headers.get("content-length") || 0) > 65536)
    throw new Error("Request is too large.");
  const text = await req.text();
  if (text.length > 65536) throw new Error("Request is too large.");
  return JSON.parse(text);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const route = (await params).path.join("/");
    if (route === "catalog") {
      const [allEntries, currentSettings] = await Promise.all([entries(), settings()]);
      return json(publicCatalog(allEntries, currentSettings));
    }
    if (route === "offers/availability")
      return json(
        await couponAvailability(await customer(), await networkHash(req.headers)),
      );
    if (route === "wallet") {
      const id = await customer();
      return json(
        id
          ? (
              await db()
                .prepare(
                  "SELECT * FROM rewards WHERE customer_id=? ORDER BY claimed_at DESC",
                )
                .all<Reward>(id)
            ).map(safeReward)
          : [],
      );
    }
    if (route === "admin/session") {
      const user = await staff();
      if (user) await markStaffBrowser();
      return json({
        user,
        // ADMIN_PASSWORD only bootstraps the first owner record. Once a staff
        // account exists, removing that deployment secret must not lock staff
        // out of an otherwise working restaurant desk.
        configured: !!(await db()
          .prepare("SELECT id FROM staff LIMIT 1")
          .get<{ id: string }>()),
      });
    }
    if (route === "admin/data") {
      const user = await staff();
      permit(user, ["owner", "manager", "content", "service", "analyst"]);
      await markStaffBrowser();
      const r = user!.role;
      const content = ["owner", "manager", "content"].includes(r);
      const operations = ["owner", "manager", "service"].includes(r);
      const activity = await activityReport();
      const { counts, trend } = activity;
      return json({
        user,
        settings: r === "owner" ? await settings() : null,
        entries: content ? await entries() : [],
        orders: operations
          ? await db()
              .prepare(
                "SELECT * FROM orders ORDER BY created_at DESC LIMIT 200",
              )
              .all()
          : [],
        reservations: operations
          ? await db()
              .prepare(
                "SELECT * FROM reservations ORDER BY created_at DESC LIMIT 200",
              )
              .all()
          : [],
        media: content
          ? await db().prepare("SELECT * FROM media ORDER BY created_at DESC").all()
          : [],
        counts,
        trend,
        activity,
        confirmed: (
          await db()
            .prepare(
              "SELECT count(*) AS n FROM orders WHERE status='fulfilled_paid'",
            )
            .get<{ n: number }>()
        ).n,
        staff:
          r === "owner"
            ? await db().prepare("SELECT id,email,role FROM staff").all()
            : [],
        rewards: operations
          ? await db()
              .prepare(
                "SELECT id,code,title,status,claimed_at,claimant_name,saved_at,order_id,active_at,expires_at FROM rewards ORDER BY claimed_at DESC LIMIT 200",
              )
              .all()
          : [],
      });
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "Unable to load data" },
      401,
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    originCheck(req);
    const route = (await params).path.join("/");
    if (route === "admin/upload") {
      const user = await staff();
      permit(user, ["owner", "manager", "content"]);
      if (Number(req.headers.get("content-length") || 0) > maxUploadBytes)
        throw new Error(`Images must be smaller than ${maxUploadLabel}.`);
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File) || file.size > maxUploadBytes)
        throw new Error(`Choose an image under ${maxUploadLabel}.`);
      const bytes = Buffer.from(await file.arrayBuffer());
      const ext =
        bytes[0] === 255 && bytes[1] === 216
          ? "jpg"
          : bytes
                .subarray(0, 8)
                .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            ? "png"
            : bytes.toString("ascii", 0, 4) === "RIFF" &&
                bytes.toString("ascii", 8, 12) === "WEBP"
              ? "webp"
              : null;
      if (!ext)
        throw new Error("Only JPEG, PNG and WebP images are supported.");
      const id = randomUUID(),
        name = `${id}.${ext}`;
      const url = await uploadMedia(
        `uploads/${name}`,
        bytes,
        ext === "jpg" ? "image/jpeg" : ext === "png" ? "image/png" : "image/webp",
      );
      await db()
        .prepare("INSERT INTO media VALUES(?,?,?,?)")
        .run(id, file.name.slice(0, 200), url, new Date().toISOString());
      await audit(user!.id, "upload", id);
      return json({ url });
    }
    const b = await body(req);
    if (route === "admin/login") {
      const email = String(b.email || "")
        .trim()
        .toLowerCase();
      const password = String(b.password || "");
      if (password.length > 200) throw new Error("Invalid login.");
      await limit("login:" + digest(email), 8, 15 * 60000);
      const user = await db()
        .prepare("SELECT * FROM staff WHERE email=?")
        .get<Staff & { password: string }>(email);
      if (!user || !verifyPassword(password, user.password))
        return json({ error: "Email or password is incorrect." }, 401);
      await login(user.id);
      await markStaffBrowser();
      return json({ ok: true });
    }
    if (route === "admin/logout") {
      await logout();
      return json({ ok: true });
    }
    if (route.startsWith("admin/")) {
      const user = await staff();
      if (route === "admin/media/delete") {
        permit(user, ["owner", "manager", "content"]);
        await transaction(async () => {
          const media = await db()
            .prepare("SELECT id,url FROM media WHERE id=?")
            .get<{ id: string; url: string }>(String(b.id));
          if (!media)
            throw new Error("This photo is no longer in the library.");
          const uses = (await entries()).filter((e) => e.image === media.url);
          if (
            await db()
              .prepare(
                "SELECT id FROM social_jobs WHERE json_extract(payload,'$.entry.image')=? AND status IN ('queued','preparing','retry','publishing','processing','inbox','needs_review') LIMIT 1",
              )
              .get(media.url)
          )
            throw new Error(
              "This photo is still used by a social post being delivered. Finish or cancel that post first.",
            );
          if (uses.length)
            throw new Error(
              `This photo is used by ${uses
                .map((e) => e.title)
                .slice(0, 3)
                .join(
                  ", ",
                )}. Replace or remove the photo on those items first, including hidden drafts.`,
            );
          if (!isUploadedMediaUrl(media.url))
            throw new Error(
              "This is a built-in design image. Only uploaded photos can be deleted here.",
            );
          await deleteMedia(media.url);
          await db().prepare("DELETE FROM media WHERE id=?").run(media.id);
          await audit(user!.id, "delete-media", media.id);
        });
        return json({ ok: true });
      }
      if (route === "admin/settings") {
        permit(user, ["owner"]);
        const data = settingsSchema.parse(b);
        await db()
          .prepare("UPDATE settings SET data=? WHERE id=1")
          .run(JSON.stringify(data));
        await audit(user!.id, "settings", "restaurant");
        return json({ ok: true });
      }
      if (route === "admin/entry") {
        const data = entrySchema.parse(b);
        permit(
          user,
          data.kind === "campaigns"
            ? ["owner", "manager"]
            : ["owner", "manager", "content"],
        );
        const existing = await entry(data.id);
        if (
          data.image &&
          !data.image.startsWith("/images/") &&
          !(await db().prepare("SELECT id FROM media WHERE url=?").get(data.image))
        )
          throw new Error(
            "This uploaded photo was deleted. Choose another photo before saving.",
          );
        if (existing && existing.kind !== data.kind)
          throw new Error("Content type cannot be changed.");
        await transaction(async () => {
          await db()
            .prepare(
              "INSERT INTO entries VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,data=excluded.data",
            )
            .run(data.id, data.kind, JSON.stringify(data));
          await queueEntry(data, b.social);
          await audit(user!.id, "save", data.id);
        });
        return json({ ok: true });
      }
      if (route === "admin/delete") {
        const target = await entry(String(b.id));
        permit(
          user,
          target?.kind === "campaigns"
            ? ["owner", "manager"]
            : ["owner", "manager", "content"],
        );
        if (!target) throw new Error("Item not found.");
        // Archive to preserve historical references and previously issued offer terms.
        await transaction(async () => {
          await db()
            .prepare("UPDATE entries SET data=? WHERE id=?")
            .run(
              JSON.stringify({ ...target, active: false, status: "draft" }),
              target.id,
            );
          await cancelPending(target.id);
          await audit(user!.id, "archive", target.id);
        });
        return json({ ok: true });
      }
      if (route === "admin/order") {
        permit(user, ["owner", "manager", "service"]);
        const allowed = [
          "request_created",
          "accepted",
          "fulfilled_paid",
          "cancelled",
        ];
        if (!allowed.includes(b.status)) throw new Error("Invalid status.");
        await transaction(async () => {
          const order = await db()
            .prepare("SELECT * FROM orders WHERE id=?")
            .get<{ id: string; status: string; data: string }>(String(b.id));
          if (!order) throw new Error("Order not found.");
          if (order.status === "cancelled")
            throw new Error(
              "A cancelled request cannot be reopened. Create a new request.",
            );
          if (
            order.status === "fulfilled_paid" &&
            b.status !== "fulfilled_paid"
          )
            throw new Error(
              "Paid outcomes require an owner reconciliation; do not overwrite them.",
            );
          const data = JSON.parse(order.data);
          if (b.status === "fulfilled_paid" && data.pending)
            throw new Error(
              "This request needs a confirmed quote. Record the final agreed amount first.",
            );
          if (b.status === "fulfilled_paid" && data.rewardId) {
            const reward = await db()
              .prepare("SELECT * FROM rewards WHERE id=?")
              .get<Reward>(data.rewardId);
            if (
              reward &&
              reward.status === "held" &&
              reward.order_id === order.id
            )
              await db()
                .prepare("UPDATE rewards SET status='redeemed' WHERE id=?")
                .run(reward.id);
            else if (order.status !== "fulfilled_paid")
              throw new Error("Coupon hold is no longer valid.");
          }
          if (b.status === "cancelled")
            await db()
              .prepare(
                "UPDATE rewards SET status='claimed',order_id=NULL WHERE order_id=? AND status='held'",
              )
              .run(order.id);
          await db()
            .prepare("UPDATE orders SET status=? WHERE id=?")
            .run(b.status, order.id);
          await audit(user!.id, "order:" + b.status, order.id);
        });
        return json({ ok: true });
      }
      if (route === "admin/quote") {
        permit(user, ["owner", "manager", "service"]);
        if (!Number.isInteger(b.total) || b.total < 0 || b.total > 10000000)
          throw new Error("Enter the agreed total in whole FCFA.");
        const order = await db()
          .prepare("SELECT data,status FROM orders WHERE id=?")
          .get<{ data: string; status: string }>(String(b.id));
        if (!order || ["fulfilled_paid", "cancelled"].includes(order.status))
          throw new Error("This order cannot be quoted.");
        const data = JSON.parse(order.data);
        // Staff must explicitly review any offer terms before recording an agreed net total.
        if (data.rewardId && b.offerReviewed !== true)
          throw new Error(
            "Review the coupon conditions before confirming the quote.",
          );
        await db()
          .prepare("UPDATE orders SET data=? WHERE id=?")
          .run(
            JSON.stringify({
              ...data,
              pending: false,
              total: b.total,
              agreedBy: user!.id,
              agreedAt: new Date().toISOString(),
              offerReviewed: !!b.offerReviewed,
            }),
            b.id,
          );
        await audit(user!.id, "quote", b.id);
        return json({ ok: true });
      }
      if (route === "admin/reservation") {
        permit(user, ["owner", "manager", "service"]);
        if (!["requested", "confirmed", "cancelled"].includes(b.status))
          throw new Error("Invalid status");
        await db()
          .prepare("UPDATE reservations SET status=? WHERE id=?")
          .run(b.status, String(b.id));
        await audit(user!.id, "reservation:" + b.status, String(b.id));
        return json({ ok: true });
      }
      if (route === "admin/translate") {
        permit(user, ["owner", "manager", "content"]);
        await limit("translate:" + user!.id, 60);
        if (
          !["en", "fr"].includes(b.from) ||
          typeof b.text !== "string" ||
          b.text.length > 5000
        )
          throw new Error("Invalid translation request.");
        return json({ text: await translate(b.text, b.from) });
      }
      if (route === "admin/coupon") {
        permit(user, ["owner", "manager", "service"]);
        const reward = await lookupCoupon(String(b.code || ""));
        const receipt = await db()
          .prepare("SELECT data FROM counter_sales WHERE reward_id=?")
          .get<{ data: string }>(reward.id);
        return json({
          reward: publicReward(reward),
          receipt: receipt ? JSON.parse(receipt.data) : null,
          meals: (await entries())
            .filter((e) => e.kind === "meals")
            .map((e) => ({ id: e.id, title: e.title, price: e.price })),
        });
      }
      if (route === "admin/coupon-quote") {
        permit(user, ["owner", "manager", "service"]);
        const q = await counterQuote(b);
        return json({
          subtotal: q.subtotal,
          discount: q.discount,
          total: q.total,
        });
      }
      if (route === "admin/redeem") {
        permit(user, ["owner", "manager", "service"]);
        return json({ ok: true, receipt: await redeemCounter(b, user!.id) });
      }
      return json({ error: "This integration is not connected." }, 501);
    }
    if (route === "analytics") {
      const user = await staff();
      if (user) await markStaffBrowser();
      const jar = await cookies();
      if (
        b.consent !== true ||
        collectionBlocked(
          req.headers.get("host") || "",
          (await settings()).previewContent,
          req.headers.get("user-agent") || "",
          !!user || jar.get("nvo_internal")?.value === "1",
        )
      )
        return json({ ok: true, recorded: false });
      const visitor = (await customer(true))!;
      await limit("analytics:" + visitor, 120);
      const [allEntries, currentSettings] = await Promise.all([entries(), settings()]);
      const catalogue = publicCatalog(allEntries, currentSettings).entries;
      const pages = new Set([
        "/",
        "/menu",
        "/cart",
        "/offers",
        "/promotions",
        "/specials",
        "/about",
        "/events",
        "/news",
        "/gallery",
        "/reservation",
        "/referral",
        "/contact",
        "/subscribe",
        "/loyalty",
        "/testimonials",
        "/privacy",
        "/terms",
      ]);
      for (const e of catalogue) {
        const section = (
          {
            meals: "menu",
            specials: "specials",
            posts: "news",
            events: "events",
          } as Record<string, string>
        )[e.kind];
        if (section) pages.add(`/${section}/${encodeURIComponent(e.id)}`);
      }
      return json({
        ok: true,
        recorded: await recordActivity(
          visitor,
          b,
          pages,
          new Set(catalogue.filter((e) => e.kind === "meals").map((e) => e.id)),
        ),
      });
    }
    const id = (await customer(true))!;
    await limit("public:" + id, 60);
    if (route === "quote") {
      const lines = orderSchema.shape.lines.parse(b.lines);
      return json(await quote(lines, String(b.coupon || ""), id));
    }
    if (route === "order") {
      await limit("order:" + id, 10, 3600000);
      const input = orderSchema.parse(b);
      const result = await transaction(async () => {
        const previous = await db()
          .prepare("SELECT id,data,customer_id FROM orders WHERE request_key=?")
          .get<{ id: string; data: string; customer_id: string }>(input.requestKey);
        if (previous) {
          if (previous.customer_id !== id) throw new Error("Invalid request.");
          return { id: previous.id, ...JSON.parse(previous.data) };
        }
        const q = await quote(input.lines, input.coupon, id);
        const orderId = "NVO-" + randomUUID().slice(0, 8).toUpperCase();
        const data = { ...input, ...q };
        await db()
          .prepare("INSERT INTO orders VALUES(?,?,?,?,?,?)")
          .run(
            orderId,
            id,
            JSON.stringify(data),
            "request_created",
            new Date().toISOString(),
            input.requestKey,
          );
        if (q.rewardId)
          await db()
            .prepare(
              "UPDATE rewards SET status='held',order_id=? WHERE id=? AND status='claimed'",
            )
            .run(orderId, q.rewardId);
        return { id: orderId, ...data };
      });
      const message = `Hello NVO! / Bonjour NVO !\nOrder / Commande: ${result.id}\n${result.items.map((i: { quantity: number; title: string; price: number | null }) => `${i.quantity} × ${i.title}${i.price === null ? " — price to confirm / prix à confirmer" : " — " + money(i.price * i.quantity)}`).join("\n")}\n${result.pending ? "Total: to be confirmed / à confirmer" : "Food total / Total repas: " + money(result.total)}\n${result.method === "delivery" ? "Delivery fee to confirm / Frais de livraison à confirmer\n" : ""}Name / Nom: ${result.name}\nPhone / Téléphone: ${result.phone}\n${result.method}\n${result.address}\n${result.coupon ? "Coupon: " + result.coupon + "\n" : ""}${result.notes}\nPlease confirm availability and my order. / Merci de confirmer ma commande.`;
      return json({
        id: result.id,
        url: `https://wa.me/${(await settings()).whatsapp}?text=${encodeURIComponent(message)}`,
      });
    }
    if (route === "reservation") {
      await limit("reservation:" + id, 5, 3600000);
      const data = reservationSchema.parse(b);
      if (Date.parse(`${data.date}T${data.time}:00+01:00`) <= Date.now())
        throw new Error("Please choose a future date and time.");
      const ref = "RES-" + randomUUID().slice(0, 8).toUpperCase();
      await db()
        .prepare("INSERT INTO reservations VALUES(?,?,?,?)")
        .run(ref, JSON.stringify(data), "requested", new Date().toISOString());
      const message = `Bonjour NVO / Hello NVO\nReservation request: ${ref}\n${data.name}\n${data.phone}\n${data.date} · ${data.time}\n${data.guests} guests / personnes\n${data.message}\nPlease confirm / Merci de confirmer.`;
      return json({
        id: ref,
        url: `https://wa.me/${(await settings()).whatsapp}?text=${encodeURIComponent(message)}`,
      });
    }
    if (route === "reward/saved") {
      const reward = await db()
        .prepare("SELECT id FROM rewards WHERE id=? AND customer_id=?")
        .get(String(b.id), id);
      if (!reward) throw new Error("Coupon not found in your wallet.");
      await db()
        .prepare("UPDATE rewards SET saved_at=? WHERE id=?")
        .run(new Date().toISOString(), String(b.id));
      return json({ ok: true });
    }
    if (route === "reward/name")
      return json(
        await nameLegacyCoupon(String(b.id), id, b.name, await networkHash(req.headers)),
      );
    if (route === "claim") {
      const name = claimantName.parse(b.name);
      const network = await networkHash(req.headers);
      await limit("claim-network:" + network, 12, 3600000);
      await limit("claim:" + id, 10, 3600000);
      return json(
        safeReward(
          await claim(
            String(b.campaignId),
            id,
            b.referralId ? String(b.referralId) : undefined,
            { name, network },
          ),
        ),
      );
    }
    if (route === "referral") {
      if (!(await settings()).referralEnabled)
        throw new Error("Referrals are not active yet.");
      const existing = await db()
        .prepare("SELECT id FROM referrals WHERE customer_id=?")
        .get<{ id: string }>(id);
      const ref = existing?.id || randomUUID().replaceAll("-", "");
      if (!existing)
        await db()
          .prepare("INSERT INTO referrals VALUES(?,?,?)")
          .run(ref, id, new Date().toISOString());
      return json({ code: ref });
    }
    if (route === "referral/visit") {
      const ref = await db()
        .prepare("SELECT * FROM referrals WHERE id=?")
        .get<{ customer_id: string }>(String(b.code));
      const currentSettings = await settings();
      if (!ref || ref.customer_id === id || !currentSettings.referralEnabled)
        throw new Error(
          "This referral link is not available for this visitor.",
        );
      await db()
        .prepare("INSERT OR IGNORE INTO referral_visits VALUES(?,?,?)")
        .run(String(b.code), id, new Date().toISOString());
      const visit = await db()
        .prepare(
          "SELECT opened_at FROM referral_visits WHERE referral_id=? AND customer_id=?",
        )
        .get<{ opened_at: string }>(String(b.code), id);
      return json({
        expiresAt: new Date(
          Date.parse(visit!.opened_at) + currentSettings.referralClaimMinutes * 60000,
        ).toISOString(),
        campaignId: currentSettings.referralCampaign,
      });
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    if (e instanceof Error && e.name === "ZodError")
      return json({ error: "Please check the form fields and dates." }, 400);
    const message =
      e instanceof Error ? e.message : "Unable to complete this request.";
    console.error("[NVO request]", e instanceof Error ? e.name : "Error");
    return json(
      {
        error: /SQLITE|constraint|ENOENT|JSON/.test(message)
          ? "Unable to save. Please check your information and try again."
          : message,
      },
      message === "Not authorized." ? 403 : 400,
    );
  }
}
