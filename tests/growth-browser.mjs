import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = "http://127.0.0.1:3003";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const browser = await chromium.launch({
  executablePath:
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
const admin = await browser.newContext();
const guest = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  userAgent: "NVO-Growth-Verification/1.0",
});
await guest.addInitScript(() => {
  if (!localStorage.getItem("nvo-analytics"))
    localStorage.setItem("nvo-analytics", "yes");
  sessionStorage.setItem("nvo-welcomed", "yes");
});
const page = await guest.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const checks = [];
mkdirSync("artifacts", { recursive: true });
async function post(context, route, data) {
  const r = await context.request.post(base + "/api/" + route, {
    headers: { Origin: base },
    data,
  });
  const b = await r.json();
  assert.ok(r.ok(), route + ": " + JSON.stringify(b));
  return b;
}
async function report() {
  return (await (await admin.request.get(base + "/api/admin/data")).json())
    .activity;
}
async function poll(fn, label) {
  for (let i = 0; i < 80; i++) {
    if (await fn()) return;
    await page.waitForTimeout(100);
  }
  throw new Error(label);
}
async function axe(label) {
  // Wait for the real reveal transitions to settle before sampling contrast.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (a) =>
          a.timeline !== document.timeline ||
          a.playState !== "running" ||
          a.effect?.getComputedTiming().iterations === Infinity,
      ),
  );
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  const issues = result.violations.map((v) => ({
    id: v.id,
    nodes: v.nodes.map((n) => n.target),
  }));
  checks.push({ label, violations: issues });
  assert.deepEqual(issues, [], label + ": " + JSON.stringify(issues));
}
try {
  await post(admin, "admin/login", {
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
  });
  const initial = await report();
  assert.equal(initial.pageViews, 0);
  assert.equal(initial.legacy.adminViews, 1);
  await page.goto(base + "/?utm_source=instagram");
  await poll(
    async () => (await report()).pageViews === 1,
    "one initial page view",
  );
  await page.getByRole("button", { name: "EN — Change language" }).click();
  await page.getByRole("button", { name: "FR — Change language" }).click();
  assert.equal(
    (await report()).pageViews,
    1,
    "language re-render must not count as navigation",
  );
  assert.ok(
    await page
      .locator(".specials-home")
      .evaluate(
        (el) =>
          el.getBoundingClientRect().top <
          document.querySelector(".royal-favourites").getBoundingClientRect()
            .top,
      ),
  );
  await page
    .locator(".specials-home")
    .screenshot({ path: "artifacts/specials-home-feature.png" });
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Current specials", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "The kitchen is calling.", exact: true })
    .waitFor();
  await page
    .locator(".specials-copy")
    .getByRole("link", { name: "Discover this special" })
    .click();
  await page.getByRole("link", { name: "Ask for this special" }).waitFor();
  assert.match(await page.title(), /The kitchen is calling/);
  assert.match(
    await page.locator("link[rel=canonical]").getAttribute("href"),
    /\/specials\/growth-kitchen-special$/,
  );
  assert.match(
    decodeURIComponent(
      await page
        .getByRole("link", { name: "Ask for this special" })
        .getAttribute("href"),
    ),
    /The kitchen is calling/,
  );
  await axe("special detail desktop");
  await page.screenshot({
    path: "artifacts/current-special-desktop.png",
    fullPage: true,
  });
  for (const width of [320, 390, 768, 940, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "special overflow " + width,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "EN — Change language" }).click();
  await page
    .getByRole("heading", { name: "La cuisine vous appelle.", exact: true })
    .waitFor();
  await axe("special detail mobile French");
  await page.screenshot({
    path: "artifacts/current-special-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "FR — Change language" }).click();
  for (const id of ["growth-expired", "growth-future", "growth-draft"])
    assert.equal(
      (await guest.request.get(base + "/specials/" + id)).status(),
      404,
    );
  const sitemap = await (await guest.request.get(base + "/sitemap.xml")).text();
  assert.match(sitemap, /specials\/growth-kitchen-special/);
  assert.doesNotMatch(sitemap, /growth-expired|growth-future|growth-draft/);
  await page.goto(base + "/offers");
  assert.equal(await page.locator(".specials-feature").count(), 0);
  assert.equal(
    await page.getByText("The kitchen is calling.", { exact: true }).count(),
    0,
  );
  console.log(
    "PASS: homepage prominence, separate specials, detail SEO, publication windows and responsive EN/FR.",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + "/menu");
  const add = page.getByRole("button", { name: /^Add .*Banga/i }).first();
  await add.click();
  await add.click();
  await page.getByRole("link", { name: "Open cart", exact: true }).click();
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await page.getByRole("button", { name: "Decrease quantity" }).click();
  await page.getByRole("button", { name: "Remove meal" }).click();
  await poll(async () => {
    const r = await report();
    return (
      r.counts.find((c) => c.event === "add_to_cart")?.count === 3 &&
      r.counts.find((c) => c.event === "remove_from_cart")?.count === 3
    );
  }, "actual quantity totals");
  await page
    .getByRole("link", { name: "Explore the menu", exact: true })
    .first()
    .click();
  await add.click();
  await add.click();
  await page.getByRole("link", { name: "Open cart", exact: true }).click();
  await page
    .getByLabel("Your name", { exact: true })
    .fill("Browser Test Guest");
  await page
    .getByLabel("Phone / WhatsApp", { exact: true })
    .fill("+22900000000");
  const submit = page
    .locator("form button[type=submit], form button.button:not([type])")
    .last();
  let fail = true;
  await page.route("**/api/order", async (route) => {
    if (fail) {
      fail = false;
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Test: please retry this request." }),
      });
    } else await route.continue();
  });
  await submit.click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Test: please retry" })
    .waitFor();
  assert.equal(
    JSON.parse(await page.evaluate(() => localStorage.getItem("nvo-cart")))[0]
      .quantity,
    2,
  );
  const secondTab = await guest.newPage();
  await secondTab.goto(base + "/cart");
  await secondTab.locator(".cart-line").waitFor();
  assert.equal(await secondTab.locator(".quantity span").innerText(), "2");
  await submit.click();
  const confirmation = page.getByRole("region", {
    name: "Order request saved",
  });
  await confirmation.waitFor();
  await poll(
    async () => (await secondTab.locator(".cart-line").count()) === 0,
    "cart clears in another open tab",
  );
  await secondTab.close();
  assert.deepEqual(
    JSON.parse(await page.evaluate(() => localStorage.getItem("nvo-cart"))),
    [],
  );
  assert.equal(await page.locator(".cart-line").count(), 0);
  const handoff = await confirmation
    .getByRole("link", { name: "Send on WhatsApp" })
    .getAttribute("href");
  assert.match(decodeURIComponent(handoff), /2 ×/);
  await axe("saved order confirmation");
  await page.screenshot({
    path: "artifacts/order-cleared-confirmation.png",
    fullPage: true,
  });
  await page.reload();
  await confirmation.waitFor();
  assert.equal(
    await confirmation
      .getByRole("link", { name: "Send on WhatsApp" })
      .getAttribute("href"),
    handoff,
  );
  await poll(
    async () =>
      (await report()).counts.find((c) => c.event === "add_to_cart")?.count ===
      5,
    "added totals after checkout",
  );
  assert.equal(
    (await report()).counts.find((c) => c.event === "remove_from_cart")?.count,
    3,
    "automatic completion is not removal",
  );
  const orders = (
    await (await admin.request.get(base + "/api/admin/data")).json()
  ).orders;
  assert.equal(orders.length, 1);
  const saved = JSON.parse(orders[0].data);
  const retried = await post(guest, "order", {
    ...saved,
    requestKey: saved.requestKey,
    name: "Changed retry name",
  });
  assert.equal(retried.url, handoff, "retry must use persisted order facts");
  assert.equal(
    (await (await admin.request.get(base + "/api/admin/data")).json()).orders
      .length,
    1,
  );
  await confirmation
    .getByRole("link", { name: "Start a new selection" })
    .click();
  await add.click();
  await page.getByRole("link", { name: "Open cart", exact: true }).click();
  assert.equal(
    await page.locator(".cart-line .quantity span").innerText(),
    "1",
  );
  console.log(
    "PASS: add/increase/decrease/remove quantities; failure preserves cart; saved order clears cart and persists WhatsApp handoff; retries do not duplicate.",
  );
  await poll(
    async () =>
      (await report()).counts.find((c) => c.event === "add_to_cart")?.count ===
      6,
    "last action recorded",
  );
  const before = await report();
  assert.equal(before.browsers, 1);
  assert.equal(before.visits, 1);
  const ignored = await post(admin, "analytics", {
    id: randomUUID(),
    consent: true,
    event: "page_view",
    page: "/",
    source: "direct",
  });
  assert.equal(ignored.recorded, false);
  assert.equal(
    (
      await post(guest, "analytics", {
        id: randomUUID(),
        consent: true,
        event: "page_view",
        page: "/admin",
        source: "direct",
      })
    ).recorded,
    false,
  );
  await page.evaluate(() => localStorage.setItem("nvo-analytics", "no"));
  await page.goto(base + "/about");
  assert.equal((await report()).pageViews, before.pageViews);
  await page.goto(base + "/admin");
  await page.getByLabel("Email", { exact: true }).fill(env.ADMIN_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(env.ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Open my restaurant desk" }).click();
  await page
    .getByRole("button", { name: "Guest activity", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "How guests change their cart" })
    .waitFor();
  assert.equal(
    (await report()).pageViews,
    0,
    "recognised staff browser excluded retrospectively",
  );
  await page
    .getByText("Earlier mixed records", { exact: false })
    .last()
    .click();
  await axe("guest activity admin");
  await page.screenshot({
    path: "artifacts/guest-activity-explained.png",
    fullPage: true,
  });
  await post(guest, "admin/logout", {});
  assert.equal(
    (
      await post(guest, "analytics", {
        id: randomUUID(),
        consent: true,
        event: "page_view",
        page: "/",
        source: "direct",
      })
    ).recorded,
    false,
    "internal marker persists after logout",
  );
  assert.deepEqual(errors, []);
  writeFileSync(
    "artifacts/growth-checks.json",
    JSON.stringify({ checks, errors, status: "passed" }, null, 2),
  );
  console.log(
    "PASS: consent, one browser/visit, staff exclusion, legacy separation, clear admin labels, zero accessibility violations.",
  );
} finally {
  await browser.close();
}
