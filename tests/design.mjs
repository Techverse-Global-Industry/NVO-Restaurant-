import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";
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
await context.addInitScript(() => localStorage.setItem("nvo-analytics", "no"));
const page = await context.newPage();
page.setDefaultNavigationTimeout(60000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
mkdirSync("artifacts", { recursive: true });
async function post(route, data) {
  const r = await context.request.post(base + "/api/" + route, {
    headers: { Origin: base },
    data,
  });
  const b = await r.json();
  assert.ok(r.ok(), JSON.stringify(b));
  return b;
}
async function admin() {
  return (await context.request.get(base + "/api/admin/data")).json();
}
async function fullShot(name) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 70));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `artifacts/${name}.png`, fullPage: true });
}
const audits = [];
try {
  await post("admin/login", {
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
  });
  let data = await admin();
  await post("admin/settings", { ...data.settings, previewContent: true });
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.getByRole("region", { name: "NVO welcome" }).waitFor({state:"visible"});
  await page
    .getByRole("button", { name: "Close welcome", exact: true })
    .click();
  await fullShot("royal-home-desktop");
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `home overflow ${width}`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await fullShot("royal-home-mobile");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: /Play the NVO kitchen film/ }).click();
  await page.locator("video").waitFor();
  await page.waitForFunction(
    () => document.querySelector("video")?.readyState >= 2,
  );
  assert.ok(await page.locator("video").evaluate((v) => v.videoWidth > 0));
  await page.getByRole("button", { name: "Close video", exact: true }).click();
  for (const route of [
    "/",
    "/menu",
    "/gallery",
    "/news",
    "/events",
    "/reservation",
    "/admin",
  ]) {
    await page.goto(base + route, { waitUntil: "domcontentloaded" });
    await page.evaluate(()=>document.fonts.ready);
    if (route === "/admin")
      await page
        .getByRole("heading", { name: "Restaurant desk", exact: true })
        .waitFor();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    audits.push({
      route,
      violations: result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    });
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `${route} overflow ${width}`,
      );
    }
  }
  writeFileSync(
    "artifacts/accessibility-results.json",
    JSON.stringify(audits, null, 2),
  );
  await page.goto(base + "/admin");
  await page
    .getByRole("heading", { name: "Restaurant desk", exact: true })
    .waitFor();
  await fullShot("royal-admin-desktop");
  await page.getByRole("button", { name: "Food menu", exact: true }).click();
  await page.getByRole("button", { name: "Show me how this works" }).click();
  assert.ok(
    await page
      .getByText("Add the dish name, a photo and a short description.")
      .isVisible(),
  );
  await page.getByRole("textbox", { name: "Search items" }).fill("Banga");
  assert.equal(await page.locator(".admin-list .admin-row").count(), 1);
  await page
    .getByRole("button", { name: "Stories & journal", exact: true })
    .click();
  await page.getByRole("button", { name: "Add a story", exact: true }).click();
  const storyTitle = `Staff publishing test ${Date.now()}`;
  await page.getByLabel("Title · English", { exact: true }).fill(storyTitle);
  await page
    .getByLabel("Description · English", { exact: true })
    .fill("Automated draft-to-published workflow check.");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  let savedStory = (await admin()).entries.find((e) => e.title === storyTitle);
  assert.ok(savedStory && !savedStory.active && savedStory.status === "draft");
  await page
    .locator(".admin-row")
    .filter({ hasText: storyTitle })
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await page.getByLabel("Who can see this?").selectOption("published");
  await page
    .getByRole("button", { name: "Save & publish", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  savedStory = (await admin()).entries.find((e) => e.title === storyTitle);
  assert.ok(savedStory.active && savedStory.status === "published");
  assert.ok(
    (
      await (await context.request.get(base + "/api/catalog")).json()
    ).entries.some((e) => e.id === savedStory.id),
  );
  await post("admin/delete", { id: savedStory.id });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Choose workspace page").selectOption("media");
  await fullShot("royal-admin-mobile");
  await page
    .getByLabel("Upload a restaurant photo")
    .setInputFiles("public/images/banga-detail.webp");
  await page
    .getByText(
      "Photo uploaded. You can now select it when editing a dish or story.",
    )
    .waitFor();
  data = await admin();
  const media = data.media.find((m) => m.name === "banga-detail.webp");
  assert.ok(media);
  const dish = data.entries.find((e) => e.id === "banga");
  await post("admin/entry", { ...dish, image: media.url });
  const used = await context.request.post(base + "/api/admin/media/delete", {
    headers: { Origin: base },
    data: { id: media.id },
  });
  assert.equal(used.status(), 400);
  assert.match((await used.json()).error, /used by/);
  await post("admin/entry", dish);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete photo", exact: true })
    .first()
    .click();
  await page.getByText("Photo deleted from your library.").waitFor();
  assert.equal((await context.request.get(base + media.url)).status(), 404);
  const anon = await browser.newContext();
  const forbidden = await anon.request.post(base + "/api/admin/media/delete", {
    headers: { Origin: base },
    data: { id: media.id },
  });
  assert.equal(forbidden.status(), 403);
  await anon.close();
  await page.goto(base + "/news/sample-banga-story");
  assert.ok(
    await page.getByText("Sample content", { exact: true }).isVisible(),
  );
  assert.match(
    await page.locator('meta[name="robots"]').getAttribute("content"),
    /noindex/,
  );
  const sitemap = await (
    await context.request.get(base + "/sitemap.xml")
  ).text();
  assert.ok(!sitemap.includes("sample-"));
  await post("admin/settings", { ...data.settings, previewContent: false });
  const publicData = await (
    await context.request.get(base + "/api/catalog")
  ).json();
  assert.ok(!publicData.entries.some((e) => e.demo));
  assert.equal(
    (await page.goto(base + "/news/sample-banga-story")).status(),
    404,
  );
  await page.goto(base + "/menu/banga");
  assert.match(await page.title(), /Banga soup/);
  assert.equal(
    await page.locator('link[rel="canonical"]').getAttribute("href"),
    (env.SITE_URL || "http://localhost:3000") + "/menu/banga",
  );
  assert.ok(
    (await page.locator('meta[name="description"]').getAttribute("content"))
      .length > 30,
  );
  assert.ok(
    await page
      .locator('meta[name="robots"]')
      .evaluateAll((nodes) =>
        nodes.every((n) => !n.getAttribute("content")?.includes("noindex")),
      ),
  );
  await page.goto(base);
  const schema = JSON.parse(
    await page.locator('script[type="application/ld+json"]').textContent(),
  );
  assert.equal(schema.telephone, "+22950924184");
  assert.equal(schema.geo.latitude, 6.3729882);
  assert.deepEqual(errors, []);
  writeFileSync(
    "artifacts/design-results.json",
    JSON.stringify({ errors, audits }, null, 2),
  );
  console.log(
    JSON.stringify({
      functional: "passed",
      accessibility: audits.map((a) => ({
        route: a.route,
        violations: a.violations.length,
      })),
    }),
  );
  assert.ok(
    audits.every((a) => !a.violations.length),
    "Accessibility findings saved in artifacts/design-results.json",
  );
} finally {
  await browser.close();
}
