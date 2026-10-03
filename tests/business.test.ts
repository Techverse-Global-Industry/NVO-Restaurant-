import { test, before } from "node:test";
import assert from "node:assert/strict";
import { db, entries, settings, entry } from "../lib/db";
import { publicCatalog } from "../lib/catalog";
import { quote } from "../lib/pricing";
import { claim } from "../lib/rewards";
import { entrySchema, settingsSchema } from "../lib/validation";
import type { Entry } from "../lib/types";
process.env.NVO_DB_PATH = ":memory:";
process.env.ADMIN_PASSWORD = "";
test("sample preview allows labelled editorial only and never makes economic demo content live", () => {
  const base: Entry = {
    id: "sample",
    kind: "posts",
    title: "Sample",
    description: "Preview",
    active: true,
    sort: 1,
    demo: true,
  };
  const s = settings();
  assert.equal(
    publicCatalog([base], { ...s, previewContent: false }).entries.length,
    0,
  );
  assert.equal(
    publicCatalog([base], { ...s, previewContent: true }).entries[0].demo,
    true,
  );
  for (const kind of ["meals", "campaigns", "testimonials", "loyalty"] as const)
    assert.equal(
      publicCatalog([{ ...base, kind }], { ...s, previewContent: true }).entries
        .length,
      0,
    );
  assert.equal(
    publicCatalog([{ ...base, active: false }], { ...s, previewContent: true })
      .entries.length,
    0,
  );
});
function save(e: Entry) {
  db()
    .prepare("INSERT OR REPLACE INTO entries VALUES(?,?,?)")
    .run(e.id, e.kind, JSON.stringify(e));
}
function campaign(id: string, overrides: Partial<Entry> = {}): Entry {
  return {
    id,
    kind: "campaigns",
    title: "Test offer",
    description: "Test only",
    active: true,
    status: "published",
    sort: 1,
    discountType: "percent",
    discountValue: 10,
    claimLimit: 2,
    perCustomerLimit: 1,
    activationDays: 0,
    validityDays: 7,
    ...overrides,
  };
}
before(() => {
  db();
});
test("hidden prices are absent in public catalogue and order quotes", async () => {
  const meal = {
    ...entry("banga")!,
    price: 12000,
    priceVisibility: "hide" as const,
  };
  save(meal);
  const publicMeal = publicCatalog(entries(), settings()).entries.find(
    (e) => e.id === "banga",
  );
  assert.equal(publicMeal?.price, null);
  const q = await quote([{ id: "banga", quantity: 2 }]);
  assert.equal(q.total, null);
  assert.equal(q.items[0].price, null);
});
test("server prices and quantities determine totals; unavailable items rejected", async () => {
  save({ ...entry("rice-fish")!, price: 7000, priceVisibility: "show" });
  assert.equal((await quote([{ id: "rice-fish", quantity: 2 }])).total, 14000);
  await assert.rejects(quote([{ id: "rice-fish", quantity: -1 }]), /quantity/);
  save({ ...entry("rice-fish")!, available: false });
  await assert.rejects(quote([{ id: "rice-fish", quantity: 1 }]), /available/);
  save({ ...entry("rice-fish")!, available: true });
});
test("mixed carts do not expose a misleading or reconstructable grand total", async () => {
  const q = await quote([
    { id: "banga", quantity: 1 },
    { id: "rice-fish", quantity: 1 },
  ]);
  assert.equal(q.total, null);
  assert.equal(q.subtotal, null);
  assert.equal(q.discount, null);
});
test("duplicate lines rejected rather than bypassing quantity constraints", async () => {
  await assert.rejects(
      quote([
        { id: "rice-fish", quantity: 20 },
        { id: "rice-fish", quantity: 20 },
      ]),
    /Duplicate/,
  );
});
test("claim capacity and browser limits are transactional", async () => {
  save(campaign("capacity"));
  await claim("capacity", "alice");
  await assert.rejects(claim("capacity", "alice"), /already/);
  await claim("capacity", "bob");
  await assert.rejects(claim("capacity", "carol"), /claimed/);
  assert.equal(
    (
      db()
        .prepare(
          "SELECT count(*) AS n FROM rewards WHERE campaign_id='capacity'",
        )
        .get() as { n: number }
    ).n,
    2,
  );
});
test("activation delay and expiry are distinct and enforced by server", async () => {
  save(campaign("delayed", { activationDays: 3, validityDays: 7 }));
  const r = await claim("delayed", "alice");
  assert.ok(Date.parse(r.active_at) - Date.parse(r.claimed_at) >= 3 * 86400000);
  assert.equal(
    Date.parse(r.expires_at) - Date.parse(r.active_at),
    7 * 86400000,
  );
  await assert.rejects(
    quote([{ id: "rice-fish", quantity: 1 }], r.code, "alice"),
    /not active/,
  );
});
test("coupon ownership, snapshotted terms and expiry protect totals", async () => {
  save(campaign("snapshot"));
  const r = await claim("snapshot", "alice");
  save(campaign("snapshot", { discountValue: 90 }));
  assert.equal(
    (await quote([{ id: "rice-fish", quantity: 1 }], r.code, "alice")).discount,
    700,
  );
  await assert.rejects(
    quote([{ id: "rice-fish", quantity: 1 }], r.code, "bob"),
    /wallet/,
  );
  db()
    .prepare("UPDATE rewards SET expires_at=? WHERE id=?")
    .run("2020-01-01T00:00:00.000Z", r.id);
  await assert.rejects(
    quote([{ id: "rice-fish", quantity: 1 }], r.code, "alice"),
    /expired/,
  );
});
test("hidden-price coupon quote does not leak private price through savings", async () => {
  save(campaign("hidden"));
  const r = await claim("hidden", "alice");
  const q = await quote([{ id: "banga", quantity: 1 }], r.code, "alice");
  assert.equal(q.discount, null);
  assert.equal(q.total, null);
});
test("expired campaign cannot issue rewards", async () => {
  save(campaign("expired", { endsAt: "2020-01-01T00:00:00.000Z" }));
  await assert.rejects(claim("expired", "alice"), /not open/);
});
test("unsafe settings and impossible campaigns are rejected", () => {
  assert.equal(
    settingsSchema.safeParse({
      ...settings(),
      mapsUrl: "https://evil.example/maps",
    }).success,
    false,
  );
  assert.equal(
    entrySchema.safeParse(campaign("bad", { discountValue: 101 })).success,
    false,
  );
  assert.equal(
    entrySchema.safeParse(
      campaign("backwards", { startsAt: "2030-01-02", endsAt: "2030-01-01" }),
    ).success,
    false,
  );
  assert.equal(
    entrySchema.safeParse(
      campaign("image", { image: "/private/LOCAL-ADMIN.txt" }),
    ).success,
    false,
  );
});
