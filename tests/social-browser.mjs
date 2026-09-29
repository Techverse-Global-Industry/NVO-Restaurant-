import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
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
  viewport: { width: 1440, height: 1050 },
  reducedMotion: "reduce",
});
await context.addInitScript(() => {
  localStorage.setItem("nvo-analytics", "no");
  sessionStorage.setItem("nvo-welcomed", "yes");
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.setDefaultTimeout(15000);
mkdirSync("artifacts", { recursive: true });
const audits = [];
const testTitle = `Browser test lunch ${Date.now()}`;
async function post(route, data) {
  const r = await context.request.post(`${base}/api/${route}`, {
    headers: { Origin: base },
    data,
  });
  const b = await r.json();
  assert.ok(r.ok(), JSON.stringify(b));
  return b;
}
async function dashboard() {
  return (
    await context.request.get(`${base}/api/admin/social/dashboard`)
  ).json();
}
async function checkAxe(name) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  audits.push({
    name,
    violations: result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target),
    })),
  });
  assert.equal(result.violations.length, 0, JSON.stringify(audits.at(-1)));
}
try {
  assert.equal(
    (await context.request.get(`${base}/api/admin/social/dashboard`)).status(),
    403,
  );
  await post("admin/login", {
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
  });
  assert.equal(
    (
      await context.request.post(`${base}/api/admin/social/job`, {
        headers: { Origin: "https://unrelated.example" },
        data: { id: "fake", action: "retry" },
      })
    ).status(),
    400,
  );
  await page.goto(`${base}/admin?social=choose`);
  await page
    .getByRole("heading", { name: "Make NVO the next craving." })
    .waitFor();
  await checkAxe("publishing desk desktop");
  await page.screenshot({
    path: "artifacts/social-desk-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Create a post", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  // This regression supplies both languages; real automatic translation is
  // exercised separately in experience-browser.mjs.
  await dialog.getByRole("checkbox", {name: "Automatic translation"}).uncheck();
  await dialog.getByLabel("Title · English", { exact: true }).fill(testTitle);
  await dialog
    .getByLabel("Description · English", { exact: true })
    .fill("Fish and rice. Restaurant test content only.");
  await dialog
    .getByLabel("Title · French", { exact: true })
    .fill("Un déjeuner chez NVO");
  await dialog
    .getByLabel("Description · French", { exact: true })
    .fill("Du poisson et du riz. Publication de test uniquement.");
  await dialog
    .getByRole("combobox")
    .filter({ has: page.locator('option[value="/images/banga.jpeg"]') })
    .selectOption("/images/banga.jpeg");
  await dialog
    .getByRole("combobox")
    .filter({ has: page.locator('option[value="published"]') })
    .selectOption("published");
  await dialog
    .getByRole("combobox")
    .filter({ has: page.locator('option[value="selected"]') })
    .selectOption("selected");
  const choices = dialog.locator(".social-choice");
  await choices.filter({ hasText: "Facebook" }).getByRole("checkbox").check();
  await choices.filter({ hasText: "TikTok" }).getByRole("checkbox").check();
  await choices.filter({ hasText: "WhatsApp" }).getByRole("checkbox").check();
  assert.ok(
    !(await choices
      .filter({ hasText: "Instagram" })
      .getByRole("checkbox")
      .isChecked()),
  );
  await dialog.locator('[role="tabpanel"] textarea').waitFor();
  await page.waitForFunction(() =>
    document
      .querySelector('[role="tabpanel"] textarea')
      ?.value.includes("utm_source=facebook"),
  );
  const captions = {};
  for (const p of ["Facebook", "Instagram", "TikTok", "WhatsApp"]) {
    await dialog.getByRole("tab", { name: p, exact: true }).click();
    captions[p] = await dialog
      .locator('[role="tabpanel"] textarea')
      .inputValue();
    assert.ok(captions[p].length > 30);
  }
  assert.equal(new Set(Object.values(captions)).size, 4);
  assert.ok(captions.WhatsApp.includes("STOP"));
  assert.ok(
    await dialog.getByRole("button", { name: "Save & publish" }).isDisabled(),
  );
  await dialog.getByLabel(/I reviewed the photo and TikTok caption/).check();
  await checkAxe("post composer");
  await page.screenshot({
    path: "artifacts/social-composer-desktop.png",
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Save & publish" }).click();
  await dialog.waitFor({ state: "hidden" });
  let d = await dashboard();
  const jobs = d.jobs.filter((j) => j.title === testTitle);
  assert.equal(jobs.length, 3);
  assert.deepEqual(jobs.map((j) => j.platform).sort(), [
    "facebook",
    "tiktok",
    "whatsapp",
  ]);
  assert.ok(jobs.every((j) => j.status === "queued"));
  assert.ok(!JSON.stringify(d).includes("fixture-only-not-a-real-credential"));
  const id = jobs[0].entry_id;
  await post("admin/social/job", {
    id: jobs.find((j) => j.platform === "facebook").id,
    action: "cancel",
  });
  d = await dashboard();
  assert.equal(
    d.jobs.find((j) => j.platform === "facebook" && j.entry_id === id).status,
    "cancelled",
  );
  const data = await (
    await context.request.get(`${base}/api/admin/data`)
  ).json();
  const source = data.entries.find((e) => e.id === id);
  await post("admin/entry", {
    ...source,
    social: { mode: "off", language: "fr", accounts: [], captions: {} },
  });
  assert.ok(
    (await dashboard()).jobs
      .filter((j) => j.entry_id === id)
      .every((j) => j.status === "cancelled"),
  );
  await page.reload();
  await page
    .getByRole("heading", { name: "Make NVO the next craving." })
    .waitFor();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `publishing overflow ${width}`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await checkAxe("publishing desk mobile");
  await page.screenshot({
    path: "artifacts/social-desk-mobile.png",
    fullPage: true,
  });
  await page.goto(`${base}/subscribe`);
  await page.getByRole("checkbox").waitFor();
  const subscribe = page.getByRole("button", {
    name: /Subscribe in WhatsApp|M’abonner sur WhatsApp/,
  });
  assert.ok(await subscribe.isDisabled());
  await page.getByRole("checkbox").check();
  assert.ok(await subscribe.isEnabled());
  await checkAxe("subscription mobile");
  await page.screenshot({
    path: "artifacts/social-subscription-mobile.png",
    fullPage: true,
  });
  assert.equal(
    (
      await context.request.post(`${base}/api/social/whatsapp/webhook`, {
        data: { object: "whatsapp_business_account" },
      })
    ).status(),
    403,
  );
  await post("admin/social/account", {
    id: "test-facebook",
    action: "automatic",
    enabled: false,
  });
  assert.equal(
    (await dashboard()).accounts.find((a) => a.id === "test-facebook")
      .auto_publish,
    0,
  );
  await post("admin/social/unsubscribe", { phone: "22912345678" });
  assert.equal((await dashboard()).subscribers, 0);
  assert.deepEqual(errors, []);
  console.log(
    "Social browser checks passed: destination controls, four captions, TikTok consent, queue/cancellation, protected endpoints, responsive layouts, subscription consent, and accessibility. No external posts sent.",
  );
} catch (error) {
  await page.screenshot({
    path: "artifacts/social-browser-failure.png",
    fullPage: true,
  });
  console.error((await page.locator("body").innerText()).slice(-4500));
  throw error;
} finally {
  writeFileSync(
    "artifacts/social-browser-results.json",
    JSON.stringify({ errors, audits }, null, 2),
  );
  await browser.close();
}
