import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../lib/db";
import {
  recordActivity,
  activityReport,
  excludeStaffVisitor,
  collectionBlocked,
} from "../lib/analytics";
import { changeQuantity, completeCart } from "../lib/cart";
import { postPath } from "../lib/social/captions";
import type { Entry } from "../lib/types";
process.env.NVO_DB_PATH = ":memory:";
process.env.ADMIN_PASSWORD = "";
const pages = new Set([
  "/",
  "/menu",
  "/menu/banga",
  "/specials",
  "/specials/lunch",
  "/cart",
  "/referral",
]);
const meals = new Set(["banga", "rice"]);
const now = Date.parse("2026-09-25T12:00:00Z");
const event = (extra = {}) => ({
  id: randomUUID(),
  event: "page_view",
  consent: true,
  page: "/",
  source: "instagram",
  ...extra,
});
beforeEach(() => {
  db().exec("DELETE FROM analytics; DELETE FROM analytics_excluded_visitors;");
});

test("one browser can make multiple page views; retries deduplicate and inactivity starts a new visit", () => {
  const first = event();
  assert.equal(
    recordActivity("guest", first, pages, meals, now - 4000000),
    true,
  );
  assert.equal(
    recordActivity("guest", first, pages, meals, now - 3900000),
    false,
  );
  recordActivity(
    "guest",
    event({ page: "/menu", source: "direct" }),
    pages,
    meals,
    now - 3800000,
  );
  recordActivity(
    "guest",
    event({ page: "/specials", source: "facebook" }),
    pages,
    meals,
    now - 60000,
  );
  const report = activityReport(now);
  assert.equal(report.pageViews, 3);
  assert.equal(report.browsers, 1);
  assert.equal(report.visits, 2);
  assert.equal(report.menuViews, 1);
  assert.equal(report.specialViews, 1);
  assert.deepEqual(
    report.sources
      .map((row) => ({ ...row }))
      .sort((a, b) => a.source.localeCompare(b.source)),
    [
      { source: "facebook", count: 1 },
      { source: "instagram", count: 1 },
    ],
  );
});
test("staff visits are excluded retrospectively; admin paths, unknown pages and invalid cart items never count", () => {
  recordActivity("staff", event(), pages, meals, now);
  excludeStaffVisitor("staff");
  assert.equal(activityReport(now).pageViews, 0);
  assert.equal(recordActivity("staff", event(), pages, meals, now), false);
  for (const page of [
    "/admin",
    "/admin/settings",
    "/api/admin/data",
    "/missing",
  ])
    assert.equal(
      recordActivity("guest", event({ page }), pages, meals, now),
      false,
    );
  assert.equal(
    recordActivity(
      "guest",
      event({ event: "add_to_cart", page: "/menu", itemId: "fake" }),
      pages,
      meals,
      now,
    ),
    false,
  );
  assert.throws(() =>
    recordActivity("guest", event({ consent: false }), pages, meals, now),
  );
});
test("legacy counts remain available but never inflate current guest metrics", () => {
  for (const page of ["/", "/admin", "/menu"])
    db()
      .prepare(
        "INSERT INTO analytics(id,visitor,event,page,source,created_at) VALUES(?,?,?,?,?,?)",
      )
      .run(
        randomUUID(),
        "old",
        "page_view",
        page,
        "direct",
        new Date(now).toISOString(),
      );
  recordActivity("guest", event(), pages, meals, now);
  const r = activityReport(now);
  assert.equal(r.pageViews, 1);
  assert.deepEqual(
    { ...r.legacy },
    { pageViews: 3, browsers: 1, adminViews: 1 },
  );
});
test("reports apply exact 30-day cutoff, Cotonou calendar dates and actual cart quantities", () => {
  recordActivity("old", event(), pages, meals, now - 30 * 86400000 - 1);
  recordActivity(
    "guest",
    event(),
    pages,
    meals,
    Date.parse("2026-09-24T23:30:00Z"),
  );
  recordActivity(
    "guest",
    event({ event: "add_to_cart", itemId: "banga", quantity: 3 }),
    pages,
    meals,
    now,
  );
  recordActivity(
    "guest",
    event({ event: "remove_from_cart", itemId: "banga", quantity: 2 }),
    pages,
    meals,
    now,
  );
  const r = activityReport(now);
  assert.equal(r.pageViews, 1);
  assert.deepEqual(
    r.trend.map((row) => ({ ...row })),
    [{ day: "2026-09-25", count: 1 }],
  );
  assert.equal(r.counts.find((c) => c.event === "add_to_cart")?.count, 3);
  assert.equal(r.counts.find((c) => c.event === "remove_from_cart")?.count, 2);
});
test("local, staff, preview and recognised automated traffic is blocked", () => {
  delete process.env.ANALYTICS_ALLOW_LOCAL;
  for (const host of ["localhost:3000", "127.0.0.1:3000", "[::1]:3000"])
    assert.ok(collectionBlocked(host, false, "Browser", false));
  assert.ok(collectionBlocked("nvo.example", true, "Browser", false));
  assert.ok(collectionBlocked("nvo.example", false, "HeadlessChrome", false));
  assert.ok(collectionBlocked("nvo.example", false, "Browser", true));
  assert.equal(
    collectionBlocked("nvo.example", false, "Browser", false),
    false,
  );
});
test("cart quantity changes count real deltas; completing an order preserves newly added items", () => {
  const basket = [
    { id: "banga", quantity: 3 },
    { id: "rice", quantity: 2 },
  ];
  assert.equal(changeQuantity(basket, "banga", 2).delta, -1);
  assert.equal(changeQuantity(basket, "banga", 0).delta, -3);
  assert.equal(
    changeQuantity([{ id: "banga", quantity: 30 }], "banga", 31).delta,
    0,
  );
  assert.deepEqual(completeCart(basket, basket), []);
  assert.deepEqual(
    completeCart(
      [
        { id: "banga", quantity: 5 },
        { id: "rice", quantity: 2 },
      ],
      [{ id: "banga", quantity: 3 }],
    ),
    [
      { id: "banga", quantity: 2 },
      { id: "rice", quantity: 2 },
    ],
  );
});
test("special social captions link to the actual special; coupon links stay separate", () => {
  assert.equal(
    postPath({ kind: "specials", id: "lunch special" } as Entry),
    "/specials/lunch%20special",
  );
  assert.equal(
    postPath({ kind: "campaigns", id: "reward" } as Entry),
    "/offers",
  );
});
