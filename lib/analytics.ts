import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, transaction } from "./db";

const inputSchema = z.object({
  id: z.string().uuid(),
  consent: z.literal(true),
  event: z.enum([
    "page_view",
    "add_to_cart",
    "remove_from_cart",
    "checkout_started",
    "whatsapp_order_clicked",
    "special_order_clicked",
    "reservation_clicked",
    "phone_clicked",
    "directions_clicked",
    "referral_shared",
  ]),
  page: z
    .string()
    .max(250)
    .refine((p) => p.startsWith("/") && !p.startsWith("//")),
  source: z.string().max(100).default("direct"),
  itemId: z.string().max(150).optional(),
  quantity: z.number().int().min(1).max(30).default(1),
});

export function excludeStaffVisitor(visitor: string) {
  db()
    .prepare("INSERT OR IGNORE INTO analytics_excluded_visitors VALUES(?,?)")
    .run(visitor, new Date().toISOString());
}

export function collectionBlocked(
  host: string,
  preview: boolean | undefined,
  userAgent: string,
  internal: boolean,
) {
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
  return (
    internal ||
    !!preview ||
    ((local || process.env.NODE_ENV === "development") &&
      process.env.ANALYTICS_ALLOW_LOCAL !== "true") ||
    /bot|crawler|spider|headless|lighthouse|preview|facebookexternalhit/i.test(
      userAgent,
    )
  );
}

// One browser session ends after 30 minutes without an accepted event.
// UUIDs make retries idempotent; no IP addresses or personal form fields are stored.
export function recordActivity(
  visitor: string,
  value: unknown,
  validPages: Set<string>,
  validMeals: Set<string>,
  now = Date.now(),
) {
  const input = inputSchema.parse(value);
  let page = input.page.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  if (/^\/r\/[a-zA-Z0-9-]+$/.test(page)) page = "/referral";
  if (!validPages.has(page)) return false;
  if (
    db()
      .prepare("SELECT 1 FROM analytics_excluded_visitors WHERE visitor=?")
      .get(visitor)
  )
    return false;
  const cart =
    input.event === "add_to_cart" || input.event === "remove_from_cart";
  if (cart && (!input.itemId || !validMeals.has(input.itemId))) return false;
  return transaction(() => {
    if (db().prepare("SELECT 1 FROM analytics WHERE id=?").get(input.id))
      return false;
    const last = db()
      .prepare(
        "SELECT session_id,source FROM analytics WHERE visitor=? AND version=2 AND created_at>=? ORDER BY created_at DESC LIMIT 1",
      )
      .get(visitor, new Date(now - 30 * 60000).toISOString()) as
      { session_id: string; source: string } | undefined;
    const source =
      last?.source ||
      input.source
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .toLowerCase()
        .slice(0, 60) ||
      "direct";
    db()
      .prepare(
        "INSERT INTO analytics(id,visitor,event,page,source,created_at,version,session_id,item_id,quantity) VALUES(?,?,?,?,?,?,2,?,?,?)",
      )
      .run(
        input.id,
        visitor,
        input.event,
        page,
        source,
        new Date(now).toISOString(),
        last?.session_id || randomUUID(),
        cart ? input.itemId! : null,
        cart ? input.quantity : 1,
      );
    return true;
  });
}

export function activityReport(now = Date.now()) {
  const since = new Date(now - 30 * 86400000).toISOString();
  const scope =
    "version=2 AND created_at>=? AND NOT EXISTS(SELECT 1 FROM analytics_excluded_visitors x WHERE x.visitor=analytics.visitor)";
  const total = (condition: string, expression = "count(*)") =>
    (
      db()
        .prepare(
          `SELECT ${expression} AS n FROM analytics WHERE ${scope} AND ${condition}`,
        )
        .get(since) as { n: number }
    ).n || 0;
  const counts = db()
    .prepare(
      `SELECT event,sum(quantity) AS count FROM analytics WHERE ${scope} GROUP BY event`,
    )
    .all(since) as { event: string; count: number }[];
  const menuViews = total("event='page_view' AND page='/menu'");
  const dishViews = total("event='page_view' AND page LIKE '/menu/%'");
  const specialViews = total(
    "event='page_view' AND (page='/specials' OR page LIKE '/specials/%')",
  );
  counts.push({ event: "menu_view", count: menuViews });
  const trend = db()
    .prepare(
      `SELECT date(created_at,'+1 hour') AS day,count(*) AS count FROM analytics WHERE ${scope} AND event='page_view' GROUP BY day ORDER BY day`,
    )
    .all(since) as { day: string; count: number }[];
  const pages = db()
    .prepare(
      `SELECT page,count(*) AS count FROM analytics WHERE ${scope} AND event='page_view' GROUP BY page ORDER BY count DESC,page LIMIT 10`,
    )
    .all(since) as { page: string; count: number }[];
  const sources = db()
    .prepare(
      `SELECT source,count(DISTINCT session_id) AS count FROM analytics WHERE ${scope} GROUP BY source ORDER BY count DESC LIMIT 10`,
    )
    .all(since) as { source: string; count: number }[];
  const legacy = db()
    .prepare(
      "SELECT count(*) AS pageViews,count(DISTINCT visitor) AS browsers,coalesce(sum(CASE WHEN page='/admin' OR page LIKE '/admin/%' THEN 1 ELSE 0 END),0) AS adminViews FROM analytics WHERE version=1 AND event='page_view'",
    )
    .get() as { pageViews: number; browsers: number; adminViews: number };
  return {
    since,
    generatedAt: new Date(now).toISOString(),
    pageViews: total("event='page_view'"),
    browsers: total("1=1", "count(DISTINCT visitor)"),
    visits: total("1=1", "count(DISTINCT session_id)"),
    menuViews,
    dishViews,
    specialViews,
    counts,
    trend,
    pages,
    sources,
    legacy,
  };
}
export type ActivityReport = ReturnType<typeof activityReport>;
