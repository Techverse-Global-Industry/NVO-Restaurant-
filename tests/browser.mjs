import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";

const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => {
      const at = l.indexOf("=");
      return [l.slice(0, at), l.slice(at + 1)];
    }),
);
const browser = await chromium.launch({
  executablePath:
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
await context.addInitScript(() => {
  localStorage.setItem("nvo-analytics", "no");
});
const page = await context.newPage();
const failures = [];
page.on("pageerror", (e) => failures.push(e.message));
mkdirSync("artifacts", { recursive: true });
async function post(route, data) {
  const r = await context.request.post(base + "/api/" + route, {
    headers: { Origin: base },
    data,
  });
  const b = await r.json();
  assert.ok(r.ok(), `${route}: ${JSON.stringify(b)}`);
  return b;
}
try {
  await page.goto(base, { waitUntil: "networkidle" });
  await page.screenshot({ path: "artifacts/home-desktop.png", fullPage: true });
  assert.ok(
    await page.getByRole("heading", { name: /A royal welcome/ }).isVisible(),
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      `horizontal overflow at ${width}`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/home-mobile.png", fullPage: true });
  await page.goto(base + "/menu");
  await page.getByRole("button", { name: "Add Banga soup & starch" }).click();
  await page.goto(base + "/cart");
  await page.getByLabel("Your name").fill("Browser Test Customer");
  await page.getByLabel("Phone / WhatsApp").fill("+2290000000000");
  await page.getByRole("button", { name: "Prepare my WhatsApp order" }).click();
  await page.getByRole("link", { name: "Send on WhatsApp" }).waitFor();
  const link = await page
    .getByRole("link", { name: "Send on WhatsApp" })
    .getAttribute("href");
  assert.ok(link.startsWith("https://wa.me/22950924184?text="));
  assert.ok(decodeURIComponent(link).includes("to be confirmed"));
  console.log(
    "PASS: browser cart and WhatsApp request; no external message sent.",
  );
  await page.reload();
  assert.ok(
    await page
      .getByRole("heading", { name: "Banga soup & starch" })
      .isVisible(),
  );
  const reservation = await post("reservation", {
    name: "Browser Test Reservation",
    phone: "+2290000000000",
    date: "2030-10-10",
    time: "18:30",
    guests: 3,
    message: "Automated test only",
  });
  assert.ok(reservation.url.includes("wa.me/22950924184"));
  const anonymous = await browser.newContext();
  const denied = await anonymous.request.get(base + "/api/admin/data");
  assert.equal(denied.status(), 401);
  await anonymous.close();
  const forgery = await context.request.post(base + "/api/admin/settings", {
    headers: { Origin: "https://attacker.invalid" },
    data: {},
  });
  assert.equal(forgery.status(), 400);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + "/admin");
  await page.getByLabel("Email", { exact: true }).fill(env.ADMIN_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(env.ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Open my restaurant desk" }).click();
  await page
    .getByRole("heading", { name: "Restaurant desk", exact: true })
    .waitFor();
  await page.screenshot({
    path: "artifacts/admin-desktop.png",
    fullPage: true,
  });
  let admin = await (
    await context.request.get(base + "/api/admin/data")
  ).json();
  const meal = admin.entries.find((e) => e.id === "banga");
  await post("admin/entry", { ...meal, price: 4500, priceVisibility: "show" });
  let catalog = await (await context.request.get(base + "/api/catalog")).json();
  assert.equal(catalog.entries.find((e) => e.id === "banga").price, 4500);
  const q = await post("quote", {
    lines: [{ id: "banga", quantity: 2 }],
    coupon: "",
  });
  assert.equal(q.total, 9000);
  await post("admin/entry", { ...meal, price: 4500, priceVisibility: "hide" });
  catalog = await (await context.request.get(base + "/api/catalog")).json();
  assert.equal(catalog.entries.find((e) => e.id === "banga").price, null);
  const campaign = {
    id: `browser-offer-${Date.now()}`,
    kind: "campaigns",
    title: "Browser test offer",
    description: "Automated test only",
    active: true,
    status: "published",
    sort: 1,
    discountType: "percent",
    discountValue: 10,
    claimLimit: 2,
    perCustomerLimit: 1,
    activationDays: 0,
    validityDays: 7,
  };
  await post("admin/entry", campaign);
  const reward = await post("claim", { campaignId: campaign.id, name: "Browser Test Customer" });
  const repeated = await context.request.post(base + "/api/claim", {
    headers: { Origin: base },
    data: { campaignId: campaign.id, name: "Browser Test Customer" },
  });
  assert.equal(repeated.status(), 400);
  assert.ok(reward.code.startsWith("NVO-"));
  admin = await (await context.request.get(base + "/api/admin/data")).json();
  const order = admin.orders.find(
    (o) => JSON.parse(o.data).name === "Browser Test Customer",
  );
  assert.ok(order);
  await post("admin/quote", {
    id: order.id,
    total: 4500,
    offerReviewed: false,
  });
  await post("admin/order", { id: order.id, status: "fulfilled_paid" });
  await post("admin/reservation", { id: reservation.id, status: "confirmed" });
  console.log(
    "PASS: login, persistent CRUD, private prices, reservation, claim limits and staff confirmation.",
  );
  for (const route of [
    "/menu",
    "/menu/banga",
    "/offers",
    "/about",
    "/contact",
    "/reservation",
    "/gallery",
    "/events",
    "/news",
    "/loyalty",
    "/privacy",
    "/terms",
  ]) {
    const r = await page.goto(base + route);
    assert.equal(r.status(), 200, route);
  }
  await page.goto(base + "/contact");
  const map = await page.locator("iframe").getAttribute("src");
  assert.ok(map.includes("6.3729882"));
  assert.ok(map.includes("2.4852719"));
  await page.goto(base + "/menu");
  await page.getByRole("button", { name: /Change language/ }).click();
  assert.ok(
    await page
      .getByRole("heading", { name: "Votre prochain coup de cœur." })
      .isVisible(),
  );
  assert.deepEqual(failures, []);
  console.log(
    "PASS: public routes, exact map coordinates, French menu and no browser runtime errors.",
  );
  writeFileSync(
    "artifacts/browser-results.json",
    JSON.stringify(
      {
        passed: true,
        checks: [
          "responsive widths 320/390/768/1440",
          "cart persistence",
          "WhatsApp URL without sending",
          "reservations",
          "admin login",
          "unauthorized access rejected",
          "cross-origin mutation rejected",
          "menu CRUD and hidden prices",
          "coupon limits",
          "staff outcome confirmation",
          "public routes",
          "map coordinates",
          "French menu",
        ],
        runtimeErrors: failures,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
