import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";
if (!/^http:\/\/(127\.0\.0\.1|localhost):3001$/.test(base))
  throw new Error("Run on the isolated test server at port 3001 only.");
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const browser = await chromium.launch({
  executablePath:
    process.env.EDGE_PATH ||
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
await context.addInitScript(() => {
  localStorage.setItem("nvo-analytics", "no");
  sessionStorage.setItem("nvo-welcomed", "yes");
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
mkdirSync("artifacts", { recursive: true });
async function post(route, data) {
  const response = await context.request.post(`${base}/api/${route}`, {
    headers: { Origin: base },
    data,
  });
  assert.ok(response.ok(), `${route}: HTTP ${response.status()}`);
  return response.json();
}
function schemas(html) {
  return [
    ...html.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    ),
  ].map((m) => JSON.parse(m[1]));
}
try {
  for (const [path, target] of [
    ["/en/menu", "/menu"],
    ["/promotions", "/offers"],
    ["/fr/promotions", "/fr/offers"],
    ["/fr/admin", "/admin"],
  ]) {
    const response = await context.request.get(base + path, {
      maxRedirects: 0,
    });
    assert.equal(response.status(), 308, `Redirect status: ${path}`);
    assert.equal(
      new URL(response.headers().location, base).href,
      base + target,
    );
  }
  for (const [path, lang, title] of [
    ["/menu", "en", "A menu made"],
    ["/fr/menu", "fr", "Une carte faite"],
    ["/fr/menu/seafood-boil-premium", "fr", "assortiment premium"],
  ]) {
    const response = await context.request.get(base + path);
    assert.equal(response.status(), 200);
    const html = await response.text();
    assert.ok(
      html.includes(`<html lang="${lang}"`),
      `Server HTML language: ${path}`,
    );
    assert.ok(
      html.includes(title),
      `Translated content in initial HTML: ${path}`,
    );
    assert.ok(
      html.includes(`rel="canonical" href="${base}${path}"`),
      `Canonical: ${path}`,
    );
    assert.ok(html.includes('hrefLang="en"') || html.includes('hreflang="en"'));
    assert.ok(html.includes('hrefLang="fr"') || html.includes('hreflang="fr"'));
    assert.ok(!html.includes('content="noindex'));
    const structured = schemas(html);
    assert.ok(structured.some((s) => s["@type"] === "BreadcrumbList"));
    if (path.endsWith("/menu"))
      assert.equal(
        structured
          .find((s) => s["@type"] === "Menu")
          .hasMenuSection.flatMap((s) => s.hasMenuItem).length,
        77,
      );
    checks.push({ path, serverHtml: true, canonical: true });
  }
  assert.equal(
    (await context.request.get(base + "/fr/menu/not-a-dish")).status(),
    404,
  );
  assert.equal(
    (await context.request.get(base + "/menu/banga/extra")).status(),
    404,
  );
  const sitemap = await (
    await context.request.get(base + "/sitemap.xml")
  ).text();
  assert.ok(
    sitemap.includes("/fr/menu/octopus") &&
      sitemap.includes("/menu/seafood-boil-premium"),
  );
  assert.ok(!sitemap.includes("/menu/rice-fish"));
  await page.goto(base + "/menu", { waitUntil: "networkidle" });
  assert.equal(await page.locator("[data-menu-item]").count(), 77);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Menu overflow: ${width}`,
    );
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "artifacts/menu-desktop.png" });
  await page.getByRole("button", { name: /Seafood boils & packages/ }).click();
  assert.equal(await page.locator("[data-menu-item]").count(), 4);
  assert.ok(
    (
      await page.locator('[data-menu-item="seafood-boil-premium"]').innerText()
    ).includes("100"),
  );
  await page.getByRole("button", { name: /All the menu/ }).click();
  await page.getByRole("button", { name: "EN — Change language" }).click();
  await page.waitForURL("**/fr/menu");
  await page.getByRole("heading", { name: /Une carte faite/ }).waitFor();
  await page
    .getByRole("textbox", { name: "Rechercher dans la carte" })
    .fill("poivrees");
  assert.ok((await page.locator("[data-menu-item]").count()) >= 3);
  await page.getByRole("button", { name: "Effacer la recherche" }).click();
  await page
    .getByRole("textbox", { name: "Rechercher dans la carte" })
    .fill("zzzz-no-dish");
  assert.equal(await page.locator("[data-menu-item]").count(), 0);
  await page.getByRole("button", { name: "Voir tous les plats" }).click();
  await page
    .getByRole("button", { name: "Ajouter Riz jollof & poulet", exact: true })
    .click();
  await page.getByRole("link", { name: "Ouvrir le panier" }).click();
  await page.waitForURL("**/fr/cart");
  assert.ok(
    (await page.locator("main").innerText()).toLowerCase().includes("jollof"),
  );
  await page.goto(base + "/fr/menu/octopus", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Poulpe", exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/menu-dish-mobile.png",
    fullPage: true,
  });
  for (const path of ["/", "/fr/menu", "/fr/menu/banga"]) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    const a11y = await new AxeBuilder({ page }).analyze();
    checks.push({
      path,
      accessibility: a11y.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
  }
  await page.screenshot({ path: "artifacts/menu-mobile.png" });
  await post("admin/login", {
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
  });
  const data = await (
    await context.request.get(base + "/api/admin/data")
  ).json();
  assert.equal(
    data.entries.filter((e) => e.kind === "meals" && e.active).length,
    77,
  );
  await post("admin/settings", { ...data.settings, showPrices: false });
  const hidden = await (await context.request.get(base + "/fr/menu")).text();
  assert.ok(
    schemas(hidden)
      .find((s) => s["@type"] === "Menu")
      .hasMenuSection.flatMap((s) => s.hasMenuItem)
      .every((e) => !e.offers),
  );
  const catalog = await (
    await context.request.get(base + "/api/catalog")
  ).json();
  assert.ok(
    catalog.entries
      .filter((e) => e.kind === "meals")
      .every((e) => e.price == null),
  );
  const quote = await post("quote", {
    lines: [{ id: "seafood-boil-premium", quantity: 1 }],
    coupon: "",
  });
  assert.equal(quote.total, null);
  await post("admin/settings", data.settings);
  const priced = await post("quote", {
    lines: [{ id: "jollof-chicken", quantity: 2 }],
    coupon: "",
  });
  assert.equal(priced.total, 5000);
  const mixed = await post("quote", {
    lines: [
      { id: "jollof-chicken", quantity: 1 },
      { id: "octopus", quantity: 1 },
    ],
    coupon: "",
  });
  assert.equal(mixed.total, null);
  assert.deepEqual(errors, []);
  writeFileSync(
    "artifacts/menu-seo-browser.json",
    JSON.stringify(
      {
        checks,
        menuCount: 77,
        hiddenPricesProtected: true,
        cartAndQuotes: true,
        browserErrors: errors,
      },
      null,
      2,
    ),
  );
  assert.deepEqual(
    checks.filter((c) => c.accessibility?.length),
    [],
    "Accessibility violations",
  );
  console.log(
    "PASS: bilingual server HTML, canonical/hreflang/sitemap, 77 menu options, search, responsive layout, accessibility, cart, quotes and hidden-price protection.",
  );
} finally {
  await browser.close();
}
